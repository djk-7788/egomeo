"use client";

import { useState, useEffect, useRef } from "react";
import ProductCard from "./ProductCard";

export type GridProduct = {
  id: string;
  title: string;
  category: "mild" | "medium" | "hot";
  image_url: string;
  image_urls: string[] | null;
  video_url: string | null;
  affiliate_link: string;
};

type Props = {
  initialProducts: GridProduct[];
  initialHasMore: boolean;
  excludeId?: string;
  category?: string;
  heading?: string;
};

export default function InfiniteProductGrid({
  initialProducts,
  initialHasMore,
  excludeId,
  category,
  heading,
}: Props) {
  const [products, setProducts] = useState<GridProduct[]>(initialProducts);
  const [loading, setLoading] = useState(false);

  // refs로 closure 최신값 유지 (observer는 한 번만 생성)
  const pageRef = useRef(2);
  const hasMoreRef = useRef(initialHasMore);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // 매 렌더에서 최신 loadMore를 ref에 저장
  const loadMoreRef = useRef<() => void>(() => {});

  async function loadMore() {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const params = new URLSearchParams({
      page: String(pageRef.current),
      limit: "12",
    });
    if (excludeId) params.set("excludeId", excludeId);
    if (category) params.set("category", category);

    try {
      const res = await fetch(`/api/products?${params}`);
      if (!res.ok) throw new Error("fetch 실패");
      const { products: more, hasMore: moreExists } = await res.json() as {
        products: GridProduct[];
        hasMore: boolean;
      };
      setProducts((prev) => [...prev, ...more]);
      pageRef.current += 1;
      hasMoreRef.current = moreExists;
    } catch {
      // 에러 시 재시도 가능하도록 상태 유지
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  // 매 렌더마다 최신 loadMore로 업데이트
  useEffect(() => {
    loadMoreRef.current = loadMore;
  });

  // observer는 마운트 시 한 번만 생성
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMoreRef.current();
      },
      { rootMargin: "400px" } // 하단 400px 전부터 미리 로드
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  if (products.length === 0) {
    return (
      <p className="text-center text-gray-400 py-20">등록된 상품이 없습니다.</p>
    );
  }

  return (
    <div>
      {heading && (
        <h2 className="text-lg font-black text-[#111111] mb-4">{heading}</h2>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            id={p.id}
            category={p.category}
            imageUrl={p.image_url}
            imageUrls={p.image_urls}
            videoUrl={p.video_url}
            title={p.title}
            link={p.affiliate_link}
          />
        ))}
      </div>

      {/* 센티넬: 이 div가 뷰포트에 들어오면 다음 페이지 로드 */}
      <div ref={sentinelRef} className="flex justify-center py-10">
        {loading && (
          <div className="w-8 h-8 border-[3px] border-[#FF5A00] border-t-transparent rounded-full animate-spin" />
        )}
        {!loading && !hasMoreRef.current && products.length > 0 && (
          <p className="text-xs text-gray-300">— 끝 —</p>
        )}
      </div>
    </div>
  );
}
