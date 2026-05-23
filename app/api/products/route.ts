import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const LIMIT = 12;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(50, Number(searchParams.get("limit") ?? LIMIT));
  const excludeId = searchParams.get("excludeId") ?? null;
  const category = searchParams.get("category") ?? null;

  const offset = (page - 1) * limit;

  let query = supabase
    .from("products")
    .select("id, title, category, image_url, video_url, price, affiliate_link", {
      count: "exact",
    })
    .eq("is_active", true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (excludeId) query = query.neq("id", excludeId);
  if (category) query = query.eq("category", category);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const hasMore = offset + limit < (count ?? 0);
  return NextResponse.json({ products: data ?? [], hasMore, total: count ?? 0 });
}
