// 확장 프로그램용 이미지 프록시
// 외부 이미지 URL을 받아서 R2에 업로드 후 공개 URL 반환

import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";

export const runtime = "nodejs";

function checkAuth(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  return key === process.env.ADMIN_PASSWORD;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let imageUrl: string;
  try {
    const body = await req.json();
    imageUrl = body.imageUrl;
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  if (!imageUrl) {
    return NextResponse.json({ error: "imageUrl 필수" }, { status: 400 });
  }

  // 외부 이미지 다운로드 (알리, 쿠팡 Referer 대응)
  let imgResponse: Response;
  try {
    imgResponse = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: imageUrl.includes("aliexpress")
          ? "https://www.aliexpress.com/"
          : "https://www.coupang.com/",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `이미지 다운로드 실패: ${msg}` }, { status: 502 });
  }

  if (!imgResponse.ok) {
    return NextResponse.json(
      { error: `이미지 다운로드 실패: HTTP ${imgResponse.status}` },
      { status: 502 }
    );
  }

  const rawContentType = imgResponse.headers.get("content-type") || "image/jpeg";
  // content-type에 charset 등 파라미터가 붙을 수 있으므로 앞부분만 추출
  const contentType = rawContentType.split(";")[0].trim();
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
    ? "webp"
    : contentType.includes("avif")
    ? "avif"
    : contentType.includes("gif")
    ? "gif"
    : "jpg";
  const key = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const buffer = Buffer.from(await imgResponse.arrayBuffer());

  try {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `R2 업로드 실패: ${msg}` }, { status: 500 });
  }

  const r2Url = `${R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  return NextResponse.json({ r2Url });
}
