import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { cookies } from "next/headers";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";

export const runtime = "nodejs";

// 이미지 직접 업로드 (4.5MB 이하 — Vercel 서버리스 제한)
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_auth")?.value !== "true") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let file: File | null = null;
  try {
    const formData = await req.formData();
    file = formData.get("file") as File | null;
  } catch {
    return NextResponse.json({ error: "요청 파싱 실패 — 파일이 너무 큽니다 (4.5MB 초과)" }, { status: 413 });
  }

  if (!file) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const key = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  try {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    );
  } catch (err) {
    console.error("[R2 업로드 실패]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `R2 업로드 실패: ${msg}` }, { status: 500 });
  }

  const url = `${R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  return NextResponse.json({ url });
}

// 영상 등 대용량 파일: Presigned URL 발급 → 브라우저에서 R2에 직접 업로드
export async function PUT(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_auth")?.value !== "true") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let filename: string;
  let contentType: string;
  try {
    const body = await req.json();
    filename = body.filename;
    contentType = body.contentType;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식" }, { status: 400 });
  }

  if (!filename || !contentType) {
    return NextResponse.json({ error: "filename, contentType 필수" }, { status: 400 });
  }

  const ext = filename.split(".").pop()?.toLowerCase() || "bin";
  const key = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  try {
    const uploadUrl = await getSignedUrl(
      r2Client,
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: 3600 }
    );

    const publicUrl = `${R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
    console.log("[R2 Presign OK] key:", key, "uploadUrl host:", new URL(uploadUrl).hostname);
    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (err) {
    console.error("[R2 Presign 실패]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Presigned URL 생성 실패: ${msg}` }, { status: 500 });
  }
}
