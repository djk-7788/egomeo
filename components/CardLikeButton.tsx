"use client";

import { useAuth } from "@/context/AuthContext";

export default function CardLikeButton() {
  const { user, openLoginModal } = useAuth();

  const handleClick = () => {
    if (!user) {
      openLoginModal();
      return;
    }
    // TODO: 찜하기 DB 저장 (소셜 로그인 구현 완료 후 연결 예정)
  };

  return (
    <button
      onClick={handleClick}
      title="찜하기"
      className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-red-400 hover:border-red-200 transition-colors text-lg"
    >
      ♡
    </button>
  );
}
