/**
 * 영상 청크 업로드 — CORS 없이 Vercel 경유 R2 저장
 *
 * 흐름:
 *   1. init   → uploadId + key 발급
 *   2. chunk  → 각 청크를 R2에 temp/{uploadId}/part-N 으로 저장 (3.5MB씩)
 *   3. finish → 서버에서 모든 청크 다운로드 → 이어붙여 최종 키로 R2 PUT
 *   4. abort  → 임시 청크 전체 삭제
 *
 * R2 멀티파트(최소 5MB) 를 쓰지 않으므로 Vercel 4.5MB 제한과 충돌 없음.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { cookies } from "next/headers";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 60;

async function checkAuth() {
  const cookieStore = await cookies();
  return cookieStore.get("admin_auth")?.value === "true";
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // ── 1. 업로드 ID + 최종 키 발급 ─────────────────────────────
  if (action === "init") {
    const { filename, contentType } = await req.json();
    const ext = (filename as string).split(".").pop()?.toLowerCase() || "bin";
    const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const key = `video-${uploadId}.${ext}`;
    console.log("[ChunkUpload Init]", key);
    return NextResponse.json({ uploadId, key, contentType });
  }

  // ── 2. 청크 1개 → R2 임시 오브젝트로 저장 ───────────────────
  if (action === "chunk") {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "청크 파싱 실패 (3.5MB 이하로 분할 필요)" },
        { status: 413 }
      );
    }

    const chunk = formData.get("file") as File;
    const uploadId = formData.get("uploadId") as string;
    const partNumber = Number(formData.get("partNumber"));

    if (!chunk || !uploadId || !partNumber) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    const tempKey = `temp/${uploadId}/part-${partNumber}`;
    const buffer = Buffer.from(await chunk.arrayBuffer());

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: tempKey,
        Body: buffer,
        ContentType: "application/octet-stream",
      })
    );

    console.log("[ChunkUpload Part]", tempKey, `${(buffer.length / 1024 / 1024).toFixed(1)}MB`);
    return NextResponse.json({ ok: true });
  }

  // ── 3. 모든 청크 병합 → 최종 R2 오브젝트 저장 ───────────────
  if (action === "finish") {
    const { uploadId, key, numParts, contentType } = await req.json() as {
      uploadId: string;
      key: string;
      numParts: number;
      contentType: string;
    };

    console.log("[ChunkUpload Finish] 병합 시작:", key, numParts, "개 청크");

    // 모든 청크 다운로드
    const buffers: Buffer[] = [];
    for (let i = 1; i <= numParts; i++) {
      const tempKey = `temp/${uploadId}/part-${i}`;
      const { Body } = await r2Client.send(
        new GetObjectCommand({ Bucket: R2_BUCKET, Key: tempKey })
      );
      if (!Body) throw new Error(`청크 ${i} 다운로드 실패`);
      const bytes = await Body.transformToByteArray();
      buffers.push(Buffer.from(bytes));
    }

    const combined = Buffer.concat(buffers);
    console.log("[ChunkUpload Finish] 병합 완료:", `${(combined.length / 1024 / 1024).toFixed(1)}MB`);

    // 최종 파일 R2 저장
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: combined,
        ContentType: contentType,
        ContentLength: combined.length,
      })
    );

    // 임시 청크 비동기 삭제 (응답 후 처리)
    Promise.all(
      Array.from({ length: numParts }, (_, i) =>
        r2Client.send(
          new DeleteObjectCommand({
            Bucket: R2_BUCKET,
            Key: `temp/${uploadId}/part-${i + 1}`,
          })
        )
      )
    ).catch((e) => console.warn("[ChunkUpload Cleanup 실패]", e));

    const publicUrl = `${R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
    console.log("[ChunkUpload Finish] 완료:", publicUrl);
    return NextResponse.json({ url: publicUrl });
  }

  // ── 4. 업로드 중단 → 임시 청크 삭제 ────────────────────────
  if (action === "abort") {
    const { uploadId, numParts } = await req.json();
    if (numParts) {
      await Promise.all(
        Array.from({ length: numParts }, (_, i) =>
          r2Client
            .send(
              new DeleteObjectCommand({
                Bucket: R2_BUCKET,
                Key: `temp/${uploadId}/part-${i + 1}`,
              })
            )
            .catch(() => {})
        )
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
}
