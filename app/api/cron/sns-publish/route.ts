import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { processImageForSns } from "@/lib/sns-image";
import { publishToThreads } from "@/lib/threads";

export const runtime = "nodejs";
// 이미지 처리 + Threads 30초 대기 포함 최대 실행 시간
export const maxDuration = 300;

async function runPublish(): Promise<NextResponse> {
  const admin = getSupabaseAdmin();

  // pending 항목 중 scheduled_order 가장 낮은 1개
  const { data: items, error: fetchError } = await admin
    .from("sns_queue")
    .select("*")
    .eq("status", "pending")
    .order("scheduled_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(1);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ ok: true, message: "큐가 비어있습니다" });
  }

  const item = items[0] as {
    id: string;
    post_text: string;
    image_url: string | null;
  };

  try {
    let processedImageUrl: string | null = null;
    if (item.image_url) {
      processedImageUrl = await processImageForSns(item.image_url);
    }

    await publishToThreads({
      postText: item.post_text,
      imageUrl: processedImageUrl,
    });

    await admin
      .from("sns_queue")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", item.id);

    return NextResponse.json({ ok: true, published: item.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin
      .from("sns_queue")
      .update({ status: "failed", error_message: msg })
      .eq("id", item.id);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// Vercel 크론: Authorization: Bearer {CRON_SECRET}
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runPublish();
}

// 어드민 수동 테스트: admin_auth 쿠키
export async function POST(_req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_auth")?.value !== "true") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runPublish();
}
