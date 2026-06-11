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

    // onCanPlay/onLoadedMetadata가 영원히 안 오는 엣지케이스 방어
    const timer = setTimeout(() => setReady(true), 3000);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [src]);

  return (
    <>
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
        style={ready ? undefined : { opacity: 0 }}
        className={className}
      />
    </>
  );
}
