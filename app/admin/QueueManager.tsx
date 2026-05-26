"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

type QueueItem = {
  id: string;
  title: string;
  image_url: string;
  video_url: string | null;
  sort_order: number | null;
  created_at: string;
  platform: string | null;
};

function getPlatformBadge(platform: string | null): string | null {
  if (platform === "amazon_us") return "🇺🇸 아마존";
  if (platform === "amazon_jp") return "🇯🇵 아마존JP";
  if (platform === "aliexpress") return "알리";
  if (platform === "coupang") return "쿠팡";
  if (platform === "etc") return "🌐";
  return null;
}

function getPlatformColor(platform: string | null): string {
  if (platform === "amazon_us") return "bg-blue-100 text-blue-700";
  if (platform === "amazon_jp") return "bg-indigo-100 text-indigo-700";
  if (platform === "aliexpress") return "bg-orange-100 text-orange-700";
  if (platform === "coupang") return "bg-red-100 text-red-700";
  if (platform === "etc") return "bg-gray-100 text-gray-600";
  return "bg-gray-50 text-gray-400";
}

export default function QueueManager({ onPublished }: { onPublished?: () => void }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publishingAll, setPublishingAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragIdxRef = useRef<number | null>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("id, title, image_url, video_url, sort_order, created_at, platform")
      .eq("is_queued", true)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  }

  async function handlePublish(id: string) {
    setPublishing(id);
    await supabase
      .from("products")
      .update({ is_active: true, is_queued: false })
      .eq("id", id);
    setPublishing(null);
    await fetchItems();
    onPublished?.();
  }

  async function handlePublishAll() {
    if (items.length === 0) return;
    if (!confirm(`큐에 있는 ${items.length}개 상품을 모두 공개합니다. 계속할까요?`)) return;
    setPublishingAll(true);
    await supabase
      .from("products")
      .update({ is_active: true, is_queued: false })
      .eq("is_queued", true);
    setPublishingAll(false);
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
    const errors: string[] = [];
    await Promise.all(
      items.map(async (item, index) => {
        const { error } = await supabase
          .from("products")
          .update({ sort_order: index + 1 })
          .eq("id", item.id);
        if (error) errors.push(error.message);
      })
    );
    setSaving(false);
    if (errors.length > 0) {
      alert("저장 실패: " + errors[0]);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  if (loading) {
    return <p className="text-center text-gray-400 py-20">불러오는 중...</p>;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
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
              className="text-sm font-bold px-5 py-2.5 bg-[#FF5A00] text-white rounded-lg hover:bg-[#e04e00] transition-colors disabled:opacity-50"
            >
              {publishingAll ? "공개 중..." : `전체 공개 (${items.length}개)`}
            </button>
          )}
        </div>
      </div>

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
          {items.map((item, index) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={`relative bg-white border-2 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing select-none transition-all duration-150 ${
                dragOverIdx === index
                  ? "border-[#FF5A00] shadow-lg scale-105"
                  : "border-gray-100 hover:border-gray-300"
              }`}
            >
              {/* 순서 번호 */}
              <div className="absolute top-1.5 left-1.5 z-10 bg-black/60 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {index + 1}
              </div>
              {/* 플랫폼 배지 */}
              {getPlatformBadge(item.platform) && (
                <div
                  className={`absolute top-7 left-1.5 z-10 text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap leading-tight ${getPlatformColor(item.platform)}`}
                >
                  {getPlatformBadge(item.platform)}
                </div>
              )}
              {/* 영상 배지 */}
              {item.video_url && (
                <div className="absolute top-1.5 right-1.5 z-10 bg-[#FF5A00] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
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
                ) : (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                )}
              </div>
              {/* 카드 하단 */}
              <div className="p-2">
                <p className="text-[10px] font-semibold text-[#111111] line-clamp-2 leading-tight mb-1.5">
                  {item.title}
                </p>
                <button
                  onClick={() => handlePublish(item.id)}
                  disabled={publishing === item.id}
                  className="w-full text-[10px] font-bold py-1 bg-[#FF5A00] text-white rounded-md hover:bg-[#e04e00] transition-colors disabled:opacity-50"
                >
                  {publishing === item.id ? "..." : "공개하기"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
