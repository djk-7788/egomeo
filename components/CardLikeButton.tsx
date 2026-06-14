"use client";

import { useAuth } from "@/context/AuthContext";
import { useLikes } from "@/context/LikesContext";

type Props = {
  productId: string;
  /** "card": 기존 작은 정사각형 버튼 (기본값) / "detail": 상세페이지용 풀와이드 버튼 */
  variant?: "card" | "detail";
};

export default function CardLikeButton({ productId, variant = "card" }: Props) {
  const { user, openLoginModal } = useAuth();
  const { likedIds, toggleLike } = useLikes();
  const isLiked = likedIds.has(productId);

  const handleClick = async () => {
    if (!user) {
      openLoginModal();
      return;
    }
    await toggleLike(productId);
  };

  if (variant === "detail") {
    return (
      <button
        onClick={handleClick}
        title={isLiked ? "찜 해제" : "찜하기"}
        className={`w-full flex items-center justify-center gap-2 rounded-xl py-4 border font-semibold text-sm transition-colors ${
          isLiked
            ? "border-red-300 bg-red-50 text-red-500"
            : "border-gray-200 bg-white text-gray-400 hover:text-red-400 hover:border-red-200"
        }`}
      >
        <span className="text-base">{isLiked ? "♥" : "♡"}</span>
        <span>{isLiked ? "찜 해제" : "찜하기"}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      title={isLiked ? "찜 해제" : "찜하기"}
      className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border transition-colors text-lg ${
        isLiked
          ? "border-red-300 bg-red-50 text-red-500"
          : "border-gray-200 bg-white text-gray-400 hover:text-red-400 hover:border-red-200"
      }`}
    >
      {isLiked ? "♥" : "♡"}
    </button>
  );
}
