"use client";

import { useAuth } from "@/context/AuthContext";
import { useLikes } from "@/context/LikesContext";

type Props = { productId: string };

export default function CardLikeButton({ productId }: Props) {
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
