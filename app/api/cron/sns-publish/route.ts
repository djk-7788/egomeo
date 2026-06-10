import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { processImageForSns } from "@/lib/sns-image";
import {
  publishToThreads,
  isVideoUrl,
  createThreadsContainer,
  checkContainerStatus,
  publishThreadsContainer,
  publishThreadsComment,
} from "@/lib/threads";

export const runtime = "nodejs";
// 이미지+댓글 발행 시 최대 ~40초 (30s 대기 + 5s 댓글 대기 + 여유)
export const maxDuration = 60;

type SnsQueueItem = {
  id: string;
  post_text: string;
  image_url: string | null;
  comment_text: string | null;
  media_type: string | null | undefined;
  container_id: string | null | undefined;
  [key: string]: unknown;
};

async function runPublish(manual = false): Promise<NextResponse> {
  const admin = getSupabaseAdmin();

  // ── 1. processing 항목 먼저 확인 (영상 컨테이너 완료 여부) ──
  // select("*"): media_type/container_id 컬럼이 없어도 에러 없이 진행
  const { data: processingItems } = await admin
    .from("sns_queue")
    .select("*")
    .eq("status", "processing")
    .order("scheduled_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(1);

  if (processingItems && processingItems.length > 0) {
    const item = processingItems[0] as SnsQueueItem;
    const containerId = item.container_id ?? null;

    if (!containerId) {
      const errMsg = item.container_id === undefined
        ? "SQL 실행 필요: ALTER TABLE sns_queue ADD COLUMN IF NOT EXISTS container_id text;"
        : "container_id 없음";
      await admin
        .from("sns_queue")
        .update({ status: "failed", error_message: errMsg })
        .eq("id", item.id);
      return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
    }

    try {
      const statusCode = await checkContainerStatus(containerId);

      if (statusCode === "IN_PROGRESS") {
        return NextResponse.json({ ok: true, message: "영상 처리 중 — 다음 Cron 재시도" });
      }

      if (statusCode === "ERROR" || statusCode === "EXPIRED") {
        await admin
          .from("sns_queue")
          .update({
            status: "failed",
            error_message: `Threads 영상 처리 실패 (${statusCode})`,
          })
          .eq("id", item.id);
        return NextResponse.json({ ok: false, error: statusCode }, { status: 500 });
      }

      if (statusCode === "FINISHED") {
        const postId = await publishThreadsContainer(containerId);

        let commentError: string | undefined;
        if (item.comment_text) {
          const result = await publishThreadsComment(postId, item.comment_text);
          commentError = result.commentError;
        }

        await admin
          .from("sns_queue")
          .update({
            status: "published",
            published_at: new Date().toISOString(),
            error_message: commentError ? `댓글 발행 실패: ${commentError}` : null,
          })
          .eq("id", item.id);

        return NextResponse.json({ ok: true, published: item.id });
      }

      // PUBLISHED 또는 알 수 없는 상태 — 다음 사이클에 재확인
      return NextResponse.json({ ok: true, message: `상태 확인 중: ${statusCode}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await admin
        .from("sns_queue")
        .update({ status: "failed", error_message: msg })
        .eq("id", item.id);
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
  }

  // ── 2. 일일 발행 한도 확인 (수동 테스트는 제외) ──
  if (!manual) {
    const dailyLimit = parseInt(process.env.SNS_DAILY_LIMIT ?? "2");
    const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const kstDate = nowKst.toISOString().slice(0, 10);
    const kstDayStart = new Date(`${kstDate}T00:00:00+09:00`).toISOString();

    const { count: todayCount } = await admin
      .from("sns_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .gte("published_at", kstDayStart);

    if ((todayCount ?? 0) >= dailyLimit) {
      return NextResponse.json({
        ok: true,
        message: `일일 발행 한도 도달 (${todayCount}/${dailyLimit})`,
      });
    }
  }

  // ── 3. pending 항목 처리 ──
  const { data: pendingItems, error: fetchError } = await admin
    .from("sns_queue")
    .select("*")
    .eq("status", "pending")
    .order("scheduled_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(1);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!pendingItems || pendingItems.length === 0) {
    // 실패 항목이 있으면 재시도 안내
    const { count: failedCount } = await admin
      .from("sns_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed");
    if ((failedCount ?? 0) > 0) {
      return NextResponse.json({
        ok: true,
        message: `pending 항목 없음 (실패 ${failedCount}개 — 큐에서 '재시도' 버튼 클릭 후 다시 시도하세요)`,
      });
    }
    return NextResponse.json({ ok: true, message: "큐가 비어있습니다" });
  }

  const item = pendingItems[0] as SnsQueueItem;
  const isVideo =
    item.media_type === "video" ||
    (item.media_type == null && isVideoUrl(item.image_url));

  try {
    if (isVideo) {
      // 영상 사이클1: 컨테이너 생성만 → status='processing'
      const creationId = await createThreadsContainer({
        postText: item.post_text,
        imageUrl: item.image_url,
        mediaType: "video",
      });

      const { error: updateError } = await admin
        .from("sns_queue")
        .update({ status: "processing", container_id: creationId })
        .eq("id", item.id);

      if (updateError) {
        // container_id 컬럼이 없을 경우 — SQL 실행 안내
        const sqlGuide =
          "SQL 실행 필요: ALTER TABLE sns_queue ADD COLUMN IF NOT EXISTS container_id text; (컨테이너 생성은 됐으나 저장 실패)";
        await admin
          .from("sns_queue")
          .update({ status: "failed", error_message: sqlGuide })
          .eq("id", item.id);
        return NextResponse.json({ ok: false, error: sqlGuide }, { status: 500 });
      }

      return NextResponse.json({ ok: true, processing: item.id });
    }

    // 이미지/텍스트: 기존 방식 (컨테이너 → 30초 대기 → 발행 → 댓글)
    let processedImageUrl: string | null = null;
    if (item.image_url) {
      processedImageUrl = await processImageForSns(item.image_url);
    }

    const { commentError } = await publishToThreads({
      postText: item.post_text,
      imageUrl: processedImageUrl,
      mediaType: item.media_type ?? null,
      commentText: item.comment_text,
    });

    await admin
      .from("sns_queue")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        error_message: commentError ? `댓글 발행 실패: ${commentError}` : null,
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

// Vercel Cron: Authorization: Bearer {CRON_SECRET}
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runPublish(false);
}

// 어드민 수동 테스트: admin_auth 쿠키 (일일 한도 무시)
export async function POST(_req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_auth")?.value !== "true") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runPublish(true);
}
