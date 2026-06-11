import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import VideoPlayer from "@/components/VideoPlayer";
import ImageSlider from "@/components/ImageSlider";
import ShareButton from "@/components/ShareButton";
import InfiniteProductGrid from "@/components/InfiniteProductGrid";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ref?: string }>;
};

const categoryLabel: Record<string, string> = {
  mild: "이게 머고?",
  medium: "이게? 머고???",
  hot: "이게??? 머고???????",
};

const PAGE_SIZE = 12;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const { ref } = await searchParams;

  const { data: product } = await supabase
    .from("products")
    .select("title, image_url, image_urls, video_url, button_text")
    .eq("id", id)
    .single();

  if (!product) return { title: "이게머고?" };

  const description = product.button_text || "이게 머고? 세상의 신기한 물건들.";
  const canonicalUrl = `https://www.igemugo.com/product/${id}`;

  // ref=threads → Threads 전용 이미지 고정 (상품 이미지 노출 방지)
  // 절대 URL 사용 — metadataBase 상속 의존 없이 확실하게 처리
  let ogImageUrl: string;
  if (ref === "threads") {
    ogImageUrl = "https://www.igemugo.com/og-threads.png";
  } else if (product.video_url) {
    // 영상 있으면 image_url을 썸네일로 사용
    ogImageUrl = product.image_url || "https://www.igemugo.com/og-default.png";
  } else if (Array.isArray(product.image_urls) && product.image_urls.length > 0) {
    ogImageUrl = product.image_urls[0];
  } else {
    ogImageUrl = product.image_url || "https://www.igemugo.com/og-default.png";
  }

  return {
    title: product.title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: product.title,
      description,
      url: canonicalUrl,
      siteName: "이게머고?",
      images: [{ url: ogImageUrl, alt: product.title }],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: product.title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;

  const [{ data: product }, { data: related, count }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase
      .from("products")
      .select("id, title, category, image_url, image_urls, video_url, affiliate_link, button_text", {
        count: "exact",
      })
      .eq("is_active", true)
      .neq("id", id)
      .order("created_at", { ascending: false })
      .range(0, PAGE_SIZE - 1),
  ]);

  if (!product) notFound();

  const initialHasMore = (count ?? 0) > PAGE_SIZE;

  // JSON-LD 대표 이미지: 영상→image_url, image_urls→첫 장, 그 외 image_url
  const jsonLdImage =
    product.video_url
      ? product.image_url
      : Array.isArray(product.image_urls) && product.image_urls.length > 0
      ? product.image_urls[0]
      : product.image_url;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: product.title,
    image: jsonLdImage ? [jsonLdImage] : undefined,
    datePublished: product.created_at,
    author: {
      "@type": "Organization",
      name: "이게머고?",
      url: "https://www.igemugo.com",
    },
    publisher: {
      "@type": "Organization",
      name: "이게머고?",
      logo: {
        "@type": "ImageObject",
        url: "https://www.igemugo.com/2.png",
      },
    },
    mainEntityOfPage: `https://www.igemugo.com/product/${id}`,
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* 상단: 상품 상세 */}
      <div className="max-w-3xl mx-auto mb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* 영상 또는 슬라이드 또는 이미지 */}
          <div className="aspect-square w-full overflow-hidden rounded-2xl border border-gray-100 bg-white">
            {product.video_url ? (
              <VideoPlayer
                src={product.video_url}
                poster={product.image_url || undefined}
                className="w-full h-full object-contain"
              />
            ) : product.image_urls && product.image_urls.length >= 2 ? (
              <ImageSlider
                images={product.image_urls}
                alt={product.title}
                mode="auto"
                className="w-full h-full"
              />
            ) : (
              <img
                src={product.image_url}
                alt={product.title}
                className="w-full h-full object-contain"
              />
            )}
          </div>

          {/* 정보 */}
          <div className="flex flex-col gap-4 py-2">
            <span className="text-sm font-semibold text-gray-400">
              {categoryLabel[product.category]}
            </span>
            <h1 className="text-2xl font-black text-[#111111] leading-snug">
              {product.title}
            </h1>
            <a
              href={product.affiliate_link}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center font-bold text-white bg-[#F5A623] rounded-xl py-4 hover:bg-[#d8921f] transition-colors text-lg"
            >
              {product.button_text || "구경하러 가기"}
            </a>
            <ShareButton />
          </div>
        </div>
      </div>

      {/* 하단: 무한 스크롤 피드 */}
      {(related && related.length > 0) && (
        <InfiniteProductGrid
          initialProducts={related}
          initialHasMore={initialHasMore}
          excludeId={id}
          heading="이건 또 머고?"
        />
      )}
    </div>
  );
}
