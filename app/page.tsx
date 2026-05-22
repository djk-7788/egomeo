import { supabase } from "@/lib/supabase";
import InfiniteProductGrid from "@/components/InfiniteProductGrid";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = ["mild", "medium", "hot"];
const PAGE_SIZE = 12;

type Props = {
  searchParams: Promise<{ category?: string }>;
};

export default async function Home({ searchParams }: Props) {
  const { category } = await searchParams;
  const activeCategory = VALID_CATEGORIES.includes(category ?? "") ? category : undefined;

  let query = supabase
    .from("products")
    .select("id, title, category, image_url, video_url, price, affiliate_link", {
      count: "exact",
    })
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .range(0, PAGE_SIZE - 1);

  if (activeCategory) {
    query = query.eq("category", activeCategory);
  }

  const { data: products, error, count } = await query;

  if (error) {
    console.error("[Supabase 에러]", error);
    return (
      <p className="text-center text-gray-400 py-20">
        상품을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
      </p>
    );
  }

  const initialHasMore = (count ?? 0) > PAGE_SIZE;

  return (
    <InfiniteProductGrid
      initialProducts={products ?? []}
      initialHasMore={initialHasMore}
      category={activeCategory}
    />
  );
}
