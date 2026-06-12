import { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";

const BASE_URL = "https://www.igemugo.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: products } = await supabase
    .from("products")
    .select("id, created_at, title, seo_title, image_url, image_urls")
    .eq("is_active", true);

  const productUrls: MetadataRoute.Sitemap = (products ?? []).map((p) => {
    const rawImageUrl =
      Array.isArray(p.image_urls) && p.image_urls.length > 0
        ? p.image_urls[0]
        : p.image_url;
    const imageUrl = rawImageUrl
      ? rawImageUrl.replace(/&/g, "&amp;")
      : null;

    return {
      url: `${BASE_URL}/product/${p.id}`,
      lastModified: new Date(p.created_at),
      changeFrequency: "weekly",
      priority: 0.7,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    };
  });

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...productUrls,
  ];
}
