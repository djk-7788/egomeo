"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function HeaderAuthStatus() {
  const { user, loading, profile, openLoginModal } = useAuth();
  const router = useRouter();
  const [imgError, setImgError] = useState(false);

  if (loading) return null;

  if (!user) {
    return (
      <button
        onClick={() => openLoginModal()}
        className="text-sm font-medium text-[#555555] hover:text-[#111111] transition-colors whitespace-nowrap shrink-0"
      >
        로그인
      </button>
    );
  }

  const avatarUrl = profile?.avatar_url ?? null;
  const initial = (
    profile?.nickname ||
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    user.email ||
    "U"
  ).trim()[0].toUpperCase();

  return (
    <button
      onClick={() => router.push("/mypage")}
      title="마이페이지"
      className="w-7 h-7 rounded-full overflow-hidden bg-[#555555] flex items-center justify-center text-white text-xs font-bold select-none shrink-0 hover:opacity-80 transition-opacity"
    >
      {avatarUrl && !imgError ? (
        <img
          src={avatarUrl}
          alt="프로필"
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        initial
      )}
    </button>
  );
}
