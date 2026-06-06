"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import ProductCard from "@/components/ProductCard";
import type { GridProduct } from "@/components/InfiniteProductGrid";

const STEP = 12;

export default function UnseenPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [allProducts, setAllProducts] = useState<GridProduct[]>([]);
  const [displayCount, setDisplayCount] = useState(STEP);
  const [pageLoading, setPageLoading] = useState(true);

  // 뷰포트에 진입한 적 있는 상품 ID 추적
  const seenRef = useRef<Set<string>>(new Set());
  // DB에 아직 쓰지 않은 viewed 상품 ID (배치용)
  const pendingRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 카드별 IntersectionObserver 맵
  const cardObserversRef = useRef<Map<string, IntersectionObserver>>(new Map());
  // 무한 스크롤 센티넬
  const sentinelRef = useRef<HTMLDivElement>(null);

  // 비로그인 → 메인으로
  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  // 안 본 상품 전체 로드 (1회)
  useEffect(() => {
    if (!user || authLoading) return;

    async function load() {
      setPageLoading(true);
      try {
        // RLS가 자동으로 현재 유저 행만 반환
        const { data: viewedData } = await supabase
          .from("viewed_products")
          .select("product_id");

        const viewedIds = (viewedData ?? []).map(
          (v: { product_id: string }) => v.product_id
        );

        let query = supabase
          .from("products")
          .select(
            "id, title, category, image_url, image_urls, video_url, affiliate_link, button_text"
          )
          .eq("is_active", true)
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false });

        if (viewedIds.length > 0) {
          query = query.not("id", "in", `(${viewedIds.join(",")})`);
        }

        const { data, error } = await query;
        if (error) throw error;
        setAllProducts((data as GridProduct[]) ?? []);
      } catch (err) {
        console.error("[UnseenPage] load error:", err);
      } finally {
        setPageLoading(false);
      }
    }

    load();
  }, [user, authLoading]);

  // viewed_products에 배치 upsert
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

  // 디바운스된 viewed 마킹
  const scheduleViewed = useCallback(
    (id: string) => {
      pendingRef.current.add(id);
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(flushViewed, 2000);
      // 10개 쌓이면 즉시 flush
      if (pendingRef.current.size >= 10) {
        clearTimeout(flushTimerRef.current!);
        flushViewed();
      }
    },
    [flushViewed]
  );

  // 언마운트 / 페이지 이탈 시 flush
  useEffect(() => {
    const onUnload = () => { flushViewed(); };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushViewed();
    };
  }, [flushViewed]);

  // 카드별 IntersectionObserver 등록 (상단 이탈 감지)
  const observeCard = useCallback(
    (el: HTMLDivElement | null, productId: string) => {
      if (!el || cardObserversRef.current.has(productId)) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            seenRef.current.add(productId);
          } else if (
            seenRef.current.has(productId) &&
            entry.boundingClientRect.bottom < 0 // 화면 상단으로 완전히 벗어남
          ) {
            scheduleViewed(productId);
          }
        },
        { threshold: 0 }
      );

      observer.observe(el);
      cardObserversRef.current.set(productId, observer);
    },
    [scheduleViewed]
  );

  // 카드 observers 정리
  useEffect(() => {
    return () => {
      cardObserversRef.current.forEach((o) => o.disconnect());
      cardObserversRef.current.clear();
    };
  }, []);

  // 무한 스크롤 센티넬
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && displayCount < allProducts.length) {
          setDisplayCount((prev) => prev + STEP);
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [displayCount, allProducts.length]);

  // --- 렌더 ---

  if (authLoading || pageLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-7 h-7 border-[3px] border-[#F5A623] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (allProducts.length === 0) {
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

  const displayed = allProducts.slice(0, displayCount);

  return (
    <div>
      <p className="text-xs text-gray-400 mb-5">
        안 본 상품{" "}
        <span className="font-bold text-[#F5A623]">{allProducts.length}개</span>{" "}
        남았어요
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {displayed.map((p) => (
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

      <div ref={sentinelRef} className="flex justify-center py-10">
        {displayCount < allProducts.length ? (
          <div className="w-7 h-7 border-[3px] border-[#F5A623] border-t-transparent rounded-full animate-spin" />
        ) : (
          <p className="text-xs text-gray-300">— 끝 —</p>
        )}
      </div>
    </div>
  );
}
