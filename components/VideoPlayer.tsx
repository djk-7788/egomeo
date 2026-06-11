"use client";

import { useRef, useEffect, useState } from "react";

export default function VideoPlayer({
  src,
  poster,
  className,
}: {
  src: string;
  poster?: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
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
      { threshold: 0.5 }
    );

    observer.observe(el);

    // onCanPlay/onLoadedMetadata가 오지 않는 케이스 방어 (키프레임 1개짜리 영상 등)
    const timer = setTimeout(() => setReady(true), 3000);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [src]);

  // video는 항상 visible — opacity:0 숨김 시 일부 브라우저에서 미디어 이벤트 미발화
  // poster/skeleton을 absolute overlay로 video 위에 올려서 로딩 중 화면을 덮음
  return (
    <>
      <video
        key={src}
        ref={ref}
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        onLoadedMetadata={() => setReady(true)}
        onCanPlay={() => setReady(true)}
        className={className}
      />
      {!ready && (
        poster ? (
          <img
            src={poster}
            alt=""
            className="absolute inset-0 w-full h-full object-contain bg-white"
          />
        ) : (
          <div className="absolute inset-0 bg-gray-100 animate-pulse" />
        )
      )}
    </>
  );
}
