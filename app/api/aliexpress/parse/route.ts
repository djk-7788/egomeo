import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function calcSign(params: Record<string, string>, secret: string): string {
  const str =
    secret +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("") +
    secret;
  return crypto.createHash("md5").update(str, "utf8").digest("hex").toUpperCase();
}

function formatPrice(price: string, currency: string): string {
  const num = parseFloat(price);
  if (isNaN(num)) return price || "";
  if (currency === "KRW") return `₩ ${Math.round(num).toLocaleString("ko-KR")}`;
  return `$${num.toFixed(2)}`;
}

function extractProductId(url: string): string | null {
  const m = url.match(/\/item\/(\d+)/);
  return m?.[1] ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseProduct(p: any): {
  product_id: string;
  title: string;
  images: string[];
  price: string;
  affiliate_link: string;
} {
  const mainImage: string = p.product_main_image_url ?? "";
  const smallRaw = p.product_small_image_urls;
  const smallImages: string[] = Array.isArray(smallRaw)
    ? smallRaw
    : Array.isArray(smallRaw?.string)
    ? smallRaw.string
    : [];
  const images = [
    mainImage,
    ...smallImages.filter((u: string) => u && u !== mainImage),
  ].filter(Boolean);

  return {
    product_id: String(p.product_id),
    title: p.product_title ?? "",
    images,
    price: formatPrice(p.target_sale_price, p.target_sale_price_currency),
    affiliate_link: p.promotion_link ?? "",
  };
}

async function callAffiliateApi(
  method: string,
  extraParams: Record<string, string>,
  appKey: string,
  appSecret: string
) {
  const params: Record<string, string> = {
    app_key: appKey,
    timestamp: getTimestamp(),
    format: "json",
    v: "2.0",
    sign_method: "md5",
    method,
    target_currency: "KRW",
    target_language: "KO",
    fields: [
      "product_id",
      "product_title",
      "product_main_image_url",
      "product_small_image_urls",
      "target_sale_price",
      "target_sale_price_currency",
      "promotion_link",
    ].join(","),
    ...extraParams,
  };
  params.sign = calcSign(params, appSecret);

  const res = await fetch("https://api-sg.aliexpress.com/sync", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams(params).toString(),
  });
  return res.json();
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")?.trim();
  if (!url) return NextResponse.json({ error: "URL을 입력하세요." }, { status: 400 });

  if (!/aliexpress\.com/i.test(url)) {
    return NextResponse.json({ error: "알리익스프레스 URL만 지원합니다." }, { status: 400 });
  }

  const productId = extractProductId(url);
  if (!productId) {
    return NextResponse.json(
      { error: "상품 URL에서 상품 ID를 찾을 수 없습니다.\n예: aliexpress.com/item/1005006123456789.html" },
      { status: 400 }
    );
  }

  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;
  if (!appKey || !appSecret) {
    return NextResponse.json({ error: "API 키가 설정되지 않았습니다." }, { status: 500 });
  }

  // ── 1차: aliexpress.affiliate.productdetail.get ───────────────
  try {
    const data = await callAffiliateApi(
      "aliexpress.affiliate.productdetail.get",
      { product_ids: productId },
      appKey,
      appSecret
    );
    const respResult = data?.aliexpress_affiliate_productdetail_get_response?.resp_result;
    console.log("[ali-parse] productdetail.get:", JSON.stringify(respResult).slice(0, 300));

    if (respResult?.resp_code === 200) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any[] = respResult.result?.products?.product ?? [];
      if (raw.length > 0) return NextResponse.json(parseProduct(raw[0]));
    }
  } catch (e) {
    console.error("[ali-parse] productdetail.get error:", e);
  }

  // ── 2차: aliexpress.affiliate.product.query (product_ids 필터) ─
  try {
    const data = await callAffiliateApi(
      "aliexpress.affiliate.product.query",
      { product_ids: productId, page_no: "1", page_size: "1" },
      appKey,
      appSecret
    );
    const respResult = data?.aliexpress_affiliate_product_query_response?.resp_result;
    console.log("[ali-parse] product.query:", JSON.stringify(respResult).slice(0, 300));

    if (respResult?.resp_code === 200) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any[] = respResult.result?.products?.product ?? [];
      if (raw.length > 0) return NextResponse.json(parseProduct(raw[0]));
    }

    const apiMsg = respResult?.resp_msg ?? "API에서 상품을 찾지 못했습니다.";
    return NextResponse.json(
      { error: `상품 조회 실패: ${apiMsg} (ID: ${productId})` },
      { status: 400 }
    );
  } catch (e) {
    console.error("[ali-parse] product.query error:", e);
    return NextResponse.json({ error: "API 호출 중 오류가 발생했습니다." }, { status: 500 });
  }
}
