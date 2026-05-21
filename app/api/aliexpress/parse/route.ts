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

function getMeta(html: string, key: string): string {
  for (const attr of ["property", "name"]) {
    const m =
      html.match(new RegExp(`<meta[^>]+${attr}="${key}"[^>]+content="([^"]*)"`, "i")) ||
      html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+${attr}="${key}"`, "i"));
    if (m?.[1]) return m[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'");
  }
  return "";
}

function scrapeAliImages(html: string): string[] {
  const images: string[] = [];

  // window.runParams — imagePathList
  const rpMatch = html.match(/window\.runParams\s*=\s*(\{[\s\S]*?\})\s*;?\s*(?:\n|window\.)/);
  if (rpMatch) {
    try {
      const rp = JSON.parse(rpMatch[1]);
      const list: string[] =
        rp?.data?.imageModule?.imagePathList ??
        rp?.data?.pageModule?.listImagePathList ??
        [];
      for (const img of list) {
        images.push(img.startsWith("//") ? `https:${img}` : img);
      }
    } catch {}
  }

  return images;
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
      { error: "상품 URL에서 상품 ID를 찾을 수 없습니다. (예: aliexpress.com/item/123456789.html)" },
      { status: 400 }
    );
  }

  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;

  // ── 1차: Affiliate API (product.detail.get) ──────────────────
  if (appKey && appSecret) {
    try {
      const params: Record<string, string> = {
        app_key: appKey,
        timestamp: getTimestamp(),
        format: "json",
        v: "2.0",
        sign_method: "md5",
        method: "aliexpress.affiliate.product.detail.get",
        product_ids: productId,
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
      };
      params.sign = calcSign(params, appSecret);

      const res = await fetch("https://api-sg.aliexpress.com/sync", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: new URLSearchParams(params).toString(),
      });

      const data = await res.json();
      const respResult =
        data?.aliexpress_affiliate_product_detail_get_response?.resp_result;

      if (respResult?.resp_code === 200) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw: any[] = respResult.result?.products?.product ?? [];
        if (raw.length > 0) {
          const p = raw[0];
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

          return NextResponse.json({
            product_id: String(p.product_id),
            title: p.product_title ?? "",
            images,
            price: formatPrice(p.target_sale_price, p.target_sale_price_currency),
            affiliate_link: p.promotion_link ?? "",
          });
        }
      }
    } catch {}
  }

  // ── 2차: 페이지 직접 스크래핑 ────────────────────────────────
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
    });

    if (res.status === 403 || res.status === 429) {
      return NextResponse.json(
        { error: "알리익스프레스가 자동 접근을 차단했습니다. 잠시 후 다시 시도해주세요." },
        { status: 400 }
      );
    }

    const html = await res.text();
    const title = getMeta(html, "og:title");
    const ogImage = getMeta(html, "og:image");
    const ogPrice = getMeta(html, "og:price:amount");

    const extraImages = scrapeAliImages(html);
    const images = [
      ...new Set([...(ogImage ? [ogImage] : []), ...extraImages].filter(Boolean)),
    ];

    if (!title && images.length === 0) {
      return NextResponse.json(
        { error: "상품 정보를 가져오지 못했습니다. 키워드 검색을 이용해주세요." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      product_id: productId,
      title,
      images,
      price: ogPrice ? `₩ ${Number(ogPrice).toLocaleString("ko-KR")}` : "",
      affiliate_link: url,
    });
  } catch {
    return NextResponse.json({ error: "URL 접근 중 오류가 발생했습니다." }, { status: 500 });
  }
}
