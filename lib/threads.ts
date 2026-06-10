export async function publishToThreads(params: {
  postText: string;
  imageUrl?: string | null;
}): Promise<void> {
  const userId = process.env.THREADS_USER_ID;
  const accessToken = process.env.THREADS_ACCESS_TOKEN;

  if (!userId || !accessToken) {
    throw new Error("THREADS_ACCESS_TOKEN 미설정");
  }

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
}
