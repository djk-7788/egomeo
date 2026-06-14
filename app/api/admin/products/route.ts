import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { submitToIndexNow } from "@/lib/indexnow";
import { getMediaDimension } from "@/lib/probe-media";

export const runtime = "nodejs";

async function isAuthorized(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get("admin_auth")?.value === "true";
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type") ?? "all";
  const admin = getSupabaseAdmin();

  try {
    if (type === "queued") {
      const { data, error } = await admin
        .from("products")
        .select("id, title, image_url, image_urls, video_url, sort_order, created_at, platform")
        .eq("is_queued", true)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return NextResponse.json({ data });
    }

    if (type === "active") {
      const { data, error } = await admin
        .from("products")
        .select("id, title, image_url, image_urls, video_url, sort_order, created_at, affiliate_link, platform")
        .eq("is_active", true)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return NextResponse.json({ data });
    }

    // type === "all"
    const { data, error } = await admin
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[/api/admin/products]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { updates } = (await req.json()) as {
      updates: { id: string; sort_order: number }[];
    };
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "updates 배열이 필요합니다" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const results = await Promise.all(
      updates.map(({ id, sort_order }) =>
        admin.from("products").update({ sort_order }).eq("id", id)
      )
    );

    const errors = results.filter((r) => r.error).map((r) => r.error!.message);
    if (errors.length > 0) {
      return NextResponse.json({ error: errors[0], errorCount: errors.length }, { status: 500 });
    }
    return NextResponse.json({ ok: true, updated: updates.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[/api/admin/products PATCH]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const payload = await req.json();

    // 미디어 dimension 자동 계산 (실패 시 null, 등록은 계속 진행)
    const dim = await getMediaDimension(payload.video_url, payload.image_urls, payload.image_url);
    const insertData = {
      ...payload,
      media_width: dim?.width ?? null,
      media_height: dim?.height ?? null,
    };

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from("products").insert(insertData).select("id").single();
    if (error) throw error;
    // 즉시 공개인 경우 IndexNow 핑
    if (data?.id && payload.is_active === true && !payload.is_queued) {
      submitToIndexNow([`https://www.igemugo.com/product/${data.id}`]);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[/api/admin/products POST]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id, ...payload } = await req.json();
    if (!id) return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 });
    const admin = getSupabaseAdmin();

    // 비활성→활성 전환 여부 확인 (비용: SELECT 1건, PK 조회라 빠름)
    if (payload.is_active === true) {
      const { data: current } = await admin
        .from("products")
        .select("is_active")
        .eq("id", id)
        .single();
      if (current && !current.is_active) {
        submitToIndexNow([`https://www.igemugo.com/product/${id}`]);
      }
    }

    // 미디어 필드가 포함된 경우에만 dimension 재계산
    const hasMediaFields =
      'video_url' in payload || 'image_urls' in payload || 'image_url' in payload;
    if (hasMediaFields) {
      const dim = await getMediaDimension(payload.video_url, payload.image_urls, payload.image_url);
      payload.media_width = dim?.width ?? null;
      payload.media_height = dim?.height ?? null;
    }

    const { error } = await admin.from("products").update(payload).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[/api/admin/products PUT]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 });
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("products").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[/api/admin/products DELETE]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
