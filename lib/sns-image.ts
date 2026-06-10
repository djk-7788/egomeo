import sharp from "sharp";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "./r2";

export async function processImageForSns(sourceUrl: string): Promise<string> {
  const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    throw new Error(`이미지 다운로드 실패 (HTTP ${res.status})`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());

  // 모든 포맷(webp/avif/jpg/png) → JPEG 변환, 최대 1440px, 품질 85
  const processed = await sharp(buffer)
    .resize(1440, 1440, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  const key = `sns/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: processed,
      ContentType: "image/jpeg",
    })
  );

  return `${R2_PUBLIC_URL}/${key}`;
}
