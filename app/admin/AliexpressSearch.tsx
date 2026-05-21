"use client";

import { useState } from "react";

export type AliProduct = {
  product_id: string;
  title: string;
  image_url: string;
  price: string;
  affiliate_link: string;
};

type Props = {
  onSelect: (product: AliProduct) => void;
};

export default function AliexpressSearch({ onSelect }: Props) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<AliProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim()) return;

    setLoading(true);
    setError("");
    setSearched(true);

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
          <p className="text-gray-300 text-xs mt-1">상품을 클릭하면 등록 폼에 자동으로 채워집니다.</p>
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
            {results.length}개 상품 검색됨 — 클릭하면 등록 폼에 자동 입력됩니다
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {results.map((product) => (
              <button
                key={product.product_id}
                onClick={() => onSelect(product)}
                className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-[#FF5A00] hover:shadow-md transition-all text-left group"
              >
                <div className="aspect-square overflow-hidden bg-gray-50">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
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
                  <p className="text-[10px] text-gray-300 mt-1.5">클릭하여 폼에 불러오기</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
