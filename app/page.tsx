import ProductCard from "@/components/ProductCard";

const sampleProducts = [
  {
    id: 1,
    category: "hot" as const,
    imageUrl: "https://placehold.co/400x400/f0f0f0/999?text=???",
    title: "이게 뭔지 설명하면 내가 짐",
    price: "₩32,900",
    link: "#",
  },
  {
    id: 2,
    category: "medium" as const,
    imageUrl: "https://placehold.co/400x400/f0f0f0/999?text=??",
    title: "사무실에 이거 놔두면 다들 한마디씩 함",
    price: "₩14,500",
    link: "#",
  },
  {
    id: 3,
    category: "mild" as const,
    imageUrl: "https://placehold.co/400x400/f0f0f0/999?text=?",
    title: "실용적인데 왜 이렇게 생긴 거야",
    price: "₩8,900",
    link: "#",
  },
  {
    id: 4,
    category: "hot" as const,
    imageUrl: "https://placehold.co/400x400/f0f0f0/999?text=???",
    title: "기프티콘으로 받으면 인연 끊고 싶은 아이템",
    price: "₩67,000",
    link: "#",
  },
  {
    id: 5,
    category: "medium" as const,
    imageUrl: "https://placehold.co/400x400/f0f0f0/999?text=??",
    title: "집에 있으면 손님한테 설명해야 하는 물건",
    price: "₩22,000",
    link: "#",
  },
  {
    id: 6,
    category: "mild" as const,
    imageUrl: "https://placehold.co/400x400/f0f0f0/999?text=?",
    title: "이거 선물 받으면 일단 웃어야 함",
    price: "₩5,500",
    link: "#",
  },
];

export default function Home() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {sampleProducts.map((product) => (
        <ProductCard key={product.id} {...product} />
      ))}
    </div>
  );
}
