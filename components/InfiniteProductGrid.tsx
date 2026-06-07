"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import ProductCard from "./ProductCard";

export type GridProduct = {
  id: string;
  title: string;
  category: "mild" | "medium" | "hot";
  image_url: string;
  image_urls: string[] | null;
  video_url: string | null;
  affiliate_link: string;
  button_text: string | null;
};

type Props = {
  initialProducts: GridProduct[];
  initialHasMore: boolean;
  excludeId?: string;
  category?: string;
  heading?: string;
};

// 초기값 3: SSR과 클라이언트 첫 렌더를 일치시켜 hydration 경고 방지
// useEffect에서 실제 화면 너비로 보정됨
function useColumnCount(): number {
  const [cols, setCols] = useState(3);

  useEffect(() => {
    const compute = (): number => {
      if (window.innerWidth < 640) return 1;
      if (window.innerWidth < 768) return 2;
      return 3;
    };
    setCols(compute());
    const handler = () => setCols(compute());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return cols;
}

const ESTIMATED_ROW_HEIGHT = 600; // 카드 높이(~500) + gap(16) + 여유분

export default function InfiniteProductGrid({
  initialProducts,
  initialHasMore,
  excludeId,
  category,
  heading,
}: Props) {
  const [products, setProducts] = useState<GridProduct[]>(initialProducts);
  const [loading, setLoading] = useState(false);

  const pageRef = useRef(2);
  const hasMoreRef = useRef(initialHasMore);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<() => void>(() => {});
  const listRef = useRef<HTMLDivElement>(null);

  const columnCount = useColumnCount();

  // 카드 배열 → 행 배열 (columnCount개씩 묶기)
  const rows = useMemo<GridProduct[][]>(() => {
    const result: GridProduct[][] = [];
    for (let i = 0; i < products.length; i += columnCount) {
      result.push(products.slice(i, i + columnCount));
    }
    return result;
  }, [products, columnCount]);

  // 가상 스크롤러가 필요한 scrollMargin:
  // 리스트 컨테이너의 document 최상단 기준 절대 Y 좌표
  const [scrollMargin, setScrollMargin] = useState(0);
  useEffect(() => {
    const update = () => {
      if (!listRef.current) return;
      const rect = listRef.current.getBoundingClientRect();
      setScrollMargin(Math.round(rect.top + window.scrollY));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 5, // 뷰포트 위아래 5행 미리 렌더링
    scrollMargin,
  });

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

  // 센티넬이 뷰포트에 들어오면 다음 페이지 로드 (마운트 시 한 번만 생성)
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMoreRef.current();
      },
      { rootMargin: "400px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  if (products.length === 0) {
    return (
      <p className="text-center text-gray-400 py-20">등록된 상품이 없습니다.</p>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div>
      {heading && (
        <h2 className="text-lg font-black text-[#111111] mb-4">{heading}</h2>
      )}

      {/* 가상 스크롤 컨테이너: 전체 높이를 차지하고 가시 행만 absolute로 배치 */}
      <div
        ref={listRef}
        style={{ height: `${totalSize}px`, position: "relative" }}
      >
        {virtualItems.map((vRow) => {
          const row = rows[vRow.index];
          if (!row) return null;
          return (
            <div
              key={vRow.key}
              data-index={vRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vRow.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              <div
                className="grid gap-4 pb-4"
                style={{
                  gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                }}
              >
                {row.map((p) => (
                  <ProductCard
                    key={p.id}
                    id={p.id}
                    category={p.category}
                    imageUrl={p.image_url}
                    imageUrls={p.image_urls}
                    videoUrl={p.video_url}
                    title={p.title}
                    link={p.affiliate_link}
                    buttonText={p.button_text}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 센티넬: 이 div가 뷰포트에 들어오면 다음 페이지 로드 */}
      <div ref={sentinelRef} className="flex justify-center py-10">
        {loading && (
          <div className="w-8 h-8 border-[3px] border-[#F5A623] border-t-transparent rounded-full animate-spin" />
        )}
        {!loading && !hasMoreRef.current && products.length > 0 && (
          <p className="text-xs text-gray-300">— 끝 —</p>
        )}
      </div>
    </div>
  );
}
