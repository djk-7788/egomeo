"use client";

import { useState } from "react";

export type AliProduct = {
  product_id: string;
  title: string;
  images: string[];
  price: string;
  affiliate_link: string;
};

type Props = {
  onSelect: (product: AliProduct, imageUrl: string) => void;
};

export default function AliexpressSearch({ onSelect }: Props) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<AliProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<AliProduct | null>(null);
  const [selectedImage, setSelectedImage] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim()) return;

    setLoading(true);
    setError("");
    setSearched(true);
    setSelectedProduct(null);
    setSelectedImage("");

    try {
      const res = await fetch(`/api/aliexpress/search?keyword=${encodeURIComponent(keyword.trim())}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "검색 중 오류가 발생했습니다.");
        setResults([]);
      } else {
        setResults(data.products ?? []);
        if ((data.products ?? []).length === 0) {
          setError("검색 결과가 없습니다. 다른 키워드로 시도해보세요.");
        }
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleProductClick(product: AliProduct) {
    setSelectedProduct(product);
    setSelectedImage(product.images[0] ?? "");
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* 검색창 */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="검색 키워드 입력 (예: mini fridge, cat lamp, led strip)"
          className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#FF5A00] transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !keyword.trim()}
          className="bg-[#FF5A00] text-white text-sm font-bold px-6 py-2.5 rounded-lg hover:bg-[#e04e00] transition-colors disabled:opacity-40"
        >
          {loading ? "검색 중..." : "검색"}
        </button>
      </form>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {/* 검색 전 안내 */}
      {!searched && !loading && (
        <div className="text-center py-20">
          <p className="text-3xl mb-3">🛍️</p>
          <p className="text-gray-400 text-sm">키워드로 알리익스프레스 상품을 검색하세요.</p>
          <p className="text-gray-300 text-xs mt-1">상품 선택 → 이미지 선택 → 폼 자동입력</p>
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="text-center py-20">
          <p className="text-gray-400 text-sm">상품 검색 중...</p>
        </div>
      )}

      {/* 결과 그리드 */}
      {!loading && results.length > 0 && (
        <>
          <p className="text-xs text-gray-400 mb-4">
            {results.length}개 상품 검색됨 — 상품 클릭 후 이미지를 선택하세요
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {results.map((product) => {
              const isSelected = selectedProduct?.product_id === product.product_id;
              return (
                <button
                  key={product.product_id}
                  onClick={() => handleProductClick(product)}
                  className={`bg-white rounded-xl overflow-hidden transition-all text-left group border-2 ${
                    isSelected
                      ? "border-[#FF5A00] shadow-md"
                      : "border-transparent hover:border-[#FF5A00] hover:shadow-md"
                  }`}
                >
                  <div className="aspect-square overflow-hidden bg-gray-50">
                    {product.images[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">
                        📦
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-[#111111] line-clamp-2 mb-1.5 leading-snug">
                      {product.title}
                    </p>
                    <p className="text-sm font-bold text-[#FF5A00]">{product.price}</p>
                    <p className={`text-[10px] mt-1.5 ${isSelected ? "text-[#FF5A00] font-semibold" : "text-gray-300"}`}>
                      {isSelected ? "✓ 선택됨" : "클릭하여 선택"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 이미지 선택 패널 */}
          {selectedProduct && (
            <div className="mt-6 bg-white border-2 border-[#FF5A00] rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-[10px] font-semibold text-[#FF5A00] mb-1">이미지 선택</p>
                  <p className="text-xs text-gray-600 line-clamp-1">{selectedProduct.title}</p>
                </div>
                <button
                  onClick={() => onSelect(selectedProduct, selectedImage)}
                  disabled={!selectedImage}
                  className="bg-[#FF5A00] text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-[#e04e00] transition-colors disabled:opacity-40 flex-shrink-0"
                >
                  폼에 불러오기
                </button>
              </div>

              {/* 썸네일 목록 */}
              <div className="flex gap-2 flex-wrap">
                {selectedProduct.images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedImage(img)}
                    className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                      selectedImage === img
                        ? "border-[#FF5A00]"
                        : "border-gray-100 hover:border-gray-300"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>

              {/* 선택된 이미지 미리보기 */}
              {selectedImage && (
                <div className="mt-4 flex items-center gap-3">
                  <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-100 flex-shrink-0">
                    <img src={selectedImage} alt="선택된 이미지" className="w-full h-full object-cover" />
                  </div>
                  <p className="text-xs text-gray-400">선택된 이미지 — 위 썸네일을 클릭해서 변경하세요</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
