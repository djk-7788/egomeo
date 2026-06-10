"use client";

import { useState, useEffect, useRef } from "react";

type SnsProduct = {
  id: string;
  title: string;
  image_url: string;
  image_urls: string[] | null;
  video_url: string | null;
  platform: string | null;
  button_text: string | null;
  queue_status: "pending" | "failed" | "published" | null;
};

type QueueItem = {
  id: string;
  product_id: string;
  channel: string;
  post_text: string;
  comment_text: string | null;
  image_url: string | null;
  media_type: "video" | "image" | "text" | null;
  status: "pending" | "failed";
  error_message: string | null;
  scheduled_order: number;
  published_at: string | null;
  created_at: string;
  products: {
    title: string;
    image_url: string;
    image_urls: string[] | null;
    video_url: string | null;
  } | null;
};

const PLATFORM_BADGE: Record<string, string> = {
  amazon_jp: "🇯🇵 아마존JP",
  aliexpress: "알리",
  coupang: "쿠팡",
  klook: "🎫 클룩",
  etc: "🌐",
};

const PLATFORM_COLOR: Record<string, string> = {
  amazon_jp: "bg-indigo-100 text-indigo-700",
  aliexpress: "bg-orange-100 text-orange-700",
  coupang: "bg-red-100 text-red-700",
  klook: "bg-purple-100 text-purple-700",
  etc: "bg-gray-100 text-gray-600",
};

const SITE_URL = "https://www.igemugo.com";

function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(mp4|mov|webm|avi|m4v)(\?.*)?$/i.test(url);
}

function resolveMediaType(
  imageUrl: string | null,
  videoUrl: string | null | undefined
): "video" | "image" | "text" {
  if (imageUrl === null) return "text";
  if (videoUrl && imageUrl === videoUrl) return "video";
  return "image";
}

function buildDefaultPostText(product: SnsProduct): string {
  return product.title;
}

function buildDefaultCommentText(product: SnsProduct): string {
  const btn = product.button_text?.trim() || "구경하러 가기";
  return `${btn}\n${SITE_URL}/product/${product.id}?ref=threads`;
}

