"use client";

import { useState } from "react";

export type ParsedProduct = {
  title: string;
  images: string[];
  source: string;
  productUrl: string;
};

type Props = {
  onSelect: (product: ParsedProduct, imageUrl: string) => void;
};

export default function UrlParser({ onSelect }: Props) {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<ParsedProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedImage, setSelectedImage] = useState("");
  const [hoverImage, setHoverImage] = useState<string | null>(null);
  const [hoverStyle, setHoverStyle] = useState({ left: 0, top: 0 });

  async function handleParse(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);
    setSelectedImage("");

    try {
      const res = await fetch(`/api/parse-url?url=${encodeURIComponent(url.trim())}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "파싱 중 오류가 발생했습니다.");
      } else {
        setResult(data);
        setSelectedImage(data.images[0] ?? "");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleThumbnailEnter(img: string, e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const W = 320;
    const margin = 10;
    let left = rect.left + rect.width / 2 - W / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - W - margin));
    const top = rect.top > W + margin ? rect.top - W - margin : rect.bottom + margin;
    setHoverImage(img);
    setHoverStyle({ left, top });
  }

  const siteLabel = result?.source === "coupang" ? "쿠팡" : result?.source === "amazon" ? "아마존" : "";

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* URL 입력 */}
      <form onSubmit={handleParse} className="flex gap-3 mb-6">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="쿠팡 또는 아마존 상품 URL 붙여넣기"
          className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5A623] transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="bg-[#F5A623] text-white text-sm font-bold px-6 py-2.5 rounded-lg hover:bg-[#d8921f] transition-colors disabled:opacity-40 flex-shrink-0"
        >
          {loading ? "파싱 중..." : "불러오기"}
        </button>
      </form>

      {/* 초기 안내 */}
      {!result && !loading && !error && (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">🔗</p>
          <p className="text-gray-400 text-sm">쿠팡 또는 아마존 상품 URL을 붙여넣으세요.</p>
          <p className="text-gray-300 text-xs mt-1">상품명 · 이미지를 자동으로 가져옵니다.</p>
          <div className="mt-5 text-[11px] text-gray-200 space-y-1">
            <p>쿠팡: https://www.coupang.com/vp/products/…</p>
            <p>아마존: https://www.amazon.com/dp/…</p>
          </div>
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm">페이지 파싱 중...</p>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* 파싱 결과 */}
      {result && (
        <div className="bg-white border-2 border-[#F5A623] rounded-xl p-5">
          {/* 헤더: 사이트 + 상품명 + 가격 */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold bg-[#F5A623] text-white px-2 py-0.5 rounded-full flex-shrink-0">
              {siteLabel}
            </span>
            <p className="text-sm font-semibold text-[#111111] line-clamp-1">
              {result.title || "(상품명 없음)"}
            </p>
          </div>
          {/* 이미지 썸네일 선택 */}
          {result.images.length > 0 ? (
            <>
              <p className="text-[10px] font-semibold text-gray-400 mb-2">
                이미지 선택 ({result.images.length}장)
              </p>
              <div className="flex gap-2 flex-wrap mb-4">
                {result.images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedImage(img)}
                    onMouseEnter={(e) => handleThumbnailEnter(img, e)}
                    onMouseLeave={() => setHoverImage(null)}
                    className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                      selectedImage === img
                        ? "border-[#F5A623]"
                        : "border-gray-100 hover:border-gray-300"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>

              {/* 선택된 이미지 미리보기 */}
              {selectedImage && (
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-100 flex-shrink-0">
                    <img src={selectedImage} alt="선택된 이미지" className="w-full h-full object-cover" />
                  </div>
                  <p className="text-xs text-gray-400">선택된 이미지 — 썸네일 클릭으로 변경</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400 mb-4">이미지를 가져오지 못했습니다.</p>
          )}

          {/* 폼 불러오기 */}
          <button
            type="button"
            onClick={() => result && onSelect(result, selectedImage)}
            disabled={!selectedImage && result.images.length > 0}
            className="w-full bg-[#F5A623] text-white text-sm font-bold py-2.5 rounded-lg hover:bg-[#d8921f] transition-colors disabled:opacity-40"
          >
            폼에 불러오기
          </button>
        </div>
      )}

      {/* hover 이미지 확대 팝업 */}
      {hoverImage && (
        <div
          className="fixed z-[9999] pointer-events-none rounded-xl overflow-hidden shadow-2xl border border-gray-200 bg-white"
          style={{ left: hoverStyle.left, top: hoverStyle.top, width: 320 }}
        >
          <img src={hoverImage} alt="" className="w-full h-auto block" />
        </div>
      )}
    </div>
  );
}