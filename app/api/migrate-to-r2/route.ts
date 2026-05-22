import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_auth")?.value !== "true") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: products, error } = await supabase
    .from("products")
    .select("id, image_url")
    .like("image_url", "%supabase.co%");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!products || products.length === 0) {
    return NextResponse.json({ message: "마이그레이션할 이미지가 없습니다.", migrated: 0, failed: 0, total: 0 });
  }

  let migrated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const product of products) {
    try {
      const res = await fetch(product.image_url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const contentType = res.headers.get("content-type") || "image/jpeg";
      const buffer = Buffer.from(await res.arrayBuffer());
      const ext = contentType.split("/")[1]?.split(";")[0]?.replace("jpeg", "jpg") || "jpg";
      const key = `migrated-${product.id}.${ext}`;

      await r2Client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      );

      const newUrl = `${R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;

      await supabase.from("products").update({ image_url: newUrl }).eq("id", product.id);

      migrated++;
    } catch (e) {
      failed++;
      errors.push(`${product.id}: ${String(e)}`);
    }
  }

  return NextResponse.json({ migrated, failed, errors, total: products.length });
}
