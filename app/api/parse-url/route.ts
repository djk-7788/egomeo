import { NextRequest, NextResponse } from "next/server";

type ParseResult = {
  title: string;
  images: string[];
  price: string;
  source: string;
  productUrl: string;
};

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
  "Cache-Control": "no-cache",
};

function getMeta(html: string, key: string): string {
  for (const attr of ["property", "name"]) {
    const m =
      html.match(new RegExp(`<meta[^>]+${attr}="${key}"[^>]+content="([^"]*)"`, "i")) ||
      html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+${attr}="${key}"`, "i"));
    if (m?.[1]) return m[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'");
  }
  return "";
}

function getJsonLdProduct(html: string): Partial<ParseResult> | null {
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    try {
      const raw = JSON.parse(match[1]);
      const items: unknown[] = Array.isArray(raw) ? raw : [raw];
      for (const item of items) {
        const p = item as Record<string, unknown>;
        if (p["@type"] !== "Product") continue;
        const imgs = Array.isArray(p.image)
          ? (p.image as string[])
          : typeof p.image === "string"
          ? [p.image]
          : [];
        const offer = p.offers as Record<string, unknown> | undefined;
        const rawPrice = String(offer?.price ?? offer?.lowPrice ?? "");
        const currency = String(offer?.priceCurrency ?? "");
        return {
          title: String(p.name ?? ""),
          images: imgs.filter(Boolean),
          price: rawPrice ? fmtPrice(rawPrice, currency) : "",
        };
      }
    } catch {}
  }
  return null;
}

function fmtPrice(amount: string, currency: string): string {
  const n = parseFloat(amount.replace(/,/g, ""));
  if (isNaN(n)) return amount;
  if (currency === "KRW") return `₩ ${Math.round(n).toLocaleString("ko-KR")}`;
  if (currency === "USD") return `$${n.toFixed(2)}`;
  if (currency === "JPY") return `¥ ${Math.round(n).toLocaleString("ja-JP")}`;
  return amount;
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean)));
}

// ─── Coupang ──────────────────────────────────────────────
function parseCoupang(html: string, url: string): ParseResult {
  const ld = getJsonLdProduct(html);
  const extra: string[] = [];

  // __NEXT_DATA__ → productImageList
  const nd = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nd) {
    try {
      const j = JSON.parse(nd[1]);
      const list =
        j?.props?.pageProps?.product?.productImageList ??
        j?.props?.pageProps?.productDetail?.images;
      if (Array.isArray(list)) extra.push(...(list as string[]));
    } catch {}
  }

  // inline script fallback
  if (extra.length === 0) {
    const m = html.match(/"productImageList"\s*:\s*(\["[^"]*"(?:,\s*"[^"]*")*\])/);
    if (m) {
      try { extra.push(...(JSON.parse(m[1]) as string[])); } catch {}
    }
  }

  const ogImage = getMeta(html, "og:image");
  const ogTitle = getMeta(html, "og:title");
  const ogPrice =
    getMeta(html, "product:price:amount") || getMeta(html, "og:price:amount");

  const priceMatch =
    html.match(/<strong[^>]+class="[^"]*total-price[^"]*"[^>]*>([\d,]+)/i) ||
    html.match(/class="price-value"[^>]*>([\d,]+)/i);
  const rawPrice = priceMatch?.[1]?.replace(/,/g, "") ?? ogPrice;

  return {
    title: ld?.title || ogTitle || "",
    images: dedupe([...(ld?.images ?? []), ...extra, ...(ogImage ? [ogImage] : [])]),
    price: ld?.price || (rawPrice ? `₩ ${Number(rawPrice).toLocaleString("ko-KR")}` : ""),
    source: "coupang",
    productUrl: url,
  };
}

// ─── Amazon ───────────────────────────────────────────────
function parseAmazon(html: string, url: string): ParseResult {
  const ld = getJsonLdProduct(html);
  const extra: string[] = [];

  // data-a-dynamic-image (main image sizes)
  const dyn = html.match(/data-a-dynamic-image="([^"]+)"/);
  if (dyn) {
    try {
      const obj = JSON.parse(dyn[1].replace(/&quot;/g, '"')) as Record<string, unknown>;
      extra.push(...Object.keys(obj));
    } catch {}
  }

  // colorImages JSON in embedded script
  const col = html.match(/'colorImages'\s*[^:]*:\s*\{\s*'initial'\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
  if (col) {
    try {
      const imgs = JSON.parse(col[1]) as Array<Record<string, string>>;
      for (const img of imgs) {
        if (img.hiRes) extra.push(img.hiRes);
        else if (img.large) extra.push(img.large);
      }
    } catch {}
  }

  const ogTitle = getMeta(html, "og:title");
  const ogImage = getMeta(html, "og:image");

  // price
  const whole = html.match(/<span[^>]+class="[^"]*a-price-whole[^"]*"[^>]*>([\d,.]+)/);
  const frac = html.match(/<span[^>]+class="[^"]*a-price-fraction[^"]*"[^>]*>(\d+)/);
  let price = ld?.price || "";
  if (!price && whole) {
    price = `$${whole[1].replace(/[,. ]/g, "")}.${frac?.[1] ?? "00"}`;
  }

  return {
    title: ld?.title || ogTitle || "",
    images: dedupe([...(ld?.images ?? []), ...extra, ...(ogImage ? [ogImage] : [])]),
    price,
    source: "amazon",
    productUrl: url,
  };
}

// ─── Route handler ────────────────────────────────────────
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")?.trim();
  if (!url) return NextResponse.json({ error: "URL을 입력하세요." }, { status: 400 });

  const isCoupang = url.includes("coupang.com");
  const isAmazon = /amazon\.(com|co\.jp|co\.uk|de|fr|ca|com\.au)/.test(url);
  if (!isCoupang && !isAmazon) {
    return NextResponse.json(
      { error: "쿠팡 또는 아마존 URL만 지원합니다." },
      { status: 400 }
    );
  }

  let html: string;
  try {
    const res = await fetch(url, { headers: HEADERS, redirect: "follow" });
    if (res.status === 403 || res.status === 429) {
      return NextResponse.json(
        { error: "해당 사이트가 자동 접근을 차단했습니다. 잠시 후 다시 시도하거나 직접 입력해주세요." },
        { status: 400 }
      );
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: `페이지를 불러올 수 없습니다. (HTTP ${res.status})` },
        { status: 400 }
      );
    }
    html = await res.text();
  } catch {
    return NextResponse.json({ error: "URL 접근 중 오류가 발생했습니다." }, { status: 500 });
  }

  const result = isCoupang ? parseCoupang(html, url) : parseAmazon(html, url);

  if (!result.title && result.images.length === 0) {
    return NextResponse.json(
      { error: "상품 정보를 추출할 수 없습니다. 로그인이 필요한 페이지이거나 URL이 올바르지 않을 수 있습니다." },
      { status: 400 }
    );
  }

  return NextResponse.json(result);
}
