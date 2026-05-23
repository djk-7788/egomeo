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

export async function GET(req: NextRequest) {
  const keyword = req.nextUrl.searchParams.get("keyword")?.trim();
  const sort = req.nextUrl.searchParams.get("sort")?.trim() || "";
  const categoryId = req.nextUrl.searchParams.get("category")?.trim() || "";
  if (!keyword) {
    return NextResponse.json({ error: "키워드를 입력하세요." }, { status: 400 });
  }

  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;

  if (!appKey || !appSecret) {
    const missing = [
      !appKey && "ALIEXPRESS_APP_KEY",
      !appSecret && "ALIEXPRESS_APP_SECRET",
    ].filter(Boolean);
    console.error("[aliexpress] 누락된 환경변수:", missing);
    return NextResponse.json(
      { error: `환경변수 누락: ${missing.join(", ")}` },
      { status: 500 }
    );
  }

  const params: Record<string, string> = {
    app_key: appKey,
    timestamp: getTimestamp(),
    format: "json",
    v: "2.0",
    sign_method: "md5",
    method: "aliexpress.affiliate.product.query",
    keywords: keyword,
    page_no: "1",
    page_size: "50",
    target_currency: "KRW",
    target_language: "KO",
    ...(sort ? { sort } : {}),
    ...(categoryId ? { category_ids: categoryId } : {}),
    fields: [
      "product_id",
      "product_title",
      "product_main_image_url",
      "product_small_image_urls",
      "promotion_link",
      "commission_rate",
    ].join(","),
  };

  params.sign = calcSign(params, appSecret);

  try {
    const res = await fetch("https://api-sg.aliexpress.com/sync", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: new URLSearchParams(params).toString(),
    });

    const data = await res.json();
    const respResult = data?.aliexpress_affiliate_product_query_response?.resp_result;

    if (!respResult || respResult.resp_code !== 200) {
      return NextResponse.json(
        { error: respResult?.resp_msg || "API 오류가 발생했습니다.", detail: data },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = respResult.result?.products?.product ?? [];

    const products = raw.map((p) => {
      const mainImage: string = p.product_main_image_url ?? "";
      const smallRaw = p.product_small_image_urls;
      const smallImages: string[] = Array.isArray(smallRaw)
        ? smallRaw
        : Array.isArray(smallRaw?.string)
        ? smallRaw.string
        : [];
      const images = [mainImage, ...smallImages.filter((u: string) => u && u !== mainImage)].filter(Boolean);

      return {
        product_id: String(p.product_id),
        title: p.product_title ?? "",
        images,
        affiliate_link: p.promotion_link ?? "",
      };
    });

    return NextResponse.json({ products });
  } catch {
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
