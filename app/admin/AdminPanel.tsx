"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { logout } from "./actions";
import AliexpressSearch, { AliProduct } from "./AliexpressSearch";
import UrlParser, { ParsedProduct } from "./UrlParser";
import OrderEditor from "./OrderEditor";

type Product = {
  id: string;
  title: string;
  category: "mild" | "medium" | "hot";
  image_url: string;
  video_url: string | null;
  affiliate_link: string;
  is_active: boolean;
};

type FormState = {
  title: string;
  category: "mild" | "medium" | "hot";
  image_url: string;
  video_url: string;
  affiliate_link: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  title: "",
  category: "mild",
  image_url: "",
  video_url: "",
  affiliate_link: "",
  is_active: true,
};

const categoryLabel = {
  mild: "순한맛",
  medium: "보통맛",
  hot: "매운맛",
};

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<"list" | "order" | "search" | "parse">("list");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [aliHint, setAliHint] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<string>("");

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
    setAliHint("");
    setForm(emptyForm);
    setShowForm(true);
  }

  function handleUrlSelect(product: ParsedProduct, imageUrl: string) {
    setEditing(null);
    setAliHint(product.title);
    setForm({
      ...emptyForm,
      image_url: imageUrl,
      affiliate_link: product.productUrl,
    });
    setShowForm(true);
  }

  function handleAliSelect(product: AliProduct, imageUrl: string) {
    setEditing(null);
    setAliHint(product.title);
    setForm({
      ...emptyForm,
      image_url: imageUrl,
      affiliate_link: product.affiliate_link,
    });
    setShowForm(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setAliHint("");
    setForm({
      title: product.title,
      category: product.category,
      image_url: product.image_url,
      video_url: product.video_url || "",
      affiliate_link: product.affiliate_link,
      is_active: product.is_active,
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      ...form,
      video_url: form.video_url || null,
    };

    const { error } = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);

    setSaving(false);

    if (error) {
      alert("저장 실패: " + error.message);
      return;
    }

    setShowForm(false);
    fetchProducts();
  }

  // 이미지: 서버 API 경유 (Supabase URL 외부 이미지 → R2 저장도 여기서)
  async function uploadImageToR2(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `서버 오류 (${res.status})`);
    return body.url;
  }

  // 영상: presigned URL 시도 → CORS 실패 시 청크 멀티파트로 자동 전환
  async function uploadVideoToR2(file: File): Promise<string> {
    // ── 방법 A: Presigned URL (브라우저 → R2 직접) ─────────────
    try {
      const presignRes = await fetch("/api/upload", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      const presignBody = await presignRes.json().catch(() => ({}));
      if (!presignRes.ok) throw new Error(presignBody.error || `Presign 실패 (${presignRes.status})`);

      const { uploadUrl, publicUrl } = presignBody;
      console.log("[Video Upload] Presigned URL host:", new URL(uploadUrl).hostname);

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) {
        const txt = await uploadRes.text().catch(() => "");
        throw new Error(`R2 직접 업로드 HTTP ${uploadRes.status}: ${txt.slice(0, 200)}`);
      }
      console.log("[Video Upload] Presigned URL 방식 성공");
      return publicUrl;
    } catch (presignErr) {
      console.warn("[Video Upload] Presigned URL 실패, 청크 업로드로 전환:", presignErr);
    }

    // ── 방법 B: 청크 멀티파트 (브라우저 → Vercel → R2) ─────────
    return await uploadVideoInChunks(file);
  }

  // 청크 3.5MB씩 분할 → Vercel API 경유 → R2에 임시 저장 후 서버에서 병합
  async function uploadVideoInChunks(file: File): Promise<string> {
    const CHUNK_SIZE = 3.5 * 1024 * 1024; // 3.5MB

    // 50MB 초과 시 경고
    if (file.size > 50 * 1024 * 1024) {
      const ok = confirm(`영상 크기가 ${(file.size / 1024 / 1024).toFixed(0)}MB입니다.\n50MB 초과 시 업로드 시간이 오래 걸릴 수 있습니다. 계속할까요?`);
      if (!ok) throw new Error("업로드 취소됨");
    }

    // 1. 업로드 ID 발급
    const initRes = await fetch("/api/upload/multipart?action=init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type }),
    });
    const initBody = await initRes.json().catch(() => ({}));
    if (!initRes.ok) throw new Error(initBody.error || "업로드 초기화 실패");
    const { uploadId, key } = initBody as { uploadId: string; key: string };
    console.log("[Chunked Upload] 시작, uploadId:", uploadId);

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let uploadedChunks = 0;

    try {
      // 2. 청크 순서대로 업로드
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const chunk = file.slice(start, start + CHUNK_SIZE);
        const fd = new FormData();
        fd.append("file", chunk, file.name);
        fd.append("uploadId", uploadId);
        fd.append("partNumber", String(i + 1));

        const chunkRes = await fetch("/api/upload/multipart?action=chunk", {
          method: "POST",
          body: fd,
        });
        const chunkBody = await chunkRes.json().catch(() => ({}));
        if (!chunkRes.ok) throw new Error(chunkBody.error || `청크 ${i + 1} 업로드 실패`);
        uploadedChunks++;
        console.log(`[Chunked Upload] 청크 ${i + 1}/${totalChunks} 완료`);
      }

      // 3. 서버에서 병합 → 최종 R2 저장
      const finishRes = await fetch("/api/upload/multipart?action=finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId,
          key,
          numParts: totalChunks,
          contentType: file.type,
        }),
      });
      const finishBody = await finishRes.json().catch(() => ({}));
      if (!finishRes.ok) throw new Error(finishBody.error || "병합 완료 실패");
      console.log("[Chunked Upload] 완료:", finishBody.url);
      return finishBody.url;
    } catch (err) {
      // 실패 시 임시 청크 정리
      fetch("/api/upload/multipart?action=abort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId, numParts: uploadedChunks }),
      }).catch(() => {});
      throw err;
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImageToR2(file);
      setForm((prev) => ({ ...prev, image_url: url }));
    } catch (err) {
      alert("이미지 업로드 실패: " + String(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const url = await uploadVideoToR2(file);
      setForm((prev) => ({ ...prev, video_url: url }));
    } catch (err) {
      alert("영상 업로드 실패: " + String(err));
    } finally {
      setUploadingVideo(false);
    }
  }

  async function handleToggleActive(id: string, current: boolean) {
    await supabase.from("products").update({ is_active: !current }).eq("id", id);
    fetchProducts();
  }

  async function handleDelete(id: string) {
    if (!confirm("정말 삭제할까요?")) return;
    await supabase.from("products").delete().eq("id", id);
    fetchProducts();
  }

  async function handleMigrateToR2() {
    if (!confirm("Supabase Storage에 저장된 이미지 40개를 R2로 이전합니다. 계속할까요?")) return;
    setMigrating(true);
    setMigrateResult("");
    try {
      const res = await fetch("/api/migrate-to-r2", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMigrateResult(`완료: ${data.migrated}개 성공, ${data.failed}개 실패 (전체 ${data.total}개)`);
      if (data.migrated > 0) fetchProducts();
    } catch (err) {
      setMigrateResult("오류: " + String(err));
    } finally {
      setMigrating(false);
    }
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

      {/* 탭 */}
      <div className="bg-white border-b border-gray-100 px-6 flex gap-0">
        <button
          onClick={() => setActiveTab("list")}
          className={`text-sm font-semibold px-4 py-3 border-b-2 transition-colors ${
            activeTab === "list"
              ? "border-[#FF5A00] text-[#FF5A00]"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          상품 목록
        </button>
        <button
          onClick={() => setActiveTab("order")}
          className={`text-sm font-semibold px-4 py-3 border-b-2 transition-colors ${
            activeTab === "order"
              ? "border-[#FF5A00] text-[#FF5A00]"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          순서 편집
        </button>
        <button
          onClick={() => setActiveTab("search")}
          className={`text-sm font-semibold px-4 py-3 border-b-2 transition-colors ${
            activeTab === "search"
              ? "border-[#FF5A00] text-[#FF5A00]"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          🛍️ 알리익스프레스 검색
        </button>
        <button
          onClick={() => setActiveTab("parse")}
          className={`text-sm font-semibold px-4 py-3 border-b-2 transition-colors ${
            activeTab === "parse"
              ? "border-[#FF5A00] text-[#FF5A00]"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          🔗 URL 파싱 (쿠팡/아마존)
        </button>
      </div>

      {/* 순서 편집 탭 */}
      {activeTab === "order" && <OrderEditor />}

      {/* 알리익스프레스 검색 탭 */}
      {activeTab === "search" && (
        <AliexpressSearch onSelect={handleAliSelect} />
      )}

      {/* URL 파싱 탭 */}
      {activeTab === "parse" && (
        <UrlParser onSelect={handleUrlSelect} />
      )}

      {/* 상품 목록 탭 */}
      {activeTab === "list" && (
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* 마이그레이션 버튼 */}
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={handleMigrateToR2}
            disabled={migrating}
            className="text-xs font-semibold px-3 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            {migrating ? "마이그레이션 중..." : "☁️ Supabase → R2 마이그레이션"}
          </button>
          {migrateResult && (
            <span className="text-xs text-gray-500">{migrateResult}</span>
          )}
        </div>

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
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">미디어</th>
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
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {product.video_url ? "🎥 영상+이미지" : "🖼️ 이미지"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(product.id, product.is_active)}
                        className={`text-xs font-semibold px-2 py-1 rounded-full transition-colors ${
                          product.is_active
                            ? "bg-green-100 text-green-600 hover:bg-green-200"
                            : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                        }`}
                      >
                        {product.is_active ? "노출 중" : "숨김"}
                      </button>
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
      )}

      {/* 등록/수정 모달 */}
      {showForm && (
        <>
          {/* 배경 — 클릭 시 닫기 */}
          <div
            className="fixed inset-0 bg-black/40 z-50"
            onClick={() => setShowForm(false)}
          />
          {/* 모달 본체 */}
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg px-4">
          <div
            className="bg-white rounded-2xl shadow-xl flex flex-col"
            style={{ maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h2 className="font-black text-[#111111]">
                {editing ? "상품 수정" : "상품 추가"}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
              {/* 알리에서 불러온 경우 원본 상품명 참고 표시 */}
              {aliHint && (
                <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                  <p className="text-[10px] font-semibold text-orange-400 mb-0.5">알리 원본 상품명 (참고용)</p>
                  <p className="text-xs text-orange-700 line-clamp-2">{aliHint}</p>
                </div>
              )}
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

              {/* 이미지 업로드 */}
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
                        <span className="text-xs text-gray-300 mt-1">JPG, PNG, WEBP → R2 저장</span>
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

              {/* 동영상 업로드 (선택) */}
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">
                  상품 영상 <span className="font-normal text-gray-400">(선택 — 있으면 카드에서 영상으로 표시)</span>
                </label>
                {form.video_url ? (
                  <div className="relative w-full rounded-lg overflow-hidden border border-gray-200 bg-black">
                    <video
                      src={form.video_url}
                      className="w-full max-h-40 object-contain"
                      controls
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, video_url: "" })}
                      className="absolute top-2 right-2 bg-white/90 text-gray-600 rounded-full w-7 h-7 flex items-center justify-center text-xs hover:bg-white shadow"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-[#FF5A00] transition-colors">
                    {uploadingVideo ? (
                      <span className="text-sm text-gray-400">업로드 중...</span>
                    ) : (
                      <>
                        <span className="text-2xl mb-1">🎥</span>
                        <span className="text-sm text-gray-400">클릭하여 영상 선택</span>
                        <span className="text-xs text-gray-300 mt-1">MP4, MOV, WEBM → R2 저장</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={handleVideoUpload}
                      disabled={uploadingVideo}
                    />
                  </label>
                )}
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
                  disabled={saving || uploading || uploadingVideo}
                  className="flex-1 bg-[#FF5A00] text-white text-sm font-bold py-2.5 rounded-lg hover:bg-[#e04e00] transition-colors disabled:opacity-50"
                >
                  {uploading ? "이미지 업로드 중..." : uploadingVideo ? "영상 업로드 중..." : saving ? "저장 중..." : editing ? "수정 완료" : "추가 완료"}
                </button>
              </div>
            </form>
          </div>
          </div>
        </>
      )}
    </div>
  );
}
