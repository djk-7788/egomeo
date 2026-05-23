import CardShareButton from "@/components/CardShareButton";
import VideoPlayer from "@/components/VideoPlayer";

type Category = "mild" | "medium" | "hot";

type ProductCardProps = {
  id: string;
  category: Category;
  imageUrl: string;
  videoUrl?: string | null;
  title: string;
  link: string;
};

const categoryLabel: Record<Category, string> = {
  mild: "이게 머고?",
  medium: "이게? 머고???",
  hot: "이게??? 머고???????",
};

export default function ProductCard({
  id,
  category,
  imageUrl,
  videoUrl,
  title,
  link,
}: ProductCardProps) {
  return (
    <div className="flex flex-col bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* 1층: 카테고리 */}
      <div className="px-3 pt-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {categoryLabel[category]}
        </span>
      </div>

      {/* 2층: 영상 또는 이미지 — 클릭 시 제휴 링크 */}
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="relative w-full aspect-square mt-2 overflow-hidden block bg-black"
      >
        {videoUrl ? (
          <VideoPlayer src={videoUrl} className="w-full h-full object-cover" />
        ) : (
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          />
        )}
      </a>

      {/* 3층: 드립형 제목 */}
      <div className="px-3 pt-3">
        <h2 className="text-sm font-bold text-[#111111] leading-snug line-clamp-2">
          {title}
        </h2>
      </div>

      {/* 4층: 공유 버튼 */}
      <div className="px-3 pt-1 flex items-center justify-end">
        <CardShareButton id={id} />
      </div>

      {/* 5층: 외부링크 버튼 */}
      <div className="px-3 pt-2 pb-3 mt-auto">
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center text-sm font-bold text-white bg-[#FF5A00] rounded-lg py-2 hover:bg-[#e04e00] transition-colors"
        >
          구경하러 가기
        </a>
      </div>
    </div>
  );
}
