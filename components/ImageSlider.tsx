"use client";

import { useState, useEffect, useRef } from "react";

type Props = {
  images: string[];
  alt: string;
  mode: "auto" | "manual";
  className?: string;
};

export default function ImageSlider({ images, alt, mode, className }: Props) {
  const [current, setCurrent] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode !== "auto") return;
    const el = containerRef.current;
    if (!el) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          intervalId = setInterval(() => {
            setCurrent((prev) => (prev + 1) % images.length);
          }, 1000);
        } else {
          if (intervalId) { clearInterval(intervalId); intervalId = null; }
          setCurrent(0);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (intervalId) clearInterval(intervalId);
    };
  }, [images.length, mode]);

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <img
        src={images[current]}
        alt={alt}
        className="w-full h-full object-cover"
      />
      {mode === "manual" && images.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setCurrent((c) => (c - 1 + images.length) % images.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white w-8 h-8 rounded-full flex items-center justify-center text-xl leading-none transition-colors"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setCurrent((c) => (c + 1) % images.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white w-8 h-8 rounded-full flex items-center justify-center text-xl leading-none transition-colors"
          >
            ›
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrent(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === current ? "bg-white" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
