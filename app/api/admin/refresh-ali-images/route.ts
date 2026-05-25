import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { cookies } from "next/headers";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 300;

// ── 이미지 URL 원본화 (content.js와 동일 로직) ──────────────────
function upgradeAliRes(src: string): string {
  src = src.replace(/_\.\w+$/, "");                               // _.avif 등 포맷 접미사
  src = src.replace(/(\.\w+)_\d+x\d+[a-z0-9]*\.\w+$/, "$1");   // file.jpg_220x220q75.jpg
  src = src.replace(/_\d+x\d+[a-z0-9]*(\.\w+)$/, "$1");         // file_220x220q75.jpg
  return src;
}

// ── affiliate_link → AliExpress item ID (리다이렉트 추적) ────────
async function resolveItemId(link: string): Promise<string | null> {
  const direct = link.match(/\/item\/(\d+)/);
  if (direct) return direct[1];

  if (!link.includes("s.click.aliexpress.com")) return null;

  try {
    const res = await fetch(link, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(12_000),
    });
    return res.url.match(/\/item\/(\d+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

// ── AliExpress API: product_main_image_url 조회 ──────────────────
function getTimestamp() {
  const now = new Date();
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
}
function calcSign(params: Record<string, string>, secret: string) {
  const str =
    secret + Object.keys(params).sort().map((k) => k + params[k]).join("") + secret;
  return crypto.createHash("md5").update(str, "utf8").digest("hex").toUpperCase();
}

async function fetchAliImageUrl(
  itemId: string,
  appKey: string,
  appSecret: string
): Promise<string | null> {
  const params: Record<string, string> = {
    app_key: appKey,
    timestamp: getTimestamp(),
    format: "json",
    v: "2.0",
    sign_method: "md5",
    method: "aliexpress.affiliate.productdetail.get",
    product_ids: itemId,
    target_currency: "KRW",
    target_language: "KO",
    fields: "product_id,product_main_image_url",
  };
  params.sign = calcSign(params, appSecret);

  const res = await fetch("https://api-sg.aliexpress.com/sync", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(10_000),
  });

  const data = await res.json();
  const respResult = data?.aliexpress_affiliate_productdetail_get_response?.resp_result;
  if (respResult?.resp_code !== 200) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const products: any[] = respResult.result?.products?.product ?? [];
  const product = products.find((p) => String(p.product_id) === itemId);
  const rawUrl: string = product?.product_main_image_url ?? "";
  return rawUrl ? upgradeAliRes(rawUrl) : null;
}

// ── 이미지 다운로드 → R2 업로드 ──────────────────────────────────
async function uploadToR2(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://www.aliexpress.com/",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`이미지 다운로드 실패 HTTP ${res.status}`);

  const rawCt = res.headers.get("content-type") || "image/jpeg";
  const contentType = rawCt.split(";")[0].trim();
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
    ? "webp"
    : contentType.includes("avif")
    ? "avif"
    : "jpg";

  const key = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(await res.arrayBuffer());

  await r2Client.send(
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: buffer, ContentType: contentType })
  );

  return `${R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
}

// ── POST: 스트리밍으로 진행상황 실시간 전송 ──────────────────────
export async function POST(_req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_auth")?.value !== "true") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;
  if (!appKey || !appSecret) {
    return NextResponse.json({ error: "ALIEXPRESS API 키 미설정" }, { status: 500 });
  }

  const { data: products, error } = await supabase
    .from("products")
    .select("id, title, affiliate_link")
    .eq("platform", "aliexpress")
    .like("image_url", "%pub-ca7c5843%");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (products ?? []) as { id: string; title: string; affiliate_link: string }[];
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      send({ type: "total", count: items.length });

      let success = 0, failed = 0, skipped = 0;

      for (let i = 0; i < items.length; i++) {
        const { id, title, affiliate_link } = items[i];
        const base = { done: i + 1, total: items.length, id, title };

        try {
          // 1. item ID 추출
          const itemId = await resolveItemId(affiliate_link);
          if (!itemId) {
            skipped++;
            send({ type: "progress", ...base, status: "skipped", reason: "item ID 추출 실패" });
            continue;
          }

          // 2. 고화질 이미지 URL 조회
          const hqUrl = await fetchAliImageUrl(itemId, appKey, appSecret);
          if (!hqUrl) {
            skipped++;
            send({ type: "progress", ...base, status: "skipped", reason: "이미지 없음 (상품 삭제 or API 제한)" });
            continue;
          }

          // 3. R2 업로드
          const r2Url = await uploadToR2(hqUrl);

          // 4. DB 업데이트
          const { error: updateErr } = await supabase
            .from("products")
            .update({ image_url: r2Url })
            .eq("id", id);
          if (updateErr) throw new Error(updateErr.message);

          success++;
          send({ type: "progress", ...base, status: "ok" });
        } catch (err) {
          failed++;
          send({
            type: "progress",
            ...base,
            status: "error",
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      }

      send({ type: "done", success, failed, skipped });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
