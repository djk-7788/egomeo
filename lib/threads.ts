export async function publishToThreads(params: {
  postText: string;
  imageUrl?: string | null;
  commentText?: string | null;
}): Promise<{ commentError?: string }> {
  const userId = process.env.THREADS_USER_ID;
  const accessToken = process.env.THREADS_ACCESS_TOKEN;

  if (!userId || !accessToken) {
    throw new Error("THREADS_ACCESS_TOKEN 미설정");
  }

  // ── 1단계: 본문 컨테이너 생성 ─────────────────────
  const body: Record<string, string> = {
    access_token: accessToken,
    text: params.postText,
    media_type: params.imageUrl ? "IMAGE" : "TEXT",
  };
  if (params.imageUrl) {
    body.image_url = params.imageUrl;
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

  // Threads 미디어 서버 처리 대기 (공식 권장: 30초)
  await new Promise((r) => setTimeout(r, 30_000));

  // ── 2단계: 본문 발행 ──────────────────────────────
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

  // ── 3~4단계: 댓글 발행 (실패해도 본문 published 유지) ──
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
