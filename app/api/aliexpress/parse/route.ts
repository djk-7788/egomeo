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
  original_price: string;
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

  const originalPrice = p.target_original_price
    ? formatPrice(p.target_original_price, p.target_original_price_currency ?? p.target_sale_price_currency)
    : "";

  return {
    product_id: String(p.product_id),
    title: p.product_title ?? "",
    images,
    price: formatPrice(p.target_sale_price, p.target_sale_price_currency),
    original_price: originalPrice,
    affiliate_link: p.promotion_link ?? "",
  };
}

async function callAffiliateApi(
  method: string,
  extraParams: Record<string, string>,
  appKey: string,
  appSecret: string,
  extraFixed?: Record<string, string>
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
      "target_original_price",
      "target_original_price_currency",
      "promotion_link",
    ].join(","),
    ...extraFixed,
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

// 원본 URL → 어필리에이트 링크 직접 변환 (상품 ID 보존 보장)
async function generateAffiliateLinkFromUrl(
  sourceUrl: string,
  trackingId: string,
  appKey: string,
  appSecret: string
): Promise<string | null> {
  try {
    const params: Record<string, string> = {
      app_key: appKey,
      timestamp: getTimestamp(),
      format: "json",
      v: "2.0",
      sign_method: "md5",
      method: "aliexpress.affiliate.link.generate",
      promotion_link_type: "0",
      source_values: sourceUrl,
      tracking_id: trackingId,
    };
    params.sign = calcSign(params, appSecret);

    const res = await fetch("https://api-sg.aliexpress.com/sync", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: new URLSearchParams(params).toString(),
    });
    const data = await res.json();
    const respResult = data?.aliexpress_affiliate_link_generate_response?.resp_result;
    console.log("[ali-parse] link.generate:", JSON.stringify(respResult).slice(0, 300));

    if (respResult?.resp_code === 200) {
      const links: { promotion_link?: string }[] =
        respResult.result?.promotion_links?.promotion_link ?? [];
      return links[0]?.promotion_link ?? null;
    }
  } catch (e) {
    console.error("[ali-parse] link.generate error:", e);
  }
  return null;
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
  const trackingId = process.env.ALIEXPRESS_TRACKING_ID ?? "default";
  if (!appKey || !appSecret) {
    return NextResponse.json({ error: "API 키가 설정되지 않았습니다." }, { status: 500 });
  }

  // ── 1단계: link.generate로 원본 URL → 어필리에이트 링크 (상품 ID 보존) ──
  // 가장 신뢰할 수 있는 방법. 원본 URL의 상품 ID가 그대로 affiliate URL에 유지됨.
  const affiliateLink = await generateAffiliateLinkFromUrl(url, trackingId, appKey, appSecret);

  // ── 2단계: productdetail.get으로 상품 정보 조회 (ID 검증 필수) ─────────
  let productInfo: ReturnType<typeof parseProduct> | null = null;

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
      // 반드시 요청한 product_id와 일치하는 상품만 사용
      const matched = raw.find((p) => String(p.product_id) === productId);
      if (matched) productInfo = parseProduct(matched);
    }
  } catch (e) {
    console.error("[ali-parse] productdetail.get error:", e);
  }

  // productdetail에서 못 찾으면 product.query로 재시도 (ID 검증 포함)
  if (!productInfo) {
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
        const matched = raw.find((p) => String(p.product_id) === productId);
        if (matched) productInfo = parseProduct(matched);
      }
    } catch (e) {
      console.error("[ali-parse] product.query error:", e);
    }
  }

  // ── 결과 조합 ────────────────────────────────────────────────────────────
  if (!affiliateLink && !productInfo) {
    return NextResponse.json(
      { error: `상품 조회 실패. 어필리에이트 프로그램에 등록된 상품인지 확인하세요. (ID: ${productId})` },
      { status: 400 }
    );
  }

  // link.generate가 실패한 경우 productdetail의 promotion_link를 사용하되
  // 그마저 없으면 에러
  const finalAffiliateLink = affiliateLink ?? productInfo?.affiliate_link ?? "";
  if (!finalAffiliateLink) {
    return NextResponse.json(
      { error: `어필리에이트 링크 생성 실패. 해당 상품이 프로모션 대상인지 확인하세요. (ID: ${productId})` },
      { status: 400 }
    );
  }

  return NextResponse.json({
    product_id: productId,
    title: productInfo?.title ?? "",
    images: productInfo?.images ?? [],
    price: productInfo?.price ?? "",
    original_price: productInfo?.original_price ?? "",
    affiliate_link: finalAffiliateLink,
  });
}
