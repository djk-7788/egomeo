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
  if (currency === "KRW") return `₩${Math.round(num).toLocaleString("ko-KR")}`;
  return `$${num.toFixed(2)}`;
}

export async function GET(req: NextRequest) {
  const keyword = req.nextUrl.searchParams.get("keyword")?.trim();
  if (!keyword) {
    return NextResponse.json({ error: "키워드를 입력하세요." }, { status: 400 });
  }

  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;

  if (!appKey || !appSecret) {
    return NextResponse.json({ error: "API 키가 설정되지 않았습니다." }, { status: 500 });
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
    page_size: "20",
    target_currency: "KRW",
    target_language: "KO",
    tracking_id: appKey,
    fields: [
      "product_id",
      "product_title",
      "product_main_image_url",
      "target_sale_price",
      "target_sale_price_currency",
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

    const raw: Record<string, string>[] = respResult.result?.products?.product ?? [];

    const products = raw.map((p) => ({
      product_id: String(p.product_id),
      title: p.product_title ?? "",
      image_url: p.product_main_image_url ?? "",
      price: formatPrice(p.target_sale_price, p.target_sale_price_currency),
      affiliate_link: p.promotion_link ?? "",
    }));

    return NextResponse.json({ products });
  } catch {
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
