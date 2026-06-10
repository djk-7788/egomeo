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
export const maxDuration = 60;

async function runPublish(manual = false): Promise<NextResponse> {
  const admin = getSupabaseAdmin();

  // ── STEP 1: processing 항목 확인 (영상 사이클2) ──────────────
  // select("*"): 컬럼 누락 시에도 에러 없이 undefined 반환
  const { data: processingRows } = await admin
    .from("sns_queue")
    .select("*")
    .eq("status", "processing")
    .order("scheduled_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(1);

  if (processingRows && processingRows.length > 0) {
    const item = processingRows[0] as {
      id: string;
      post_text: string;
      comment_text: string | null;
      container_id: string | null | undefined;
    };

    const containerId: string | null = item.container_id ?? null;

    if (!containerId) {
      const msg =
        "container_id 없음 — SQL 실행: ALTER TABLE sns_queue ADD COLUMN IF NOT EXISTS container_id text;";
      await admin.from("sns_queue")
        .update({ status: "failed", error_message: msg })
        .eq("id", item.id);
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    // 상태 조회 1회 — 루프 없음
    let statusCode: string;
    try {
      statusCode = await checkContainerStatus(containerId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await admin.from("sns_queue")
        .update({ status: "failed", error_message: msg })
        .eq("id", item.id);
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    if (statusCode === "IN_PROGRESS") {
      // 아직 처리 중 — 아무것도 안 함, 다음 Cron에서 재확인
      return NextResponse.json({ ok: true, message: "영상 처리 중 — 다음 Cron 재시도" });
    }

    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      await admin.from("sns_queue")
        .update({ status: "failed", error_message: `Threads 영상 처리 실패 (${statusCode})` })
        .eq("id", item.id);
      return NextResponse.json({ ok: false, error: statusCode }, { status: 500 });
    }

    if (statusCode === "FINISHED") {
      try {
        const postId = await publishThreadsContainer(containerId);

        let commentError: string | undefined;
        if (item.comment_text) {
          const result = await publishThreadsComment(postId, item.comment_text);
          commentError = result.commentError;
        }

        await admin.from("sns_queue")
          .update({
            status: "published",
            published_at: new Date().toISOString(),
            error_message: commentError ? `댓글 발행 실패: ${commentError}` : null,
          })
          .eq("id", item.id);

        return NextResponse.json({ ok: true, published: item.id });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await admin.from("sns_queue")
          .update({ status: "failed", error_message: msg })
          .eq("id", item.id);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
      }
    }

    // PUBLISHED 또는 알 수 없는 상태 — 다음 사이클에 재확인
    return NextResponse.json({ ok: true, message: `상태 확인 중: ${statusCode}` });
  }

  // ── STEP 2: 일일 발행 한도 (수동 테스트 제외) ────────────────
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

  // ── STEP 3: pending 항목 처리 ─────────────────────────────
  const { data: pendingRows, error: fetchError } = await admin
    .from("sns_queue")
    .select("*")
    .eq("status", "pending")
    .order("scheduled_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(1);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!pendingRows || pendingRows.length === 0) {
    const { count: failedCount } = await admin
      .from("sns_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed");
    if ((failedCount ?? 0) > 0) {
      return NextResponse.json({
        ok: true,
        message: `pending 없음 (실패 ${failedCount}개 — 큐에서 '재시도' 버튼 후 재시도)`,
      });
    }
    return NextResponse.json({ ok: true, message: "큐가 비어있습니다" });
  }

  const item = pendingRows[0] as {
    id: string;
    post_text: string;
    image_url: string | null;
    comment_text: string | null;
    media_type: string | null | undefined;
  };

  const isVideo =
    item.media_type === "video" ||
    (item.media_type == null && isVideoUrl(item.image_url));

  if (isVideo) {
    // ── 영상 사이클1: 컨테이너 생성만 → return ──────────────
    try {
      const creationId = await createThreadsContainer({
        postText: item.post_text,
        imageUrl: item.image_url,
        mediaType: "video",
      });

      const { error: updateError } = await admin.from("sns_queue")
        .update({ status: "processing", container_id: creationId })
        .eq("id", item.id);

      if (updateError) {
        const msg =
          "container_id 컬럼 없음 — SQL: ALTER TABLE sns_queue ADD COLUMN IF NOT EXISTS container_id text;";
        await admin.from("sns_queue")
          .update({ status: "failed", error_message: msg })
          .eq("id", item.id);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
      }

      return NextResponse.json({ ok: true, processing: item.id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await admin.from("sns_queue")
        .update({ status: "failed", error_message: msg })
        .eq("id", item.id);
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
  }

  // ── 이미지/텍스트: 컨테이너 → 30초 대기 → 발행 → 댓글 ────
  try {
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

    await admin.from("sns_queue")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        error_message: commentError ? `댓글 발행 실패: ${commentError}` : null,
      })
      .eq("id", item.id);

    return NextResponse.json({ ok: true, published: item.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin.from("sns_queue")
      .update({ status: "failed", error_message: msg })
      .eq("id", item.id);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// Vercel Cron — Authorization: Bearer {CRON_SECRET}
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

// 어드민 수동 테스트 — admin_auth 쿠키 (일일 한도 무시)
export async function POST(_req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_auth")?.value !== "true") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runPublish(true);
}
