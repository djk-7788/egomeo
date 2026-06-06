"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import ProductCard from "@/components/ProductCard";
import type { GridProduct } from "@/components/InfiniteProductGrid";

const PAGE_SIZE = 12;

// useLayoutEffect는 서버에서 실행 안 됨 → SSR 경고 억제
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function UnseenPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [aboveItems, setAboveItems] = useState<GridProduct[]>([]);
  const [belowItems, setBelowItems] = useState<GridProduct[]>([]);
  const [loadingAbove, setLoadingAbove] = useState(false);
  const [loadingBelow, setLoadingBelow] = useState(true);
  const [hasMoreAbove, setHasMoreAbove] = useState(true);
  const [hasMoreBelow, setHasMoreBelow] = useState(true);

  // ref 기반 로딩 플래그 (IntersectionObserver 재생성 방지)
  const loadingAboveRef = useRef(false);
  const loadingBelowRef = useRef(false);
  const hasMoreAboveRef = useRef(true);
  const hasMoreBelowRef = useRef(true);

  // 페이지네이션 커서
  const belowOffsetRef = useRef(0);
  const aboveCursorRef = useRef<string | null>(null); // viewed_at 기준 커서

  // 세션 시작 시점 viewed IDs 스냅샷 (below 페이지네이션 안정성 보장)
  const initialViewedIdsRef = useRef<string[]>([]);
  // 현재 화면에 있는 상품 IDs (above 로딩 시 중복 제거)
  const displayedIdsRef = useRef<Set<string>>(new Set());

  // 초기화 중복 실행 방지 (React StrictMode)
  const loadedRef = useRef(false);

  // 상단 prepend 시 스크롤 위치 보정
  const prevScrollHeightRef = useRef(0);

  // 센티넬 refs
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  // viewed 마킹용
  const seenRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardObserversRef = useRef<Map<string, IntersectionObserver>>(new Map());

  // displayedIds 동기화
  useEffect(() => {
    displayedIdsRef.current = new Set([
      ...aboveItems.map((p) => p.id),
      ...belowItems.map((p) => p.id),
    ]);
  }, [aboveItems, belowItems]);

  // 비로그인 리다이렉트
  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  // 초기 로드: viewed IDs 스냅샷 + 첫 페이지 unseen
  useEffect(() => {
    if (!user || authLoading || loadedRef.current) return;
    loadedRef.current = true;

    async function init() {
      loadingBelowRef.current = true;
      setLoadingBelow(true);
      try {
        const { data: viewedData } = await supabase
          .from("viewed_products")
          .select("product_id");

        const viewedIds = (viewedData ?? []).map(
          (v: { product_id: string }) => v.product_id
        );
        initialViewedIdsRef.current = viewedIds;

        if (viewedIds.length === 0) {
          hasMoreAboveRef.current = false;
          setHasMoreAbove(false);
        }

        let q = supabase
          .from("products")
          .select(
            "id, title, category, image_url, image_urls, video_url, affiliate_link, button_text, sort_order"
          )
          .eq("is_active", true)
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false })
          .range(0, PAGE_SIZE - 1);

        if (viewedIds.length > 0) {
          q = q.not("id", "in", `(${viewedIds.join(",")})`);
        }

        const { data, error } = await q;
        if (error) throw error;

        const products = (data ?? []) as GridProduct[];
        setBelowItems(products);
        belowOffsetRef.current = PAGE_SIZE;
        const more = products.length === PAGE_SIZE;
        hasMoreBelowRef.current = more;
        setHasMoreBelow(more);
      } catch (err) {
        console.error("[UnseenPage] init error:", err);
      } finally {
        loadingBelowRef.current = false;
        setLoadingBelow(false);
      }
    }

    init();
  }, [user, authLoading]);

  // 아래 로드 (unseen, offset 기반)
  const loadBelow = useCallback(async () => {
    if (loadingBelowRef.current || !hasMoreBelowRef.current) return;
    loadingBelowRef.current = true;
    setLoadingBelow(true);
    try {
      const ids = initialViewedIdsRef.current;
      let q = supabase
        .from("products")
        .select(
          "id, title, category, image_url, image_urls, video_url, affiliate_link, button_text, sort_order"
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(belowOffsetRef.current, belowOffsetRef.current + PAGE_SIZE - 1);

      if (ids.length > 0) q = q.not("id", "in", `(${ids.join(",")})`);

      const { data, error } = await q;
      if (error) throw error;

      const products = (data ?? []) as GridProduct[];
      setBelowItems((prev) => [...prev, ...products]);
      belowOffsetRef.current += PAGE_SIZE;
      const more = products.length === PAGE_SIZE;
      hasMoreBelowRef.current = more;
      setHasMoreBelow(more);
    } catch (err) {
      console.error("[UnseenPage] loadBelow error:", err);
    } finally {
      loadingBelowRef.current = false;
      setLoadingBelow(false);
    }
  }, []);

  // 위 로드 (viewed, viewed_at 커서 기반, 2-step)
  const loadAbove = useCallback(async () => {
    if (loadingAboveRef.current || !hasMoreAboveRef.current) return;
    loadingAboveRef.current = true;
    setLoadingAbove(true);
    try {
      const excludeList = [...displayedIdsRef.current].join(",");

      // Step 1: viewed_products에서 product_id + viewed_at 조회 (커서 페이징)
      let vq = supabase
        .from("viewed_products")
        .select("product_id, viewed_at")
        .order("viewed_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (aboveCursorRef.current) {
        vq = vq.lt("viewed_at", aboveCursorRef.current);
      }
      if (excludeList) {
        vq = vq.not("product_id", "in", `(${excludeList})`);
      }

      const { data: vData, error: vErr } = await vq;
      if (vErr) throw vErr;

      const rows = (vData ?? []) as { product_id: string; viewed_at: string }[];
      if (rows.length === 0) {
        hasMoreAboveRef.current = false;
        setHasMoreAbove(false);
        return;
      }

      // 다음 커서: 이번 배치 중 가장 오래된 viewed_at
      aboveCursorRef.current = rows[rows.length - 1].viewed_at;

      // Step 2: 상품 상세 조회
      const productIds = rows.map((r) => r.product_id);
      const { data: pData, error: pErr } = await supabase
        .from("products")
        .select(
          "id, title, category, image_url, image_urls, video_url, affiliate_link, button_text, sort_order"
        )
        .in("id", productIds);
      if (pErr) throw pErr;

      const pMap = new Map(
        ((pData ?? []) as GridProduct[]).map((p) => [p.id, p])
      );

      // Step 1 순서 유지 (viewed_at DESC) → reverse해서 위에서 아래로 시간순 배치
      const ordered = productIds
        .map((id) => pMap.get(id))
        .filter((p): p is GridProduct => p != null);

      if (ordered.length > 0) {
        prevScrollHeightRef.current = document.documentElement.scrollHeight;
        setAboveItems((prev) => [...ordered.reverse(), ...prev]);
      }

      const more = rows.length === PAGE_SIZE;
      hasMoreAboveRef.current = more;
      setHasMoreAbove(more);
    } catch (err) {
      console.error("[UnseenPage] loadAbove error:", err);
    } finally {
      loadingAboveRef.current = false;
      setLoadingAbove(false);
    }
  }, []);

  // 상단 prepend 후 스크롤 위치 보정 (화면 튀는 현상 방지)
  useIsomorphicLayoutEffect(() => {
    if (prevScrollHeightRef.current > 0) {
      const diff =
        document.documentElement.scrollHeight - prevScrollHeightRef.current;
      if (diff > 0) window.scrollBy(0, diff);
      prevScrollHeightRef.current = 0;
    }
  }, [aboveItems]);

  // 센티넬 IntersectionObserver (마운트 1회 — loadXxxRef 패턴으로 최신 함수 참조)
  const loadAboveRef = useRef(loadAbove);
  const loadBelowRef = useRef(loadBelow);
  useEffect(() => { loadAboveRef.current = loadAbove; });
  useEffect(() => { loadBelowRef.current = loadBelow; });

  useEffect(() => {
    const el = topSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) loadAboveRef.current(); },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = bottomSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) loadBelowRef.current(); },
      { rootMargin: "400px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // viewed 마킹 (카드 상단 이탈 감지)
  const flushViewed = useCallback(async () => {
    if (!user || pendingRef.current.size === 0) return;
    const ids = [...pendingRef.current];
    pendingRef.current.clear();
    try {
      await supabase.from("viewed_products").upsert(
        ids.map((id) => ({
          user_id: user.id,
          product_id: id,
          viewed_at: new Date().toISOString(),
        })),
        { onConflict: "user_id,product_id" }
      );
    } catch (err) {
      console.error("[UnseenPage] flushViewed error:", err);
    }
  }, [user]);

  const scheduleViewed = useCallback(
    (id: string) => {
      pendingRef.current.add(id);
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(flushViewed, 2000);
      if (pendingRef.current.size >= 10) {
        clearTimeout(flushTimerRef.current!);
        flushViewed();
      }
    },
    [flushViewed]
  );

  useEffect(() => {
    const onUnload = () => flushViewed();
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushViewed();
    };
  }, [flushViewed]);

  const observeCard = useCallback(
    (el: HTMLDivElement | null, productId: string) => {
      if (!el || cardObserversRef.current.has(productId)) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            seenRef.current.add(productId);
          } else if (
            seenRef.current.has(productId) &&
            entry.boundingClientRect.bottom < 0
          ) {
            scheduleViewed(productId);
          }
        },
        { threshold: 0 }
      );
      obs.observe(el);
      cardObserversRef.current.set(productId, obs);
    },
    [scheduleViewed]
  );

  useEffect(() => {
    return () => {
      cardObserversRef.current.forEach((o) => o.disconnect());
      cardObserversRef.current.clear();
    };
  }, []);

  // ─── 렌더 ───

  const initialLoading =
    authLoading ||
    (loadingBelow && belowItems.length === 0 && aboveItems.length === 0);

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-7 h-7 border-[3px] border-[#F5A623] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (belowItems.length === 0 && !loadingBelow) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center px-4">
        <p className="text-5xl mb-5">👀</p>
        <p className="text-xl font-black text-[#111111] mb-2">다 보셨네요!</p>
        <p className="text-sm text-gray-400 leading-relaxed mb-8">
          등록된 모든 상품을 확인하셨습니다.
          <br />새 상품이 올라오면 여기서 만나요.
        </p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-2.5 bg-[#F5A623] text-white font-bold rounded-lg hover:bg-[#d8921f] transition-colors text-sm"
        >
          메인으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* 상단 센티넬 + 위쪽 로딩/완료 표시 */}
      <div ref={topSentinelRef} className="flex justify-center py-6 min-h-[2.5rem]">
        {loadingAbove && (
          <div className="w-6 h-6 border-2 border-[#F5A623] border-t-transparent rounded-full animate-spin" />
        )}
        {!loadingAbove && !hasMoreAbove && aboveItems.length > 0 && (
          <p className="text-xs text-gray-400 font-semibold">
            처음으로 돌아왔어요! 👋
          </p>
        )}
      </div>

      {/* 본 상품 (위) */}
      {aboveItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {aboveItems.map((p) => (
            <div key={p.id}>
              <ProductCard
                id={p.id}
                category={p.category}
                imageUrl={p.image_url}
                imageUrls={p.image_urls}
                videoUrl={p.video_url}
                title={p.title}
                link={p.affiliate_link}
                buttonText={p.button_text}
              />
            </div>
          ))}
        </div>
      )}

      {/* 구분선 */}
      {aboveItems.length > 0 && (
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-[11px] text-[#F5A623] font-bold whitespace-nowrap px-1">
            ↓ 여기서부터 안 본 상품
          </span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
      )}

      {/* 안 본 상품 카운트 */}
      <p className="text-xs text-gray-400 mb-5">
        안 본 상품{" "}
        <span className="font-bold text-[#F5A623]">
          {belowItems.length}{hasMoreBelow ? "+" : ""}개
        </span>{" "}
        남았어요
      </p>

      {/* 안 본 상품 (아래) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {belowItems.map((p) => (
          <div
            key={p.id}
            ref={(el) => observeCard(el, p.id)}
          >
            <ProductCard
              id={p.id}
              category={p.category}
              imageUrl={p.image_url}
              imageUrls={p.image_urls}
              videoUrl={p.video_url}
              title={p.title}
              link={p.affiliate_link}
              buttonText={p.button_text}
            />
          </div>
        ))}
      </div>

      {/* 하단 센티넬 */}
      <div ref={bottomSentinelRef} className="flex justify-center py-10">
        {loadingBelow && (
          <div className="w-7 h-7 border-[3px] border-[#F5A623] border-t-transparent rounded-full animate-spin" />
        )}
        {!loadingBelow && !hasMoreBelow && (
          <p className="text-xs text-gray-300">— 다 보셨네요! —</p>
        )}
      </div>
    </div>
  );
}
