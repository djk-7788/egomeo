"use client";

import { useState, useEffect, useRef } from "react";

type QueueItem = {
  id: string;
  title: string;
  image_url: string;
  image_urls: string[] | null;
  video_url: string | null;
  sort_order: number | null;
  created_at: string;
  platform: string | null;
};

// 파트너 추가 시 여기에만 한 줄씩 추가
const PLATFORM_BADGE: Record<string, string> = {
  amazon_us: "🇺🇸 아마존",
  amazon_jp: "🇯🇵 아마존JP",
  aliexpress: "알리",
  coupang: "쿠팡",
  etsy: "🧶 엣시",
  klook: "🎫 클룩",
  etc: "🌐",
};

const PLATFORM_COLOR: Record<string, string> = {
  amazon_us: "bg-blue-100 text-blue-700",
  amazon_jp: "bg-indigo-100 text-indigo-700",
  aliexpress: "bg-orange-100 text-orange-700",
  coupang: "bg-red-100 text-red-700",
  etsy: "bg-amber-100 text-amber-700",
  klook: "bg-purple-100 text-purple-700",
  etc: "bg-gray-100 text-gray-600",
};

function getPlatformBadge(platform: string | null): string | null {
  if (!platform) return null;
  return PLATFORM_BADGE[platform] ?? null;
}

function getPlatformColor(platform: string | null): string {
  if (!platform) return "bg-gray-50 text-gray-400";
  return PLATFORM_COLOR[platform] ?? "bg-gray-50 text-gray-400";
}

