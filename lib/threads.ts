export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(mp4|mov|webm|avi|m4v)(\?.*)?$/i.test(url);
}

function getCredentials(): { userId: string; accessToken: string } {
  const userId = process.env.THREADS_USER_ID;
  const accessToken = process.env.THREADS_ACCESS_TOKEN;
  if (!userId || !accessToken) throw new Error("THREADS_ACCESS_TOKEN 미설정");
  return { userId, accessToken };
}

// 컨테이너 생성 → creationId 반환
export async function createThreadsContainer(params: {
  postText: string;
  imageUrl?: string | null;
  mediaType?: string | null;
}): Promise<string> {
  const { userId, accessToken } = getCredentials();
  const useVideo =
    params.mediaType === "video" ||
    (params.mediaType == null && isVideoUrl(params.imageUrl));

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

  const res = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`컨테이너 생성 실패: ${JSON.stringify(err)}`);
  }
  const { id } = (await res.json()) as { id: string };
  return id;
}

// 컨테이너 상태 조회 (1회) → status_code 반환
export async function checkContainerStatus(creationId: string): Promise<string> {
  const { accessToken } = getCredentials();
  const res = await fetch(
    `https://graph.threads.net/v1.0/${creationId}?fields=status_code`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`상태 조회 실패 (HTTP ${res.status})`);
  const data = (await res.json()) as { status_code?: string };
  return data.status_code ?? "UNKNOWN";
}

// 준비된 컨테이너 발행 → postId 반환
export async function publishThreadsContainer(creationId: string): Promise<string> {
  const { userId, accessToken } = getCredentials();
  const res = await fetch(
    `https://graph.threads.net/v1.0/${userId}/threads_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: creationId, access_token: accessToken }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`발행 실패: ${JSON.stringify(err)}`);
  }
  const { id } = (await res.json()) as { id: string };
  return id;
}

// 댓글(reply) 발행 — 실패해도 non-fatal, commentError 반환
export async function publishThreadsComment(
  postId: string,
  commentText: string
): Promise<{ commentError?: string }> {
  const { userId, accessToken } = getCredentials();
  try {
    const createRes = await fetch(
      `https://graph.threads.net/v1.0/${userId}/threads`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: accessToken,
          text: commentText,
          media_type: "TEXT",
          reply_to_id: postId,
        }),
      }
    );
    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(`댓글 컨테이너 생성 실패: ${JSON.stringify(err)}`);
    }
    const { id: commentCreationId } = (await createRes.json()) as { id: string };

    // TEXT 컨테이너는 처리가 빠름 — 5초 대기로 충분
    await new Promise((r) => setTimeout(r, 5_000));

    const publishRes = await fetch(
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
    if (!publishRes.ok) {
      const err = await publishRes.json().catch(() => ({}));
      throw new Error(`댓글 발행 실패: ${JSON.stringify(err)}`);
    }
  } catch (err) {
    return { commentError: err instanceof Error ? err.message : String(err) };
  }
  return {};
}

// 이미지/텍스트 통합 발행 (기존 API 유지 — 영상은 cron 2사이클 방식 사용)
export async function publishToThreads(params: {
  postText: string;
  imageUrl?: string | null;
  mediaType?: string | null;
  commentText?: string | null;
}): Promise<{ commentError?: string }> {
  const creationId = await createThreadsContainer(params);

  // 이미지: 30초 고정 대기 (공식 권장)
  await new Promise((r) => setTimeout(r, 30_000));

  const postId = await publishThreadsContainer(creationId);

  if (params.commentText) {
    return publishThreadsComment(postId, params.commentText);
  }
  return {};
}
