"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

type OrderItem = {
  id: string;
  title: string;
  image_url: string;
  video_url: string | null;
  sort_order: number;
  created_at: string;
  affiliate_link: string;
};

function getPlatformBadge(url: string): string | null {
  if (url.includes("amazon.co.jp")) return "🇯🇵 아마존JP";
  if (url.includes("amazon.com")) return "🇺🇸 아마존";
  if (url.includes("aliexpress.com")) return "알리";
  if (url.includes("coupang.com")) return "쿠팡";
  return null;
}

export default function OrderEditor() {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
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
      .select("id, title, image_url, video_url, sort_order, created_at, affiliate_link")
      .eq("is_active", true)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
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
  }

  function handleDragEnd() {
    setDragOverIdx(null);
    dragIdxRef.current = null;
  }

  async function handleSave() {
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

  if (items.length === 0) {
    return (
      <p className="text-center text-gray-400 py-20">노출 중인 상품이 없습니다.</p>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-[#111111]">노출 순서 편집</h2>
            <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              총 {items.length}개
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            카드를 드래그해서 순서를 바꾸고 저장하세요. 저장하면 메인 피드에 바로 반영됩니다.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`text-sm font-bold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50 ${
            saved
              ? "bg-green-500 text-white"
              : "bg-[#FF5A00] text-white hover:bg-[#e04e00]"
          }`}
        >
          {saving ? "저장 중..." : saved ? "저장됨 ✓" : "순서 저장"}
        </button>
      </div>

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
            <div className="absolute top-1.5 left-1.5 z-10 bg-black/60 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {index + 1}
            </div>
            {getPlatformBadge(item.affiliate_link) && (
              <div className="absolute top-7 left-1.5 z-10 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap leading-tight">
                {getPlatformBadge(item.affiliate_link)}
              </div>
            )}
            {item.video_url && (
              <div className="absolute top-1.5 right-1.5 z-10 bg-[#FF5A00] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                🎬
              </div>
            )}
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
            <div className="p-2">
              <p className="text-[10px] font-semibold text-[#111111] line-clamp-2 leading-tight">
                {item.title}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
