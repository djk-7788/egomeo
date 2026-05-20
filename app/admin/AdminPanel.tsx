"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { logout } from "./actions";

type Product = {
  id: string;
  title: string;
  category: "mild" | "medium" | "hot";
  image_url: string;
  price: string;
  affiliate_link: string;
  is_active: boolean;
};

type FormState = {
  title: string;
  category: "mild" | "medium" | "hot";
  image_url: string;
  price: string;
  affiliate_link: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  title: "",
  category: "mild",
  image_url: "",
  price: "",
  affiliate_link: "",
  is_active: true,
};

const categoryLabel = {
  mild: "순한맛",
  medium: "보통맛",
  hot: "매운맛",
};

export default function AdminPanel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    setProducts(data || []);
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      title: product.title,
      category: product.category,
      image_url: product.image_url,
      price: product.price,
      affiliate_link: product.affiliate_link,
      is_active: product.is_active,
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { error } = editing
      ? await supabase.from("products").update(form).eq("id", editing.id)
      : await supabase.from("products").insert(form);

    setSaving(false);

    if (error) {
      alert("저장 실패: " + error.message);
      return;
    }

    setShowForm(false);
    fetchProducts();
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("product-images")
      .upload(fileName, file);

    if (error) {
      alert("업로드 실패: " + error.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("product-images")
      .getPublicUrl(fileName);

    setForm((prev) => ({ ...prev, image_url: publicUrl }));
    setUploading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("정말 삭제할까요?")) return;
    await supabase.from("products").delete().eq("id", id);
    fetchProducts();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-black text-[#111111]">이게머고? 관리자</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={openAdd}
            className="bg-[#FF5A00] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#e04e00] transition-colors"
          >
            + 상품 추가
          </button>
          <form action={logout}>
            <button
              type="submit"
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              로그아웃
            </button>
          </form>
        </div>
      </div>

      {/* 상품 목록 */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-center text-gray-400 py-20">불러오는 중...</p>
        ) : products.length === 0 ? (
          <p className="text-center text-gray-400 py-20">
            등록된 상품이 없습니다.
          </p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">제목</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">카테고리</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">가격</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">노출</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-[#111111] max-w-xs truncate">
                      {product.title}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {categoryLabel[product.category]}
                    </td>
                    <td className="px-4 py-3 text-[#FF5A00] font-bold">
                      {product.price}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          product.is_active
                            ? "bg-green-100 text-green-600"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {product.is_active ? "노출" : "숨김"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <a
                          href={`/product/${product.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-600 transition-colors px-2 py-1 border border-blue-100 rounded"
                        >
                          미리보기
                        </a>
                        <button
                          onClick={() => openEdit(product)}
                          className="text-xs text-gray-500 hover:text-[#111111] transition-colors px-2 py-1 border border-gray-200 rounded"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-1 border border-red-100 rounded"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 등록/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black text-[#111111]">
                {editing ? "상품 수정" : "상품 추가"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">
                  드립형 제목
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  placeholder="이게 뭔지 설명하면 내가 짐"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#FF5A00] transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">
                  카테고리
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value as "mild" | "medium" | "hot" })
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#FF5A00] transition-colors"
                >
                  <option value="mild">순한맛 — 이게 머고?</option>
                  <option value="medium">보통맛 — 이게? 머고???</option>
                  <option value="hot">매운맛 — 이게??? 머고???????</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">
                  상품 이미지
                </label>
                {form.image_url ? (
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-gray-200">
                    <img
                      src={form.image_url}
                      alt="미리보기"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, image_url: "" })}
                      className="absolute top-2 right-2 bg-white/90 text-gray-600 rounded-full w-7 h-7 flex items-center justify-center text-xs hover:bg-white shadow"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-[#FF5A00] transition-colors">
                    {uploading ? (
                      <span className="text-sm text-gray-400">업로드 중...</span>
                    ) : (
                      <>
                        <span className="text-2xl mb-1">📷</span>
                        <span className="text-sm text-gray-400">클릭하여 이미지 선택</span>
                        <span className="text-xs text-gray-300 mt-1">JPG, PNG, WEBP</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">
                  가격
                </label>
                <input
                  type="text"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                  placeholder="₩32,900"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#FF5A00] transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">
                  제휴 링크 (쿠팡/알리)
                </label>
                <input
                  type="url"
                  value={form.affiliate_link}
                  onChange={(e) => setForm({ ...form, affiliate_link: e.target.value })}
                  required
                  placeholder="https://..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#FF5A00] transition-colors"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="accent-[#FF5A00]"
                />
                <label htmlFor="is_active" className="text-sm text-gray-600">
                  메인 페이지에 노출
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-200 text-gray-500 text-sm font-semibold py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="flex-1 bg-[#FF5A00] text-white text-sm font-bold py-2.5 rounded-lg hover:bg-[#e04e00] transition-colors disabled:opacity-50"
                >
                  {uploading ? "이미지 업로드 중..." : saving ? "저장 중..." : editing ? "수정 완료" : "추가 완료"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
