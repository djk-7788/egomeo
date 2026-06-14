import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const LIMIT = 12;
const TOP_N = 5; // 최신 N개 항상 상단 고정

// Mulberry32 PRNG — 시드 기반 결정적 난수
function mulberry32(a: number) {
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

// Fisher-Yates 셔플 (시드 기반, 결정적)
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(50, Number(searchParams.get("limit") ?? LIMIT));
  const excludeId = searchParams.get("excludeId") ?? null;
  const category = searchParams.get("category") ?? null;
  const seedParam = searchParams.get("seed");
  const seed = seedParam !== null ? parseInt(seedParam, 10) : null;

  const offset = (page - 1) * limit;

  // ── 시드 없음: 기존 정렬 (sort_order + created_at) ──
  if (seed === null || isNaN(seed)) {
    let query = supabase
      .from("products")
      .select(
        "id, title, category, image_url, image_urls, video_url, affiliate_link, button_text, media_width, media_height",
        { count: "exact" }
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (excludeId) query = query.neq("id", excludeId);
    if (category) query = query.eq("category", category);

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const hasMore = offset + limit < (count ?? 0);
    return NextResponse.json({ products: data ?? [], hasMore, total: count ?? 0 });
  }

  // ── 시드 있음: 최신 TOP_N 고정 + 나머지 시드 셔플 ──

  // 1단계: 전체 ID + created_at 조회 (필터 적용)
  let idQuery = supabase
    .from("products")
    .select("id, created_at")
    .eq("is_active", true);
  if (excludeId) idQuery = idQuery.neq("id", excludeId);
  if (category) idQuery = idQuery.eq("category", category);

  const { data: allItems, error: idError } = await idQuery;
  if (idError) return NextResponse.json({ error: idError.message }, { status: 500 });
  if (!allItems?.length) return NextResponse.json({ products: [], hasMore: false, total: 0 });

  // 2단계: created_at 내림차순 정렬 → 최신 TOP_N 분리
  const sorted = [...allItems].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const topIds = sorted.slice(0, TOP_N).map((item) => item.id);
  const restIds = seededShuffle(
    sorted.slice(TOP_N).map((item) => item.id),
    seed
  );

  // 3단계: 전체 순서 = 최신 TOP_N + 셔플된 나머지
  const orderedIds = [...topIds, ...restIds];
  const total = orderedIds.length;

  // 4단계: 현재 페이지 ID 슬라이스
  const pageIds = orderedIds.slice(offset, offset + limit);
  if (!pageIds.length) return NextResponse.json({ products: [], hasMore: false, total });

  // 5단계: 해당 ID들의 전체 데이터 조회
  const { data: products, error: dataError } = await supabase
    .from("products")
    .select(
      "id, title, category, image_url, image_urls, video_url, affiliate_link, button_text, media_width, media_height"
    )
    .in("id", pageIds);

  if (dataError) return NextResponse.json({ error: dataError.message }, { status: 500 });

  // 6단계: IN 쿼리는 순서 미보장 → pageIds 순서대로 재정렬
  const productMap = new Map((products ?? []).map((p) => [p.id, p]));
  const orderedProducts = pageIds.map((id) => productMap.get(id)).filter(Boolean);

  return NextResponse.json({
    products: orderedProducts,
    hasMore: offset + limit < total,
    total,
  });
}
