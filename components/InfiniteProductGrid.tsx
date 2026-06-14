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

// aspect-ratio 문자열 — DB 값 있으면 사용, 없으면 4/5 fallback
function aspectRatioStyle(w?: number | null, h?: number | null): string {
  return w && h ? `${w} / ${h}` : "4 / 5";
}

/**
 * 영상 카드
 *
 * 메모리 최적화:
 *   - Observer 1 (넓은 범위, rootMargin 150%): 뷰포트에서 1.5화면 이상 벗어나면 <video> DOM 언마운트
 *   - Observer 2 (좁은 범위, threshold 0.3): 뷰포트 30% 진입 시 play, 이탈 시 pause
 *
 * 레이아웃 안정화:
 *   - 컨테이너에 aspect-ratio 고정 → 영상 로드 전에도 높이가 확정되어 리플로우 없음
 *   - 언마운트 중엔 포스터 이미지(또는 회색 박스)가 동일 aspect-ratio 유지
 */
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
  const [mounted, setMounted] = useState(false); // <video> DOM 존재 여부
  const [ready, setReady] = useState(false);     // 영상 재생 준비 완료

  // Observer 1: 마운트 제어 — 뷰포트 기준 1.5화면 안쪽이면 마운트, 벗어나면 언마운트
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const near = entry.isIntersecting;
        setMounted(near);
        if (!near) setReady(false); // 언마운트 시 리셋 → 재마운트 때 포스터 먼저 표시
      },
      { rootMargin: "150% 0px 150% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Observer 2: play/pause — mounted 상태일 때만 실행
  useEffect(() => {
    if (!mounted) return;
    const el = videoRef.current;
    if (!el) return;

    el.load();
    const playObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.3 }
    );
    playObserver.observe(el);

    // 키프레임 1개짜리 영상 등 이벤트 미발화 케이스 방어
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
      {/* 포스터: 영상 미준비(ready=false) 또는 언마운트 상태에서 표시 */}
      {poster ? (
        <img
          src={poster}
          alt=""
          className="absolute inset-0 w-full h-full object-contain"
          style={{ visibility: mounted && ready ? "hidden" : "visible" }}
        />
      ) : (
        (!mounted || !ready) && (
          <div className="absolute inset-0 bg-gray-100" />
        )
      )}
      {/* <video>: 근처에 있을 때만 DOM에 존재 */}
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
      className="group relative block overflow-hidden rounded-lg break-inside-avoid mb-3 cursor-pointer"
    >
      {isVideo ? (
        <MasonryVideoItem
          src={product.video_url!}
          poster={product.image_url || undefined}
          aspectRatio={arStyle}
        />
      ) : (
        // aspect-ratio로 컨테이너 높이 미리 확정 → 이미지 로드 전 리플로우 없음
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

export default function InfiniteProductGrid({
  initialProducts,
  initialHasMore,
  excludeId,
  category,
  heading,
}: {
  initialProducts: GridProduct[];
  initialHasMore: boolean;
  excludeId?: string;
  category?: string;
  heading?: string;
}) {
  const [products, setProducts] = useState<GridProduct[]>(initialProducts);
  const [loading, setLoading] = useState(false);

  const pageRef = useRef(2);
  const hasMoreRef = useRef(initialHasMore);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<() => void>(() => {});

  async function loadMore() {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const params = new URLSearchParams({ page: String(pageRef.current), limit: "12" });
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

  useEffect(() => { loadMoreRef.current = loadMore; });

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

  if (products.length === 0) {
    return <p className="text-center text-gray-400 py-20">등록된 상품이 없습니다.</p>;
  }

  return (
    <div>
      {heading && (
        <h2 className="text-lg font-black text-[#111111] mb-4">{heading}</h2>
      )}

      {/* 메이슨리 갤러리 — CSS columns, 2/3/4열 반응형 */}
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
        {products.map((p) => (
          <MasonryItem key={p.id} product={p} />
        ))}
      </div>

      {/* 무한 스크롤 센티넬 */}
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
