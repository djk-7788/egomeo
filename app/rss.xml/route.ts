import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRfc822(dateStr: string): string {
  return new Date(dateStr).toUTCString();
}

function getMimeType(url: string): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

export async function GET() {
  const { data: products } = await supabase
    .from("products")
    .select("id, title, image_url, image_urls, button_text, created_at, platform")
    .eq("is_active", true)
    .eq("is_queued", false)
    .or("platform.is.null,platform.neq.amazon_us")
    .order("created_at", { ascending: false })
    .limit(20);

  const items = (products ?? [])
    .map((p) => {
      const link = `https://www.igemugo.com/product/${p.id}`;
      const description = p.button_text || "이게 머고? 세상의 신기한 물건들.";
      const imageUrl =
        Array.isArray(p.image_urls) && p.image_urls.length > 0
          ? p.image_urls[0]
          : p.image_url;

      const enclosure = imageUrl
        ? `\n      <enclosure url="${escapeXml(imageUrl)}" type="${getMimeType(imageUrl)}" length="0" />`
        : "";

      return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${toRfc822(p.created_at)}</pubDate>
      <description>${escapeXml(description)}</description>${enclosure}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>이게머고?</title>
    <link>https://www.igemugo.com</link>
    <atom:link href="https://www.igemugo.com/rss.xml" rel="self" type="application/rss+xml" />
    <description>세상의 신기하고 재밌는 물건들을 매일 발견해서 모아두는 큐레이션 사이트</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=UTF-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=600",
    },
  });
}
