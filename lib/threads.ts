export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(mp4|mov|webm|avi|m4v)(\?.*)?$/i.test(url);
}

// 영상 컨테이너 상태 폴링 — 15초 간격, 최대 16회(4분)
async function pollUntilReady(
  creationId: string,
  accessToken: string
): Promise<void> {
  const MAX_POLLS = 16;
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, 15_000));
    const res = await fetch(
      `https://graph.threads.net/v1.0/${creationId}?fields=status_code`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) continue; // 네트워크 오류 → 재시도
    const data = (await res.json()) as { status_code?: string };
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR") {
      throw new Error("Threads 영상 처리 실패 (서버 오류)");
    }
    // IN_PROGRESS → 계속 대기
  }
  throw new Error("Threads 영상 처리 타임아웃 (4분 초과)");
}

export async function publishToThreads(params: {
  postText: string;
  imageUrl?: string | null;
  mediaType?: string | null; // 'video' | 'image' | 'text' — 명시적 타입 우선, null이면 URL 확장자로 폴백
  commentText?: string | null;
}): Promise<{ commentError?: string }> {
  const userId = process.env.THREADS_USER_ID;
  const accessToken = process.env.THREADS_ACCESS_TOKEN;

  if (!userId || !accessToken) {
    throw new Error("THREADS_ACCESS_TOKEN 미설정");
  }

  // media_type 컬럼이 있으면 우선 사용, 없으면 URL 확장자로 폴백
  const useVideo =
    params.mediaType === "video" ||
    (params.mediaType == null && isVideoUrl(params.imageUrl));

  // ── 1단계: 본문 컨테이너 생성 ─────────────────────
  const body: Record<string, string> = {
    access_token: accessToken,
    text: params.postText,
  };

  if (useVideo) {
    body.media_type = "VIDEO";
    body.video_url = params.imageUrl!;
  } else if (params.imageUrl) {
    body.media_type = "IMAGE";
    body.image_url = params.imageUrl;
  } else {
    body.media_type = "TEXT";
  }

  const createRes = await fetch(
    `https://graph.threads.net/v1.0/${userId}/threads`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(`컨테이너 생성 실패: ${JSON.stringify(err)}`);
  }

  const { id: creationId } = (await createRes.json()) as { id: string };

  // ── 2단계: 미디어 서버 처리 대기 ──────────────────
  if (useVideo) {
    // 영상: 상태 폴링 (15초 간격, 최대 4분)
    await pollUntilReady(creationId, accessToken);
  } else {
    // 이미지/텍스트: 공식 권장 30초 고정 대기
    await new Promise((r) => setTimeout(r, 30_000));
  }

  // ── 3단계: 본문 발행 ──────────────────────────────
  const publishRes = await fetch(
    `https://graph.threads.net/v1.0/${userId}/threads_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: accessToken,
      }),
    }
  );
  if (!publishRes.ok) {
    const err = await publishRes.json().catch(() => ({}));
    throw new Error(`발행 실패: ${JSON.stringify(err)}`);
  }

  const { id: postId } = (await publishRes.json()) as { id: string };

  // ── 4~5단계: 댓글 발행 (실패해도 본문 published 유지) ──
  if (params.commentText) {
    try {
      const commentCreateRes = await fetch(
        `https://graph.threads.net/v1.0/${userId}/threads`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: accessToken,
            text: params.commentText,
            media_type: "TEXT",
            reply_to_id: postId,
          }),
        }
      );
      if (!commentCreateRes.ok) {
        const err = await commentCreateRes.json().catch(() => ({}));
        throw new Error(`댓글 컨테이너 생성 실패: ${JSON.stringify(err)}`);
      }

      const { id: commentCreationId } = (await commentCreateRes.json()) as {
        id: string;
      };

      await new Promise((r) => setTimeout(r, 30_000));

      const commentPublishRes = await fetch(
        `https://graph.threads.net/v1.0/${userId}/threads_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creation_id: commentCreationId,
            access_token: accessToken,
          }),
        }
      );
      if (!commentPublishRes.ok) {
        const err = await commentPublishRes.json().catch(() => ({}));
        throw new Error(`댓글 발행 실패: ${JSON.stringify(err)}`);
      }
    } catch (err) {
      return {
        commentError: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {};
}
