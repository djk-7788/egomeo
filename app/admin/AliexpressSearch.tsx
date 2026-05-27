"use client";

import { useState } from "react";

export type AliProduct = {
  product_id: string;
  title: string;
  images: string[];
  affiliate_link: string;
  platform?: "aliexpress" | "coupang";
};

type Props = {
  onSelect: (product: AliProduct, imageUrl: string) => void;
};

export default function AliexpressSearch({ onSelect }: Props) {
  const [tab, setTab] = useState<"ali" | "coupang">("ali");
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<AliProduct | null>(null);
  const [selectedImage, setSelectedImage] = useState("");
  const [hoverImage, setHoverImage] = useState<string | null>(null);
  const [hoverStyle, setHoverStyle] = useState({ left: 0, top: 0 });

  function switchTab(next: "ali" | "coupang") {
    setTab(next);
    setUrlInput("");
    setError("");
    setSelectedProduct(null);
    setSelectedImage("");
  }

  async function handleLoad(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    setSelectedProduct(null);
    setSelectedImage("");

    try {
      let product: AliProduct;

      if (tab === "ali") {
        const res = await fetch(`/api/aliexpress/parse?url=${encodeURIComponent(trimmed)}`);
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error || "상품 정보를 불러올 수 없습니다.");
        product = { ...json, platform: "aliexpress" as const };
      } else {
        const res = await fetch(`/api/parse-url?url=${encodeURIComponent(trimmed)}`);
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error || "상품 정보를 불러올 수 없습니다.");
        product = {
          product_id: "",
          title: json.title || "",
          images: json.images || [],
          affiliate_link: json.productUrl || trimmed,
          platform: "coupang" as const,
        };
      }

      setSelectedProduct(product);
      setSelectedImage(product.images[0] ?? "");
      setUrlInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleThumbnailEnter(img: string, e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const W = 280;
    const margin = 10;
    let left = rect.left + rect.width / 2 - W / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - W - margin));
    const top = rect.top > W + margin ? rect.top - W - margin : rect.bottom + margin;
    setHoverImage(img);
    setHoverStyle({ left, top });
  }

  const placeholder =
    tab === "ali"
      ? "https://www.aliexpress.com/item/..."
      : "https://www.coupang.com/vp/products/...";

  return (
    <div className="flex" style={{ height: "calc(100vh - 108px)" }}>

      {/* ── 왼쪽: 플랫폼 선택 + URL 입력 ── */}
      <div className="flex-[60] overflow-y-auto px-6 py-5 min-w-0">

        {/* 플랫폼 탭 */}
        <div className="flex border border-gray-200 rounded-xl overflow-hidden w-fit mb-5">
          <button
            type="button"
            onClick={() => switchTab("ali")}
            className={`text-sm font-semibold px-6 py-2.5 transition-colors ${
              tab === "ali"
                ? "bg-[#FF5A00] text-white"
                : "bg-white text-gray-400 hover:text-gray-600"
            }`}
          >
            🛒 알리익스프레스
          </button>
          <button
            type="button"
            onClick={() => switchTab("coupang")}
            className={`text-sm font-semibold px-6 py-2.5 transition-colors ${
              tab === "coupang"
                ? "bg-[#FF5A00] text-white"
                : "bg-white text-gray-400 hover:text-gray-600"
            }`}
          >
            🛍️ 쿠팡
          </button>
        </div>

        {/* URL 입력 */}
        <form onSubmit={handleLoad} className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder={placeholder}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 pr-8 text-sm outline-none focus:border-[#FF5A00] transition-colors"
            />
            {urlInput && (
              <button
                type="button"
                onClick={() => setUrlInput("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                tabIndex={-1}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !urlInput.trim()}
            className="bg-[#FF5A00] text-white text-sm font-bold px-5 py-2.5 rounded-lg hover:bg-[#e04e00] transition-colors disabled:opacity-40 flex-shrink-0"
          >
            {loading ? "로딩 중..." : "불러오기"}
          </button>
        </form>

        {/* 에러 */}
        {error && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* 안내 (idle 상태) */}
        {!selectedProduct && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <p className="text-4xl mb-3">{tab === "ali" ? "🛒" : "🛍️"}</p>
            <p className="text-sm text-gray-400">
              {tab === "ali" ? "알리익스프레스" : "쿠팡"} 상품 URL을 붙여넣으세요.
            </p>
            <p className="text-xs text-gray-300 mt-1">
              불러오기 → 오른쪽에서 이미지 선택 → 폼 불러오기
            </p>
          </div>
        )}

        {/* 로딩 스피너 */}
        {loading && (
          <div className="flex items-center justify-center py-32">
            <div className="w-7 h-7 border-[3px] border-[#FF5A00] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* ── 오른쪽: 이미지 선택 패널 ── */}
      <div className="flex-[40] min-w-[260px] border-l border-gray-100 bg-white overflow-y-auto flex flex-col">
        {!selectedProduct ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <p className="text-4xl mb-3">👈</p>
            <p className="text-sm text-gray-400 font-medium">URL을 불러오면</p>
            <p className="text-sm text-gray-400">여기에 표시됩니다</p>
            <p className="text-xs text-gray-300 mt-2">이미지 선택 후 폼에 불러올 수 있어요</p>
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-4">

            {/* 플랫폼 배지 + 제목 */}
            <div>
              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 ${
                selectedProduct.platform === "coupang"
                  ? "bg-red-100 text-red-600"
                  : "bg-orange-100 text-orange-600"
              }`}>
                {selectedProduct.platform === "coupang" ? "쿠팡" : "알리"}
              </span>
              <p className="text-sm text-[#111111] line-clamp-3 leading-snug">
                {selectedProduct.title}
              </p>
            </div>

            {/* 선택된 이미지 (크게) */}
            {selectedImage && (
              <div className="w-full aspect-square rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                <img src={selectedImage} alt="선택된 이미지" className="w-full h-full object-cover" />
              </div>
            )}

            {/* 썸네일 목록 */}
            {selectedProduct.images.length > 0 && (
              <div>
                <p className="text-[10px] text-gray-400 font-semibold mb-2">
                  이미지 선택 ({selectedProduct.images.length}장)
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {selectedProduct.images.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedImage(img)}
                      onMouseEnter={(e) => handleThumbnailEnter(img, e)}
                      onMouseLeave={() => setHoverImage(null)}
                      className={`w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                        selectedImage === img
                          ? "border-[#FF5A00]"
                          : "border-gray-100 hover:border-gray-300"
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 버튼 */}
            <div className="flex flex-col gap-2 pt-1">
              {selectedProduct.platform === "aliexpress" && selectedProduct.product_id && (
                <a
                  href={`https://www.aliexpress.com/item/${selectedProduct.product_id}.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-center text-sm font-semibold py-2.5 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
                >
                  원본 보기 ↗
                </a>
              )}
              <button
                type="button"
                onClick={() => onSelect(selectedProduct, selectedImage)}
                disabled={!selectedImage}
                className="w-full bg-[#FF5A00] text-white text-sm font-bold py-2.5 rounded-lg hover:bg-[#e04e00] transition-colors disabled:opacity-40"
              >
                폼에 불러오기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* hover 이미지 확대 팝업 */}
      {hoverImage && (
        <div
          className="fixed z-[9999] pointer-events-none rounded-xl overflow-hidden shadow-2xl border border-gray-200 bg-white"
          style={{ left: hoverStyle.left, top: hoverStyle.top, width: 280 }}
        >
          <img src={hoverImage} alt="" className="w-full h-auto block" />
        </div>
      )}
    </div>
  );
}