export default function QueueManager({ onPublished }: { onPublished?: () => void }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publishingAll, setPublishingAll] = useState(false);
  const [publishingSelected, setPublishingSelected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const dragIdxRef = useRef<number | null>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/admin/products?type=queued");
      if (res.status === 401) throw new Error("인증이 만료됐습니다. 다시 로그인해주세요.");
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "서버 오류");
      }
      const { data } = await res.json();
      setItems(data || []);
      setSelectedIds(new Set());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFetchError(msg);
      console.error("[QueueManager] fetchItems 실패:", err);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectAll() {
    setSelectedIds(new Set(items.map((i) => i.id)));
  }

  function handleDeselectAll() {
    setSelectedIds(new Set());
  }

  async function publishOne(id: string): Promise<boolean> {
    const res = await fetch("/api/admin/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: true, is_queued: false }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      console.error("[handlePublish]", error);
      return false;
    }
    return true;
  }

  async function handlePublish(id: string) {
    setPublishing(id);
    const ok = await publishOne(id);
    setPublishing(null);
    if (!ok) { alert("공개 실패. 다시 시도해주세요."); return; }
    await fetchItems();
    onPublished?.();
  }

  async function handlePublishSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}개 상품을 공개합니다. 계속할까요?`)) return;
    setPublishingSelected(true);
    const results = await Promise.all([...selectedIds].map((id) => publishOne(id)));
    setPublishingSelected(false);
    if (results.some((ok) => !ok)) alert("일부 상품 공개에 실패했습니다.");
    await fetchItems();
    onPublished?.();
  }

  async function handlePublishAll() {
    if (items.length === 0) return;
    if (!confirm(`큐에 있는 ${items.length}개 상품을 모두 공개합니다. 계속할까요?`)) return;
    setPublishingAll(true);
    const results = await Promise.all(items.map((item) => publishOne(item.id)));
    setPublishingAll(false);
    if (results.some((ok) => !ok)) alert("일부 상품 공개에 실패했습니다.");
    await fetchItems();
    onPublished?.();
  }

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
    const newItems = [...items];
    const [moved] = newItems.splice(from, 1);
    newItems.splice(targetIndex, 0, moved);
    setItems(newItems);
    setDragOverIdx(null);
    dragIdxRef.current = null;
    setSaved(false);
  }

  function handleDragEnd() {
    setDragOverIdx(null);
    dragIdxRef.current = null;
  }

  async function handleSaveOrder() {
    setSaving(true);
    setSaved(false);
    const updates = items.map((item, index) => ({ id: item.id, sort_order: index + 1 }));
    const res = await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    setSaving(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      alert("저장 실패: " + (error || "알 수 없는 오류"));
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  const allSelected = items.length > 0 && selectedIds.size === items.length;

  if (loading) {
    return <p className="text-center text-gray-400 py-20">불러오는 중...</p>;
  }

  if (fetchError) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 font-semibold mb-2">데이터를 불러오지 못했습니다</p>
        <p className="text-xs text-gray-400 font-mono bg-gray-50 border border-gray-200 rounded px-3 py-2 inline-block max-w-lg break-all">{fetchError}</p>
        <br />
        <button onClick={fetchItems} className="mt-4 text-sm text-[#F5A623] underline">다시 시도</button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-[#111111]">큐 관리</h2>
            <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              큐에 {items.length}개
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            드래그로 순서를 조정하고, 준비된 상품을 공개하세요.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {items.length > 1 && (
            <button
              onClick={handleSaveOrder}
              disabled={saving}
              className={`text-sm font-bold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 ${
                saved
                  ? "bg-green-500 text-white"
                  : "bg-gray-100 text-[#111111] hover:bg-gray-200"
              }`}
            >
              {saving ? "저장 중..." : saved ? "저장됨 ✓" : "순서 저장"}
            </button>
          )}
          {items.length > 0 && (
            <button
              onClick={handlePublishAll}
              disabled={publishingAll}
              className="text-sm font-bold px-5 py-2.5 bg-[#F5A623] text-white rounded-lg hover:bg-[#d8921f] transition-colors disabled:opacity-50"
            >
              {publishingAll ? "공개 중..." : `전체 공개 (${items.length}개)`}
            </button>
          )}
        </div>
      </div>

      {/* 선택 컨트롤 바 */}
      {items.length > 0 && (
        <div className="flex items-center gap-3 mb-5 py-2.5 px-3 bg-gray-50 rounded-xl border border-gray-100">
          <button
            onClick={allSelected ? handleDeselectAll : handleSelectAll}
            className="text-xs font-semibold text-gray-600 hover:text-[#111111] transition-colors"
          >
            {allSelected ? "전체 해제" : "전체 선택"}
          </button>
          <span className="text-gray-200">|</span>
          {selectedIds.size > 0 ? (
            <>
              <span className="text-xs font-semibold text-[#F5A623]">
                {selectedIds.size}개 선택됨
              </span>
              <button
                onClick={handlePublishSelected}
                disabled={publishingSelected}
                className="text-xs font-bold px-3 py-1.5 bg-[#F5A623] text-white rounded-lg hover:bg-[#d8921f] transition-colors disabled:opacity-50"
              >
                {publishingSelected
                  ? "공개 중..."
                  : `선택한 상품 공개하기 (${selectedIds.size}개)`}
              </button>
              <button
                onClick={handleDeselectAll}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                해제
              </button>
            </>
          ) : (
            <span className="text-xs text-gray-400">카드 체크박스로 선택 후 일괄 공개</span>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-2xl mb-3">📋</p>
          <p className="text-gray-500 font-semibold mb-1">큐가 비어있습니다.</p>
          <p className="text-xs text-gray-300">
            상품 추가 시 &quot;큐에 저장&quot;을 선택하면 여기에 쌓입니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {items.map((item, index) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={`relative bg-white border-2 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing select-none transition-all duration-150 ${
                  dragOverIdx === index
                    ? "border-[#F5A623] shadow-lg scale-105"
                    : isSelected
                    ? "border-[#F5A623] shadow-sm"
                    : "border-gray-100 hover:border-gray-300"
                }`}
              >
                {/* 선택 오버레이 (선택 시 반투명 주황) */}
                {isSelected && (
                  <div className="absolute inset-0 bg-[#F5A623]/8 z-10 pointer-events-none" />
                )}
                {/* 순서 번호 */}
                <div className="absolute top-1.5 left-1.5 z-20 bg-black/60 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {index + 1}
                </div>
                {/* 플랫폼 배지 */}
                {getPlatformBadge(item.platform) && (
                  <div
                    className={`absolute top-7 left-1.5 z-20 text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap leading-tight ${getPlatformColor(item.platform)}`}
                  >
                    {getPlatformBadge(item.platform)}
                  </div>
                )}
                {/* 영상/슬라이드 배지 */}
                {(item.video_url || (item.image_urls && item.image_urls.length >= 2)) && (
                  <div className="absolute top-1.5 right-1.5 z-20 bg-[#F5A623] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    🎬
                  </div>
                )}
                {/* 썸네일 */}
                <div className="aspect-square bg-gray-50">
                  {item.video_url ? (
                    <video
                      src={item.video_url}
                      className="w-full h-full object-cover"
                      preload="metadata"
                      muted
                      playsInline
                      draggable={false}
                    />
                  ) : (item.image_url || item.image_urls?.[0]) ? (
                    <img
                      src={item.image_url || item.image_urls![0]}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100" />
                  )}
                </div>
                {/* 카드 하단 */}
                <div className="p-2">
                  {/* 체크박스 + 제목 */}
                  <div className="flex items-start gap-1.5 mb-1.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item.id)}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      draggable={false}
                      className="mt-0.5 flex-shrink-0 accent-[#F5A623] cursor-pointer"
                    />
                    <p className="text-[10px] font-semibold text-[#111111] line-clamp-2 leading-tight">
                      {item.title}
                    </p>
                  </div>
                  <button
                    onClick={() => handlePublish(item.id)}
                    disabled={publishing === item.id}
                    className="w-full text-[10px] font-bold py-1 bg-[#F5A623] text-white rounded-md hover:bg-[#d8921f] transition-colors disabled:opacity-50"
                  >
                    {publishing === item.id ? "..." : "공개하기"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}