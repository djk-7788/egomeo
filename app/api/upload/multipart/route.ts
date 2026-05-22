/**
 * 영상 청크 업로드 — CORS 없이 Vercel 경유로 R2 멀티파트 업로드
 *
 * POST  action=init    → { uploadId, key }
 * POST  action=chunk   → { etag }  (formData: file, uploadId, key, partNumber)
 * POST  action=finish  → { url }   (body: { uploadId, key, parts })
 * POST  action=abort   → { ok }    (body: { uploadId, key })
 */
import { NextRequest, NextResponse } from "next/server";
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
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

  // ── 1. 멀티파트 업로드 시작 ──────────────────────────────
  if (action === "init") {
    const { filename, contentType } = await req.json();
    const ext = (filename as string).split(".").pop()?.toLowerCase() || "bin";
    const key = `video-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { UploadId } = await r2Client.send(
      new CreateMultipartUploadCommand({
        Bucket: R2_BUCKET,
        Key: key,
        ContentType: contentType,
      })
    );

    console.log("[Multipart Init]", key, "uploadId:", UploadId);
    return NextResponse.json({ uploadId: UploadId, key });
  }

  // ── 2. 청크 1개 업로드 ───────────────────────────────────
  if (action === "chunk") {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "청크 파싱 실패 (파일이 너무 큼 — 3.5MB 이하로 분할 필요)" }, { status: 413 });
    }

    const file = formData.get("file") as File;
    const uploadId = formData.get("uploadId") as string;
    const key = formData.get("key") as string;
    const partNumber = Number(formData.get("partNumber"));

    if (!file || !uploadId || !key || !partNumber) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const { ETag } = await r2Client.send(
      new UploadPartCommand({
        Bucket: R2_BUCKET,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: buffer,
      })
    );

    console.log("[Multipart Chunk]", key, "part", partNumber, "ETag:", ETag);
    return NextResponse.json({ etag: ETag });
  }

  // ── 3. 멀티파트 업로드 완료 ──────────────────────────────
  if (action === "finish") {
    const { uploadId, key, parts } = await req.json() as {
      uploadId: string;
      key: string;
      parts: { PartNumber: number; ETag: string }[];
    };

    await r2Client.send(
      new CompleteMultipartUploadCommand({
        Bucket: R2_BUCKET,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      })
    );

    const publicUrl = `${R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
    console.log("[Multipart Finish]", key, "→", publicUrl);
    return NextResponse.json({ url: publicUrl });
  }

  // ── 4. 중단 ─────────────────────────────────────────────
  if (action === "abort") {
    const { uploadId, key } = await req.json();
    await r2Client.send(
      new AbortMultipartUploadCommand({
        Bucket: R2_BUCKET,
        Key: key,
        UploadId: uploadId,
      })
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
}
