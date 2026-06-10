import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

async function isAuthorized(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get("admin_auth")?.value === "true";
}

// GET ?type=products | queue
export async function GET(req: NextRequest) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type") ?? "queue";
  const admin = getSupabaseAdmin();

  if (type === "products") {
    const [{ data: products }, { data: queueItems }] = await Promise.all([
      admin
        .from("products")
        .select(
          "id, title, image_url, image_urls, video_url, platform, button_text"
        )
        .eq("sns_safe", true)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),
      admin.from("sns_queue").select("product_id, status"),
    ]);

    // status 우선순위: pending > failed > published > null
    const queueMap = new Map<string, string>();
    for (const q of queueItems ?? []) {
      const existing = queueMap.get(q.product_id);
      if (
        !existing ||
        q.status === "pending" ||
        (q.status === "failed" && existing !== "pending")
      ) {
        queueMap.set(q.product_id, q.status);
      }
    }

    const data = (products ?? []).map((p) => ({
      ...p,
      queue_status: (queueMap.get(p.id) ?? null) as
        | "pending"
        | "failed"
        | "published"
        | null,
    }));

    return NextResponse.json({ data });
  }

  // type === "queue" — pending + failed, scheduled_order 순
  const { data, error } = await admin
    .from("sns_queue")
    .select("*, products(title, image_url, image_urls)")
    .in("status", ["pending", "failed"])
    .order("scheduled_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

// POST — 큐에 추가
export async function POST(req: NextRequest) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { product_id, channel = "threads", post_text, image_url } =
    await req.json();
  if (!product_id || !post_text) {
    return NextResponse.json(
      { error: "product_id, post_text 필수" },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();

  // 다음 scheduled_order 계산
  const { data: maxRow } = await admin
    .from("sns_queue")
    .select("scheduled_order")
    .order("scheduled_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = ((maxRow?.scheduled_order as number | null) ?? 0) + 1;

  const { error } = await admin.from("sns_queue").insert({
    product_id,
    channel,
    post_text,
    image_url: image_url || null,
    status: "pending",
    scheduled_order: nextOrder,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PUT — 항목 수정 (문구/이미지/상태)
export async function PUT(req: NextRequest) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, ...payload } = await req.json();
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("sns_queue").update(payload).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PATCH — 순서 일괄 업데이트
export async function PATCH(req: NextRequest) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { updates } = (await req.json()) as {
    updates: { id: string; scheduled_order: number }[];
  };
  if (!Array.isArray(updates)) {
    return NextResponse.json({ error: "updates 배열 필요" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  await Promise.all(
    updates.map(({ id, scheduled_order }) =>
      admin.from("sns_queue").update({ scheduled_order }).eq("id", id)
    )
  );
  return NextResponse.json({ ok: true });
}

// DELETE — 항목 삭제
export async function DELETE(req: NextRequest) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("sns_queue").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
