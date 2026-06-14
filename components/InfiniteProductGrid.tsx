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
};

type Props = {
  initialProducts: GridProduct[];
  initialHasMore: boolean;
  excludeId?: string;
  category?: string;
  heading?: string;
};

// TODO: 영상 메모리 최적화(뷰포트 이탈 시 DOM 언마운트 등)는 다음 단계에서 별도 처리 예정
function MasonryVideoItem({ src, poster }: { src: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    setVideoReady(false);
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.load();
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);

    // 키프레임 1개짜리 영상 등 이벤트 미발화 케이스 방어
    const timer = setTimeout(() => setVideoReady(true), 3000);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [src]);

  return (
    <div className="relative bg-white">
      {poster ? (
        // 포스터 이미지가 컨테이너의 자연 높이를 결정 — 영상 로드 전 레이아웃 안정화
        <img
          src={poster}
          alt=""
          className="w-full block"
          style={{ visibility: videoReady ? "hidden" : "visible" }}
        />
      ) : (
        !videoReady && <div className="w-full aspect-square bg-gray-100 animate-pulse" />
      )}
      <video
        key={src}
        ref={ref}
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        onLoadedMetadata={() => setVideoReady(true)}
        onCanPlay={() => setVideoReady(true)}
        className="w-full block"
        style={
          poster
            ? { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, height: "100%", objectFit: "contain" }
            : !videoReady
            ? { position: "absolute", top: 0, left: 0, opacity: 0 }
            : undefined
        }
      />
    </div>
  );
}

function MasonryItem({ product }: { product: GridProduct }) {
  // 미디어 우선순위: video_url > image_urls(2장↑이면 첫 번째만, 슬라이드 없음) > image_url
  const isVideo = !!product.video_url;
  const displayImageUrl =
    !isVideo && product.image_urls && product.image_urls.length >= 2
      ? product.image_urls[0]
      : product.image_url;

  return (
    <Link
      href={`/product/${product.id}`}
      className="group relative block overflow-hidden rounded-lg break-inside-avoid mb-3 cursor-pointer"
    >
      {isVideo ? (
        <MasonryVideoItem
          src={product.video_url!}
          poster={product.image_url || undefined}
        />
      ) : (
        <img
          src={displayImageUrl}
          alt={product.title}
          className="w-full block"
        />
      )}
      {/* PC 호버 시 어두운 오버레이 — 클릭 가능함을 암시 */}
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
}: Props) {
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

  // 센티넬이 뷰포트에 들어오면 다음 페이지 로드
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

  return (
    <div>
      {heading && (
        <h2 className="text-lg font-black text-[#111111] mb-4">{heading}</h2>
      )}

      {/* 메이슨리 갤러리 — CSS columns 기반
          모바일 2열, 태블릿(sm:640px+) 3열, PC(lg:1024px+) 4열
          가상 스크롤(@tanstack/react-virtual) 제거 —
          영상 메모리 최적화(뷰포트 이탈 시 언마운트 등)는 다음 단계에서 별도 처리 예정 */}
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
        {products.map((p) => (
          <MasonryItem key={p.id} product={p} />
        ))}
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
