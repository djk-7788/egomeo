"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

export type GridProduct = {
  id: string;
  title: string;
  category: "mild" | "medium" | "hot";
  image_url: string;
  image_urls: string[] | null;
  video_url: string | null;
  affiliate_link: string;
  button_text: string | null;
  media_width?: number | null;
  media_height?: number | null;
};

// ─────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────

// 상품 높이 추정값 (컬럼 폭=1 기준, 실제 px 불필요)
function estimateHeight(p: GridProduct): number {
  if (p.media_width && p.media_height) return p.media_height / p.media_width;
  return 5 / 4; // 4:5 fallback
}

// 상품 배열 → 컬럼 배열 (그리디: 가장 짧은 컬럼에 순서대로 배정)
function distributeToColumns(
  products: GridProduct[],
  numCols: number
): { cols: GridProduct[][]; heights: number[] } {
  const cols: GridProduct[][] = Array.from({ length: numCols }, () => []);
  const heights = Array<number>(numCols).fill(0);
  for (const p of products) {
    const minIdx = heights.indexOf(Math.min(...heights));
    cols[minIdx].push(p);
    heights[minIdx] += estimateHeight(p);
  }
  return { cols, heights };
}

function aspectRatioStyle(w?: number | null, h?: number | null): string {
  return w && h ? `${w} / ${h}` : "4 / 5";
}

// ─────────────────────────────────────────────
// 영상 카드
// 이중 IntersectionObserver:
//   1) 넓은 범위(1.5화면): <video> DOM 마운트/언마운트
//   2) 좁은 범위(30% 진입): play/pause
// ─────────────────────────────────────────────

