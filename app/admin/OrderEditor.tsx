"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

type OrderItem = {
  id: string;
  title: string;
  image_url: string;
  image_urls: string[] | null;
  video_url: string | null;
  sort_order: number;
  created_at: string;
  affiliate_link: string;
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

// 2단계 알고리즘: 영상 위치를 먼저 균등 분산 계산 후 플랫폼 다양성 적용
function optimizeOrder(items: OrderItem[]): { result: OrderItem[]; warnings: string[] } {
  const warnSet = new Set<string>();
  const N = items.length;
  if (N === 0) return { result: [], warnings: [] };

  const videos = items.filter(i => i.video_url);
  const nonVideos = items.filter(i => !i.video_url);
  const V = videos.length;

  // ── 1단계: 영상 위치 계산 ─────────────────────────────────────────
  // N/(V+1) 간격으로 균등 분산 + 랜덤 지터 ±2 (최소 4칸 보장)
  const videoSlots = new Set<number>();

  if (V > 0) {
    const spacing = N / (V + 1);
    let lastPos = -999;

    for (let vi = 0; vi < V; vi++) {
      const idealPos = Math.round(spacing * (vi + 1)) - 1; // 0-indexed 이상적 위치
      const jitter = Math.floor(Math.random() * 5) - 2;    // -2 ~ +2 랜덤 지터

      // 최소 4칸 보장 + 남은 영상들이 들어갈 공간 확보
      const minValid = Math.max(lastPos + 4, 0);
      const maxValid = N - 1 - (V - vi - 1) * 4;

      if (minValid > maxValid) {
        warnSet.add("일부 영상 간격이 4칸 미만입니다 (영상이 너무 많음).");
        break;
      }

      // idealPos+jitter를 유효 범위로 클램프
      const chosen = Math.max(minValid, Math.min(maxValid, idealPos + jitter));
      videoSlots.add(chosen);
      lastPos = chosen;
    }
  }

  // ── 2단계: 플랫폼별 큐 구성 ──────────────────────────────────────
  const mkQueues = (lst: OrderItem[]) => {
    const m = new Map<string | null, OrderItem[]>();
    for (const item of lst) {
      if (!m.has(item.platform)) m.set(item.platform, []);
      m.get(item.platform)!.push(item);
    }
    return m;
  };

  const vq = mkQueues(videos);
  const nvq = mkQueues(nonVideos);
  const hasAny = (m: Map<string | null, OrderItem[]>) =>
    [...m.values()].some(q => q.length > 0);

  // 가장 많이 남은 플랫폼부터 시도, 직전과 다른 플랫폼 우선
  const pickBest = (
    queues: Map<string | null, OrderItem[]>,
    lastPlatform: string | null,
    isFirst: boolean
  ): { item: OrderItem; platform: string | null } | null => {
    const pool = [...queues.entries()]
      .filter(([, q]) => q.length > 0)
      .sort((a, b) => b[1].length - a[1].length);
    if (!pool.length) return null;

    for (const [p, q] of pool) {
      if (!isFirst && p === lastPlatform) continue;
      return { item: q.shift()!, platform: p };
    }

    // 동일 플랫폼 폴백
    warnSet.add("일부 구간에서 연속 동일 플랫폼이 발생합니다.");
    const [p, q] = pool[0];
    return { item: q.shift()!, platform: p };
  };

  // ── 3단계: 위치별 배치 ───────────────────────────────────────────
  // 영상 슬롯 → 영상 큐, 나머지 → 비영상 큐 (소진 시 반대 큐로 폴백)
  const result: OrderItem[] = [];
  let lastPlatform: string | null = null;
  let isFirst = true;

  for (let pos = 0; pos < N; pos++) {
    const isVideoSlot = videoSlots.has(pos);
    const primaryQ = isVideoSlot ? vq : nvq;
    const fallbackQ = isVideoSlot ? nvq : vq;
    const activeQ = hasAny(primaryQ) ? primaryQ : fallbackQ;
    if (!hasAny(activeQ)) continue;

    const picked = pickBest(activeQ, lastPlatform, isFirst);
    if (!picked) continue;

    result.push(picked.item);
    lastPlatform = picked.platform;
    isFirst = false;
  }

  return { result, warnings: [...warnSet] };
}

export default function OrderEditor() {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragIdxRef = useRef<number | null>(null);

  // 정렬 최적화 상태
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [preview, setPreview] = useState<{
    before: OrderItem[];
    after: OrderItem[];
    startRank: number;  // 범위 첫 번째 순위 (1-indexed)
    warnings: string[];
  } | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyDone, setApplyDone] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("id, title, image_url, image_urls, video_url, sort_order, created_at, affiliate_link, platform")
      .eq("is_active", true)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  }

  function handlePreview() {
    const start = parseInt(rangeStart);
    const end = parseInt(rangeEnd);
    if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
      alert("올바른 범위를 입력해 주세요. (시작 < 끝, 1 이상)");
      return;
    }
    if (end > items.length) {
      alert(`전체 상품이 ${items.length}개입니다. 끝 번호는 ${items.length} 이하로 입력해 주세요.`);
      return;
    }
    // items는 sort_order 순 정렬된 상태 — 순위(rank) 기반으로 슬라이싱
    const before = items.slice(start - 1, end);
    if (before.length < 2) {
      alert("선택한 범위에 상품이 2개 이상 있어야 합니다.");
      return;
    }
    const { result: after, warnings } = optimizeOrder([...before]);
    setPreview({ before, after, startRank: start, warnings });
    setApplyDone(false);
  }

  async function handleApply() {
    if (!preview) return;
    if (!confirm(`${preview.after.length}개 상품의 순서를 변경합니다. 범위 밖 상품은 영향 없습니다. 계속할까요?`)) return;
    setApplying(true);
    const errors: string[] = [];
    // 순위 기반 연속 정수 할당 (startRank, startRank+1, ...)
    // Promise.all 대신 순차 업데이트 — 충돌 없이 확실하게 반영
    for (let i = 0; i < preview.after.length; i++) {
      const item = preview.after[i];
      const newOrder = preview.startRank + i;
      const { error } = await supabase
        .from("products")
        .update({ sort_order: newOrder })
        .eq("id", item.id);
      if (error) errors.push(`[${i + 1}번] ${error.message}`);
    }
    setApplying(false);
    if (errors.length > 0) {
      alert(`저장 실패 (${errors.length}건):\n${errors[0]}`);
    } else {
      setApplyDone(true);
      setPreview(null);
      await fetchItems();
    }
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

      {/* ── 정렬 최적화 섹션 ── */}
      <div className="mb-8 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-sm font-black text-[#111111]">정렬 최적화</h3>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          지정 범위의 상품을{" "}
          <span className="font-semibold text-gray-500">플랫폼 분산</span>{" "}+{" "}
          <span className="font-semibold text-gray-500">영상 4칸 간격</span>{" "}
          규칙에 따라 자동 재배치합니다. 범위 밖 상품은 절대 변경되지 않습니다.
        </p>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">시작 번호</label>
            <input
              type="number"
              min={1}
              value={rangeStart}
              onChange={e => { setRangeStart(e.target.value); setPreview(null); setApplyDone(false); }}
              placeholder="1"
              className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#FF5A00] transition-colors"
            />
          </div>
          <span className="text-gray-400 text-sm">~</span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">끝 번호</label>
            <input
              type="number"
              min={1}
              value={rangeEnd}
              onChange={e => { setRangeEnd(e.target.value); setPreview(null); setApplyDone(false); }}
              placeholder="50"
              className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#FF5A00] transition-colors"
            />
          </div>
          <button
            onClick={handlePreview}
            className="text-sm font-bold px-4 py-2 bg-gray-100 text-[#111111] rounded-lg hover:bg-gray-200 transition-colors"
          >
            미리보기
          </button>
          {applyDone && (
            <span className="text-xs text-green-600 font-semibold">✓ 정렬 최적화 적용 완료</span>
          )}
        </div>

        {preview && (
          <>
            {preview.warnings.length > 0 && (
              <div className="mb-3 bg-yellow-50 border border-yellow-100 rounded-xl p-3">
                <p className="text-xs font-bold text-yellow-700 mb-1">⚠️ 규칙 완전 충족 불가 — 최대한 분산 처리됨</p>
                {preview.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-yellow-600">{w}</p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* 변경 전 */}
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-2 px-1">
                  변경 전{" "}
                  <span className="font-normal text-gray-300">({preview.before.length}개)</span>
                </p>
                <div className="space-y-0.5 max-h-80 overflow-y-auto pr-1">
                  {preview.before.map((item, i) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-1.5 py-1 px-2 rounded-lg bg-gray-50"
                    >
                      <span className="text-gray-300 w-5 text-right flex-shrink-0 text-[10px]">{i + 1}</span>
                      {item.video_url && (
                        <span className="text-[9px] flex-shrink-0">🎬</span>
                      )}
                      {getPlatformBadge(item.platform) && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${getPlatformColor(item.platform)}`}>
                          {getPlatformBadge(item.platform)}
                        </span>
                      )}
                      <span className="text-[#111111] text-[10px] line-clamp-1 min-w-0">
                        {item.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 변경 후 */}
              <div>
                <p className="text-xs font-semibold text-[#FF5A00] mb-2 px-1">
                  변경 후{" "}
                  <span className="font-normal text-orange-300">({preview.after.length}개)</span>
                </p>
                <div className="space-y-0.5 max-h-80 overflow-y-auto pr-1">
                  {preview.after.map((item, i) => {
                    const changed = preview.before[i]?.id !== item.id;
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-1.5 py-1 px-2 rounded-lg ${
                          changed
                            ? "bg-orange-50 border border-orange-100"
                            : "bg-gray-50"
                        }`}
                      >
                        <span className="text-gray-300 w-5 text-right flex-shrink-0 text-[10px]">{i + 1}</span>
                        {item.video_url && (
                          <span className="text-[9px] flex-shrink-0">🎬</span>
                        )}
                        {getPlatformBadge(item.platform) && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${getPlatformColor(item.platform)}`}>
                            {getPlatformBadge(item.platform)}
                          </span>
                        )}
                        <span className="text-[#111111] text-[10px] line-clamp-1 min-w-0">
                          {item.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-gray-50">
              <button
                onClick={handleApply}
                disabled={applying}
                className="text-sm font-bold px-5 py-2 bg-[#FF5A00] text-white rounded-lg hover:bg-[#e04e00] transition-colors disabled:opacity-50"
              >
                {applying ? "적용 중..." : "적용"}
              </button>
              <button
                onClick={() => setPreview(null)}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                취소
              </button>
              <span className="text-[10px] text-gray-400">
                {preview.startRank}번~{preview.startRank + preview.before.length - 1}번 상품, 총 {preview.before.length}개 재배치
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── 기존 드래그 앤 드롭 순서 편집 ── */}
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
            {getPlatformBadge(item.platform) && (
              <div className="absolute top-7 left-1.5 z-10 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap leading-tight">
                {getPlatformBadge(item.platform)}
              </div>
            )}
            {(item.video_url || (item.image_urls && item.image_urls.length >= 2)) && (
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