export default function SnsPublisher() {
  const [products, setProducts] = useState<SnsProduct[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // 큐 추가 모달
  const [addProduct, setAddProduct] = useState<SnsProduct | null>(null);
  const [addText, setAddText] = useState("");
  const [addCommentText, setAddCommentText] = useState("");
  const [addImageUrl, setAddImageUrl] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // 편집 모달
  const [editItem, setEditItem] = useState<QueueItem | null>(null);
  const [editText, setEditText] = useState("");
  const [editCommentText, setEditCommentText] = useState("");
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 드래그
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragIdxRef = useRef<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [savedOrder, setSavedOrder] = useState(false);
  const [orderChanged, setOrderChanged] = useState(false);

  // 삭제/재시도
  const [deleting, setDeleting] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  // 테스트 발행
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    fetchProducts();
    fetchQueue();
  }

  async function fetchProducts() {
    setLoadingProducts(true);
    try {
      const res = await fetch("/api/admin/sns-queue?type=products");
      if (res.status === 401) throw new Error("인증 만료");
      const { data } = await res.json();
      setProducts(data ?? []);
    } catch (err) {
      console.error("[SnsPublisher] fetchProducts:", err);
    } finally {
      setLoadingProducts(false);
    }
  }

  async function fetchQueue() {
    setLoadingQueue(true);
    try {
      const res = await fetch("/api/admin/sns-queue?type=queue");
      if (res.status === 401) throw new Error("인증 만료");
      const { data } = await res.json();
      setQueueItems(data ?? []);
      setOrderChanged(false);
    } catch (err) {
      console.error("[SnsPublisher] fetchQueue:", err);
    } finally {
      setLoadingQueue(false);
    }
  }

  // ── 큐 추가 ──────────────────────────────────────

  function openAddModal(product: SnsProduct) {
    setAddProduct(product);
    setAddText(buildDefaultPostText(product));
    setAddCommentText(buildDefaultCommentText(product));
    // 영상이 있으면 기본값으로 영상 선택, 없으면 대표 이미지
    setAddImageUrl(product.video_url ?? product.image_url ?? null);
  }

  function closeAddModal() {
    setAddProduct(null);
    setAddText("");
    setAddCommentText("");
    setAddImageUrl(null);
  }

  async function handleAddToQueue() {
    if (!addProduct) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/sns-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: addProduct.id,
          post_text: addText,
          comment_text: addCommentText.trim() || null,
          image_url: addImageUrl || null,
          media_type: resolveMediaType(addImageUrl, addProduct.video_url),
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        alert("추가 실패: " + (error || "알 수 없는 오류"));
        return;
      }
      closeAddModal();
      fetchAll();
    } finally {
      setAdding(false);
    }
  }

  // ── 편집 ─────────────────────────────────────────

  function openEditModal(item: QueueItem) {
    setEditItem(item);
    setEditText(item.post_text);
    setEditCommentText(item.comment_text ?? "");
    setEditImageUrl(item.image_url);
  }

  function closeEditModal() {
    setEditItem(null);
    setEditText("");
    setEditCommentText("");
    setEditImageUrl(null);
  }

  async function handleEditSave() {
    if (!editItem) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/sns-queue", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editItem.id,
          post_text: editText,
          comment_text: editCommentText.trim() || null,
          image_url: editImageUrl || null,
          media_type: resolveMediaType(editImageUrl, editItem.products?.video_url),
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        alert("수정 실패: " + (error || "알 수 없는 오류"));
        return;
      }
      closeEditModal();
      fetchQueue();
    } finally {
      setSaving(false);
    }
  }

  // ── 삭제 / 재시도 ─────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm("이 항목을 큐에서 삭제할까요?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/admin/sns-queue?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      fetchAll();
    } finally {
      setDeleting(null);
    }
  }

  async function handleRetry(id: string) {
    setRetrying(id);
    try {
      await fetch("/api/admin/sns-queue", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "pending", error_message: null }),
      });
      fetchQueue();
    } finally {
      setRetrying(null);
    }
  }

  // ── 드래그 순서 변경 ───────────────────────────────

  function handleDragStart(index: number) {
    dragIdxRef.current = index;
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragOverIdx !== index) setDragOverIdx(index);
  }

  function handleDrop(targetIndex: number) {
    const from = dragIdxRef.current;
    if (from === null || from === targetIndex) {
      setDragOverIdx(null);
      return;
    }
    const newItems = [...queueItems];
    const [moved] = newItems.splice(from, 1);
    newItems.splice(targetIndex, 0, moved);
    setQueueItems(newItems);
    setDragOverIdx(null);
    dragIdxRef.current = null;
    setOrderChanged(true);
    setSavedOrder(false);
  }

  function handleDragEnd() {
    setDragOverIdx(null);
    dragIdxRef.current = null;
  }

  async function handleSaveOrder() {
    setSavingOrder(true);
    const updates = queueItems.map((item, i) => ({
      id: item.id,
      scheduled_order: i + 1,
    }));
    const res = await fetch("/api/admin/sns-queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    setSavingOrder(false);
    if (res.ok) {
      setSavedOrder(true);
      setOrderChanged(false);
      setTimeout(() => setSavedOrder(false), 2500);
    } else {
      alert("순서 저장 실패");
    }
  }

  // ── 테스트 발행 ────────────────────────────────────

  async function handleTestPublish() {
    if (
      !confirm(
        "지금 즉시 큐에서 1개를 발행합니다.\n(이미지 처리 + Threads 30초 대기로 약 40초 소요)\n계속할까요?"
      )
    )
      return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/cron/sns-publish", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      setTestResult({
        ok: res.ok,
        msg: res.ok
          ? (body.message ?? "발행 완료 ✓")
          : (body.error ?? "발행 실패"),
      });
      fetchAll();
    } catch (err) {
      setTestResult({ ok: false, msg: String(err) });
    } finally {
      setTesting(false);
    }
  }

  // ── 계산값 ────────────────────────────────────────

  const pendingCount = queueItems.filter((i) => i.status === "pending").length;
  const filteredProducts = searchQuery
    ? products.filter((p) =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : products;

  // ── 렌더 ─────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center gap-4 mb-5">
        <div>
          <h2 className="text-base font-black text-[#111111]">SNS 발행 큐</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            대기{" "}
            <span className="font-bold text-amber-500">{pendingCount}개</span>
            {pendingCount > 0 && (
              <span className="ml-1">
                (약 {Math.ceil(pendingCount / 2)}일치)
              </span>
            )}
            <span className="ml-2 text-gray-300">
              · 자동 발행 11:30 / 19:30 KST
            </span>
          </p>
        </div>
        <div className="ml-auto">
          <button
            onClick={handleTestPublish}
            disabled={testing}
            className="text-sm font-bold px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {testing ? "발행 중... (약 40초)" : "⚡ 지금 1개 발행 (테스트)"}
          </button>
        </div>
      </div>

      {testResult && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm font-semibold ${
            testResult.ok
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {testResult.msg}
        </div>
      )}

      {/* 2열 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 items-start">
        {/* 왼쪽: 상품 선택 */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#111111]">상품 선택</h3>
            <span className="text-xs text-gray-400">
              SNS 발행 가능 {products.length}개
            </span>
          </div>

          <div className="relative mb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="제목 검색..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#F5A623] transition-colors pr-8"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {loadingProducts ? (
            <p className="text-center text-gray-400 py-12 text-sm">
              불러오는 중...
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => openAddModal(product)}
                  className="group text-left bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-[#F5A623] hover:shadow-sm transition-all"
                >
                  <div className="aspect-square bg-gray-100 relative overflow-hidden">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">
                        🎬
                      </div>
                    )}
                    {product.queue_status === "pending" && (
                      <span className="absolute top-1 right-1 text-[9px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                        ⏳ 대기중
                      </span>
                    )}
                    {product.queue_status === "failed" && (
                      <span className="absolute top-1 right-1 text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                        ⚠️ 실패
                      </span>
                    )}
                    {product.queue_status === "published" && (
                      <span className="absolute top-1 right-1 text-[9px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                        ✅ 발행됨
                      </span>
                    )}
                  </div>
                  <div className="px-2 pt-1.5 pb-2">
                    <p className="text-[11px] font-semibold text-[#111111] line-clamp-2 leading-tight">
                      {product.title}
                    </p>
                    {product.platform && PLATFORM_BADGE[product.platform] && (
                      <span
                        className={`mt-1 inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          PLATFORM_COLOR[product.platform] ??
                          "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {PLATFORM_BADGE[product.platform]}
                      </span>
                    )}
                  </div>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <p className="col-span-3 text-center text-gray-400 py-12 text-sm">
                  {searchQuery
                    ? `"${searchQuery}"에 대한 결과 없음`
                    : "표시할 상품 없음"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 오른쪽: 발행 큐 */}
        <div className="lg:sticky lg:top-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#111111]">
              발행 큐{" "}
              <span className="text-xs font-normal text-gray-400">
                ({queueItems.length}개)
              </span>
            </h3>
            {orderChanged && (
              <button
                onClick={handleSaveOrder}
                disabled={savingOrder}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                  savedOrder
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 text-[#111111] hover:bg-gray-200"
                }`}
              >
                {savingOrder ? "저장 중..." : savedOrder ? "저장됨 ✓" : "순서 저장"}
              </button>
            )}
          </div>

          {loadingQueue ? (
            <p className="text-center text-gray-400 py-8 text-sm">
              불러오는 중...
            </p>
          ) : queueItems.length === 0 ? (
            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center">
              <p className="text-sm text-gray-400">큐가 비어있습니다</p>
              <p className="text-xs text-gray-300 mt-1">
                왼쪽 상품을 클릭해 추가하세요
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {queueItems.map((item, idx) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={handleDragEnd}
                  className={`rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all border ${
                    dragOverIdx === idx
                      ? "border-[#F5A623] shadow-md scale-[1.01]"
                      : item.status === "failed"
                      ? "border-red-200 bg-red-50"
                      : "bg-white border-gray-100 hover:border-gray-200"
                  }`}
                >
                  <div className="flex gap-2 items-start">
                    <span className="text-xs font-bold text-gray-300 pt-1 w-4 flex-shrink-0 text-right">
                      {idx + 1}
                    </span>
                    <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                      {item.media_type === "video" ? (
                        <div className="w-full h-full flex items-center justify-center text-base bg-gray-900">
                          🎬
                        </div>
                      ) : item.image_url ? (
                        <img
                          src={item.image_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-base">
                          📝
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#111111] truncate">
                        {item.products?.title ?? "—"}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2 leading-tight">
                        {item.post_text}
                      </p>
                      {item.status === "failed" && item.error_message && (
                        <p className="text-[10px] text-red-500 mt-1 line-clamp-2">
                          ⚠️ {item.error_message}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {item.status === "failed" && (
                        <button
                          onClick={() => handleRetry(item.id)}
                          disabled={retrying === item.id}
                          className="text-[10px] font-bold px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors disabled:opacity-50"
                        >
                          {retrying === item.id ? "..." : "재시도"}
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(item)}
                        className="text-[10px] font-semibold px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                      >
                        편집
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deleting === item.id}
                        className="text-[10px] font-semibold px-2 py-1 bg-gray-50 text-red-400 rounded hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                      >
                        {deleting === item.id ? "..." : "삭제"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 큐 추가 모달 ─────────────────────────────── */}
      {addProduct && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg px-4">
            <div
              className="bg-white rounded-2xl shadow-xl flex flex-col"
              style={{ maxHeight: "90vh" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <div className="min-w-0">
                  <h2 className="font-black text-[#111111] text-sm">
                    큐에 추가
                  </h2>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {addProduct.title}
                  </p>
                </div>
                <button
                  onClick={closeAddModal}
                  className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-4"
                >
                  ✕
                </button>
              </div>
              <div className="px-6 py-4 flex flex-col gap-4 overflow-y-auto">
                {/* 이미지/영상 선택 */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-2">
                    미디어 선택
                  </label>
                  {!addProduct.video_url &&
                  !addProduct.image_url &&
                  !(addProduct.image_urls?.length) ? (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      이미지/영상 없음 — 텍스트만 발행됩니다
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {/* 영상 옵션 (기본값) */}
                      {addProduct.video_url && (
                        <button
                          type="button"
                          onClick={() => setAddImageUrl(addProduct.video_url!)}
                          className={`w-16 h-16 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                            addImageUrl === addProduct.video_url
                              ? "border-[#F5A623] shadow bg-amber-50"
                              : "border-gray-200 bg-gray-900 hover:border-gray-400"
                          }`}
                        >
                          <span className="text-xl leading-none">🎬</span>
                          <span className="text-[9px] font-bold text-white mt-0.5">
                            영상
                          </span>
                        </button>
                      )}
                      {/* 대표 이미지 */}
                      {addProduct.image_url && (
                        <button
                          type="button"
                          onClick={() => setAddImageUrl(addProduct.image_url)}
                          className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                            addImageUrl === addProduct.image_url
                              ? "border-[#F5A623] shadow"
                              : "border-gray-200 hover:border-gray-400"
                          }`}
                        >
                          <img
                            src={addProduct.image_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </button>
                      )}
                      {/* 추가 이미지 */}
                      {addProduct.image_urls?.map((url) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setAddImageUrl(url)}
                          className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                            addImageUrl === url
                              ? "border-[#F5A623] shadow"
                              : "border-gray-200 hover:border-gray-400"
                          }`}
                        >
                          <img
                            src={url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                      {/* 텍스트만 */}
                      <button
                        type="button"
                        onClick={() => setAddImageUrl(null)}
                        className={`w-16 h-16 rounded-lg border-2 flex items-center justify-center transition-all ${
                          addImageUrl === null
                            ? "border-[#F5A623] text-[#F5A623]"
                            : "border-gray-200 text-gray-400 hover:border-gray-400"
                        }`}
                      >
                        <span className="text-[10px] font-semibold text-center leading-tight px-1">
                          텍스트만
                        </span>
                      </button>
                    </div>
                  )}
                </div>
                {/* 본문 */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-2">
                    본문
                  </label>
                  <textarea
                    value={addText}
                    onChange={(e) => setAddText(e.target.value)}
                    rows={4}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#F5A623] transition-colors resize-none"
                    placeholder="본문 내용..."
                  />
                  <p className="text-xs text-gray-300 mt-1 text-right">
                    {addText.length}자
                  </p>
                </div>
                {/* 댓글 */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-2">
                    댓글{" "}
                    <span className="font-normal text-gray-400">
                      (비워두면 댓글 없이 발행)
                    </span>
                  </label>
                  <textarea
                    value={addCommentText}
                    onChange={(e) => setAddCommentText(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#F5A623] transition-colors resize-none"
                    placeholder="버튼 문구 + 링크..."
                  />
                  <p className="text-xs text-gray-300 mt-1 text-right">
                    {addCommentText.length}자
                  </p>
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={closeAddModal}
                    className="flex-1 border border-gray-200 text-gray-500 text-sm font-semibold py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleAddToQueue}
                    disabled={adding || !addText.trim()}
                    className="flex-1 bg-[#F5A623] text-white text-sm font-bold py-2.5 rounded-lg hover:bg-[#d8921f] transition-colors disabled:opacity-50"
                  >
                    {adding ? "추가 중..." : "큐에 추가"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── 편집 모달 ─────────────────────────────────── */}
      {editItem && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg px-4">
            <div
              className="bg-white rounded-2xl shadow-xl flex flex-col"
              style={{ maxHeight: "90vh" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <div className="min-w-0">
                  <h2 className="font-black text-[#111111] text-sm">
                    발행 항목 편집
                  </h2>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {editItem.products?.title ?? "—"}
                  </p>
                </div>
                <button
                  onClick={closeEditModal}
                  className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-4"
                >
                  ✕
                </button>
              </div>
              <div className="px-6 py-4 flex flex-col gap-4 overflow-y-auto">
                {/* 미디어 선택 */}
                {editItem.products &&
                  (editItem.products.video_url ||
                    editItem.products.image_url ||
                    (editItem.products.image_urls?.length ?? 0) > 0) && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-2">
                        미디어 선택
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {/* 영상 옵션 */}
                        {editItem.products.video_url && (
                          <button
                            type="button"
                            onClick={() =>
                              setEditImageUrl(editItem.products!.video_url!)
                            }
                            className={`w-16 h-16 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                              editImageUrl === editItem.products.video_url
                                ? "border-[#F5A623] shadow bg-amber-50"
                                : "border-gray-200 bg-gray-900 hover:border-gray-400"
                            }`}
                          >
                            <span className="text-xl leading-none">🎬</span>
                            <span className="text-[9px] font-bold text-white mt-0.5">
                              영상
                            </span>
                          </button>
                        )}
                        {editItem.products.image_url && (
                          <button
                            type="button"
                            onClick={() =>
                              setEditImageUrl(editItem.products!.image_url)
                            }
                            className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                              editImageUrl === editItem.products.image_url
                                ? "border-[#F5A623] shadow"
                                : "border-gray-200 hover:border-gray-400"
                            }`}
                          >
                            <img
                              src={editItem.products.image_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </button>
                        )}
                        {editItem.products.image_urls?.map((url) => (
                          <button
                            key={url}
                            type="button"
                            onClick={() => setEditImageUrl(url)}
                            className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                              editImageUrl === url
                                ? "border-[#F5A623] shadow"
                                : "border-gray-200 hover:border-gray-400"
                            }`}
                          >
                            <img
                              src={url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setEditImageUrl(null)}
                          className={`w-16 h-16 rounded-lg border-2 flex items-center justify-center transition-all ${
                            editImageUrl === null
                              ? "border-[#F5A623] text-[#F5A623]"
                              : "border-gray-200 text-gray-400 hover:border-gray-400"
                          }`}
                        >
                          <span className="text-[10px] font-semibold text-center leading-tight px-1">
                            텍스트만
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                {/* 본문 */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-2">
                    본문
                  </label>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={4}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#F5A623] transition-colors resize-none"
                  />
                  <p className="text-xs text-gray-300 mt-1 text-right">
                    {editText.length}자
                  </p>
                </div>
                {/* 댓글 */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-2">
                    댓글{" "}
                    <span className="font-normal text-gray-400">
                      (비워두면 댓글 없이 발행)
                    </span>
                  </label>
                  <textarea
                    value={editCommentText}
                    onChange={(e) => setEditCommentText(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#F5A623] transition-colors resize-none"
                    placeholder="버튼 문구 + 링크..."
                  />
                  <p className="text-xs text-gray-300 mt-1 text-right">
                    {editCommentText.length}자
                  </p>
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="flex-1 border border-gray-200 text-gray-500 text-sm font-semibold py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleEditSave}
                    disabled={saving || !editText.trim()}
                    className="flex-1 bg-[#F5A623] text-white text-sm font-bold py-2.5 rounded-lg hover:bg-[#d8921f] transition-colors disabled:opacity-50"
                  >
                    {saving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