function MasonryVideoItem({
  src,
  poster,
  aspectRatio,
}: {
  src: string;
  poster?: string;
  aspectRatio: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);

  // Observer 1: 마운트 제어
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const near = entry.isIntersecting;
        setMounted(near);
        if (!near) setReady(false);
      },
      { rootMargin: "150% 0px 150% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Observer 2: 재생 제어
  useEffect(() => {
    if (!mounted) return;
    const el = videoRef.current;
    if (!el) return;
    el.load();
    const playObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.3 }
    );
    playObserver.observe(el);
    const timer = setTimeout(() => setReady(true), 3000);
    return () => {
      playObserver.disconnect();
      clearTimeout(timer);
      el.pause();
    };
  }, [mounted, src]);

  return (
    <div
      ref={containerRef}
      style={{ aspectRatio }}
      className="relative overflow-hidden bg-white"
    >
      {poster ? (
        <img
          src={poster}
          alt=""
          className="absolute inset-0 w-full h-full object-contain"
          style={{ visibility: mounted && ready ? "hidden" : "visible" }}
        />
      ) : (
        (!mounted || !ready) && <div className="absolute inset-0 bg-gray-100" />
      )}
      {mounted && (
        <video
          key={src}
          ref={videoRef}
          src={src}
          muted
          loop
          playsInline
          preload="metadata"
          onLoadedMetadata={() => setReady(true)}
          onCanPlay={() => setReady(true)}
          className="absolute inset-0 w-full h-full object-contain"
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 개별 카드
// ─────────────────────────────────────────────

function MasonryItem({ product }: { product: GridProduct }) {
  const isVideo = !!product.video_url;
  const displayImageUrl =
    !isVideo && product.image_urls && product.image_urls.length >= 2
      ? product.image_urls[0]
      : product.image_url;
  const arStyle = aspectRatioStyle(product.media_width, product.media_height);

  return (
    <Link
      href={`/product/${product.id}`}
      className="group relative block overflow-hidden rounded-lg cursor-pointer"
    >
      {isVideo ? (
        <MasonryVideoItem
          src={product.video_url!}
          poster={product.image_url || undefined}
          aspectRatio={arStyle}
        />
      ) : (
        <div style={{ aspectRatio: arStyle }} className="overflow-hidden">
          <img
            src={displayImageUrl}
            alt={product.title}
            className="w-full h-full object-cover block"
          />
        </div>
      )}
      {/* 호버 오버레이 */}
      <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity duration-200 pointer-events-none" />
    </Link>
  );
}

// ─────────────────────────────────────────────
// 그리드 (메인)
// ─────────────────────────────────────────────

type Props = {
  initialProducts: GridProduct[];
  initialHasMore: boolean;
  excludeId?: string;
  category?: string;
  heading?: string;
  useSeed?: boolean; // true = sessionStorage 시드 기반 정렬
};

export default function InfiniteProductGrid({
  initialProducts,
  initialHasMore,
  excludeId,
  category,
  heading,
  useSeed = false,
}: Props) {
  // 컬럼 높이 추적 (ref: 무한스크롤 시 기존 위치 불변 보장)
  const colHeightsRef = useRef<number[]>([]);
  const numColsRef = useRef<number>(2);
  const allProductsRef = useRef<GridProduct[]>([...initialProducts]);
  const loadingRef = useRef(false);
  const seedRef = useRef<string | null>(null);
  const hasMoreRef = useRef(initialHasMore);
  const pageRef = useRef(2);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<() => void>(() => {});

  // 초기 배분 (SSR 호환: numCols=2 고정, useEffect에서 실제 값으로 재배치)
  const [columns, setColumns] = useState<GridProduct[][]>(() => {
    if (!initialProducts.length) return [];
    const { cols, heights } = distributeToColumns(initialProducts, 2);
    colHeightsRef.current = heights;
    return cols;
  });
  const [loading, setLoading] = useState(false);

  // 실제 컬럼 수 감지 + 브레이크포인트 전환 시 재배치
  // matchMedia 사용: 너비 기반 브레이크포인트 변경 시에만 발화
  // (모바일 주소창 숨김/표시 같은 height-only 변화는 무시됨)
  useEffect(() => {
    const q640 = window.matchMedia("(min-width: 640px)");
    const q1024 = window.matchMedia("(min-width: 1024px)");

    function relayout() {
      const n = q1024.matches ? 4 : q640.matches ? 3 : 2;
      if (n === numColsRef.current) return;
      numColsRef.current = n;
      const { cols, heights } = distributeToColumns(allProductsRef.current, n);
      colHeightsRef.current = heights;
      setColumns(cols);
    }

    relayout(); // 초기 1회 (SSR 2열 → 실제 열 수로 전환)

    q640.addEventListener("change", relayout);
    q1024.addEventListener("change", relayout);

    return () => {
      q640.removeEventListener("change", relayout);
      q1024.removeEventListener("change", relayout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 시드 기반 정렬: 마운트 시 sessionStorage 시드로 page 1 재조회
  // SSR 데이터(기본 정렬)를 시드 정렬로 교체, 이후 무한스크롤도 동일 시드 유지
  useEffect(() => {
    if (!useSeed) return;

    let seed = sessionStorage.getItem("feed_shuffle_seed");
    if (!seed) {
      seed = String(Math.floor(Math.random() * 2147483647));
      sessionStorage.setItem("feed_shuffle_seed", seed);
    }
    seedRef.current = seed;

    // loadMore가 동시에 실행되지 않도록 먼저 잠금
    loadingRef.current = true;
    setLoading(true);

    const params = new URLSearchParams({ page: "1", limit: "12", seed });
    if (excludeId) params.set("excludeId", excludeId);
    if (category) params.set("category", category);

    fetch(`/api/products?${params}`)
      .then((r) => r.json())
      .then(({ products: page1, hasMore: moreExists }) => {
        const p: GridProduct[] = page1 ?? [];
        const n = numColsRef.current;
        const { cols, heights } = distributeToColumns(p, n);
        colHeightsRef.current = heights;
        allProductsRef.current = p;
        pageRef.current = 2;
        hasMoreRef.current = moreExists;
        setColumns(cols);
      })
      .catch(() => {
        // 실패 시 SSR 데이터 유지
      })
      .finally(() => {
        loadingRef.current = false;
        setLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 무한스크롤: 새 아이템을 현재 가장 짧은 컬럼에 추가 (기존 아이템 위치 불변)
  async function loadMore() {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const params = new URLSearchParams({ page: String(pageRef.current), limit: "12" });
    if (excludeId) params.set("excludeId", excludeId);
    if (category) params.set("category", category);
    if (seedRef.current) params.set("seed", seedRef.current);

    try {
      const res = await fetch(`/api/products?${params}`);
      if (!res.ok) throw new Error("fetch 실패");
      const { products: more, hasMore: moreExists } = await res.json() as {
        products: GridProduct[];
        hasMore: boolean;
      };

      // 어느 컬럼에 넣을지 setColumns 밖에서 계산 (ref 변이를 setState 콜백 밖으로 분리)
      const heights = [...colHeightsRef.current];
      const assignments: number[] = [];
      for (const p of more) {
        const minIdx = heights.indexOf(Math.min(...heights));
        assignments.push(minIdx);
        heights[minIdx] += estimateHeight(p);
      }
      colHeightsRef.current = heights;
      allProductsRef.current = [...allProductsRef.current, ...more];

      setColumns(prev => {
        const next = prev.map(col => [...col]);
        more.forEach((p, i) => next[assignments[i]].push(p));
        return next;
      });

      pageRef.current += 1;
      hasMoreRef.current = moreExists;
    } catch {
      // 에러 시 재시도 가능하도록 상태 유지
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  // 매 렌더마다 최신 loadMore 유지
  useEffect(() => { loadMoreRef.current = loadMore; });

  // 센티넬 감시
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMoreRef.current(); },
      { rootMargin: "400px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const totalCount = columns.reduce((s, c) => s + c.length, 0);

  if (totalCount === 0 && !loading) {
    return <p className="text-center text-gray-400 py-20">등록된 상품이 없습니다.</p>;
  }

  return (
    <div>
      {heading && (
        <h2 className="text-lg font-black text-[#111111] mb-4">{heading}</h2>
      )}

      {/* JS 컬럼 메이슨리: 각 컬럼이 독립 flex-col → 새 아이템 추가 시 기존 아이템 위치 고정 */}
      <div className="flex gap-3 items-start">
        {columns.map((col, colIdx) => (
          <div key={colIdx} className="flex-1 flex flex-col gap-3 min-w-0">
            {col.map((p) => (
              <MasonryItem key={p.id} product={p} />
            ))}
          </div>
        ))}
      </div>

      {/* 무한 스크롤 센티넬 */}
      <div ref={sentinelRef} className="flex justify-center py-10">
        {loading && (
          <div className="w-8 h-8 border-[3px] border-[#F5A623] border-t-transparent rounded-full animate-spin" />
        )}
        {!loading && !hasMoreRef.current && totalCount > 0 && (
          <p className="text-xs text-gray-300">— 끝 —</p>
        )}
      </div>
    </div>
  );
}
