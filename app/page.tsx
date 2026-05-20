import { supabase } from "@/lib/supabase";
import ProductCard from "@/components/ProductCard";

export default async function Home() {
  const { data: products, error } = await supabase
    .from("products")
    .select("id, title, category, image_url, price, affiliate_link")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="text-center text-gray-400 py-20">
        상품을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
      </p>
    );
  }

  if (!products || products.length === 0) {
    return (
      <p className="text-center text-gray-400 py-20">
        등록된 상품이 없습니다.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          category={product.category}
          imageUrl={product.image_url}
          title={product.title}
          price={product.price}
          link={product.affiliate_link}
        />
      ))}
    </div>
  );
}
