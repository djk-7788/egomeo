import { supabase } from "@/lib/supabase";
import ProductCard from "@/components/ProductCard";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q = "" } = await searchParams;
  return {
    title: q ? `"${q}" 검색 결과 | 이게머고?` : "검색 | 이게머고?",
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  let products: {
    id: string;
    title: string;
    category: "mild" | "medium" | "hot";
    image_url: string;
    video_url: string | null;
    affiliate_link: string;
  }[] = [];

  if (query) {
    const { data } = await supabase
      .from("products")
      .select("id, title, category, image_url, video_url, affiliate_link")
      .eq("is_active", true)
      .ilike("title", `%${query}%`)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    products = data ?? [];
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-base font-black text-[#111111]">
          {query ? `"${query}" 검색 결과` : "검색"}
        </h1>
        {query && (
          <p className="text-xs text-gray-400 mt-1">
            {products.length > 0
              ? `${products.length}개 상품`
              : "검색 결과가 없습니다."}
          </p>
        )}
      </div>

      {!query && (
        <p className="text-center text-gray-400 py-20 text-sm">검색어를 입력해 주세요.</p>
      )}

      {query && products.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-400 text-sm mb-4">
            &ldquo;{query}&rdquo;에 대한 검색 결과가 없습니다.
          </p>
          <Link
            href="/"
            className="text-sm font-bold text-[#F5A623] hover:underline"
          >
            전체 상품 보기
          </Link>
        </div>
      )}

      {products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {products.map(p => (
            <ProductCard
              key={p.id}
              id={p.id}
              category={p.category}
              imageUrl={p.image_url}
              videoUrl={p.video_url}
              title={p.title}
              link={p.affiliate_link}
            />
          ))}
        </div>
      )}
    </div>
  );
}