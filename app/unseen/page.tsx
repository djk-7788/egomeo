"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import ProductCard from "@/components/ProductCard";
import type { GridProduct } from "@/components/InfiniteProductGrid";

const PAGE_SIZE = 12;

export default function UnseenPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState<GridProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const offsetRef = useRef(0);
  const initialViewedIdsRef = useRef<string[]>([]);
  const loadedRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // viewed 마킹용
  const seenRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardObserversRef = useRef<Map<string, IntersectionObserver>>(new Map());

  // 비로그인 리다이렉트
  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  // 초기 로드
  useEffect(() => {
    if (!user || authLoading || loadedRef.current) return;
    loadedRef.current = true;

    async function init() {
      loadingRef.current = true;
      setLoading(true);
      try {
        const { data: viewedData } = await supabase
          .from("viewed_products")
          .select("product_id");

        const viewedIds = (viewedData ?? []).map(
          (v: { product_id: string }) => v.product_id
        );
        initialViewedIdsRef.current = viewedIds;

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

        const loaded = (data ?? []) as GridProduct[];
        setProducts(loaded);
        offsetRef.current = PAGE_SIZE;
        const more = loaded.length === PAGE_SIZE;
        hasMoreRef.current = more;
        setHasMore(more);
      } catch (err) {
        console.error("[UnseenPage] init error:", err);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    }

    init();
  }, [user, authLoading]);

  // 추가 로드
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setLoading(true);
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
        .range(offsetRef.current, offsetRef.current + PAGE_SIZE - 1);

      if (ids.length > 0) q = q.not("id", "in", `(${ids.join(",")})`);

      const { data, error } = await q;
      if (error) throw error;

      const loaded = (data ?? []) as GridProduct[];
      setProducts((prev) => [...prev, ...loaded]);
      offsetRef.current += PAGE_SIZE;
      const more = loaded.length === PAGE_SIZE;
      hasMoreRef.current = more;
      setHasMore(more);
    } catch (err) {
      console.error("[UnseenPage] loadMore error:", err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  // 하단 센티넬 (마운트 1회)
  const loadMoreRef = useRef(loadMore);
  useEffect(() => { loadMoreRef.current = loadMore; });

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) loadMoreRef.current(); },
      { rootMargin: "400px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // viewed_products 저장
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

  // 카드별 상단 이탈 감지
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

  if (authLoading || (loading && products.length === 0)) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-7 h-7 border-[3px] border-[#F5A623] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (products.length === 0) {
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
      <p className="text-xs text-gray-400 mb-5">
        안 본 상품{" "}
        <span className="font-bold text-[#F5A623]">
          {products.length}{hasMore ? "+" : ""}개
        </span>{" "}
        남았어요
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {products.map((p) => (
          <div key={p.id} ref={(el) => observeCard(el, p.id)}>
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

      <div ref={sentinelRef} className="flex justify-center py-10">
        {loading ? (
          <div className="w-7 h-7 border-[3px] border-[#F5A623] border-t-transparent rounded-full animate-spin" />
        ) : !hasMore ? (
          <p className="text-xs text-gray-300">— 다 보셨네요! —</p>
        ) : null}
      </div>
    </div>
  );
}
