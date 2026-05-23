import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import VideoPlayer from "@/components/VideoPlayer";
import ShareButton from "@/components/ShareButton";
import InfiniteProductGrid from "@/components/InfiniteProductGrid";

type Props = { params: Promise<{ id: string }> };

const categoryLabel: Record<string, string> = {
  mild: "이게 머고?",
  medium: "이게? 머고???",
  hot: "이게??? 머고???????",
};

const PAGE_SIZE = 12;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { data: product } = await supabase
    .from("products")
    .select("title, image_url")
    .eq("id", id)
    .single();

  if (!product) return { title: "이게머고?" };

  return {
    title: `${product.title} | 이게머고?`,
    description: `이게 대체 머고?`,
    openGraph: {
      title: `${product.title} | 이게머고?`,
      description: `이게 대체 머고?`,
      images: [{ url: product.image_url }],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;

  const [{ data: product }, { data: related, count }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase
      .from("products")
      .select("id, title, category, image_url, video_url, affiliate_link", {
        count: "exact",
      })
      .eq("is_active", true)
      .neq("id", id)
      .order("created_at", { ascending: false })
      .range(0, PAGE_SIZE - 1),
  ]);

  if (!product) notFound();

  const initialHasMore = (count ?? 0) > PAGE_SIZE;

  return (
    <div>
      {/* 상단: 상품 상세 */}
      <div className="max-w-3xl mx-auto mb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* 영상 또는 이미지 */}
          <div className="aspect-square w-full overflow-hidden rounded-2xl border border-gray-100 bg-black">
            {product.video_url ? (
              <VideoPlayer
                src={product.video_url}
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={product.image_url}
                alt={product.title}
                className="w-full h-full object-cover"
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
              className="block w-full text-center font-bold text-white bg-[#FF5A00] rounded-xl py-4 hover:bg-[#e04e00] transition-colors text-lg"
            >
              구경하러 가기
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
