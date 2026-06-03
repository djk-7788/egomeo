"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function HeaderAuthStatus() {
  const { user, loading, profile } = useAuth();
  const router = useRouter();

  if (loading || !user) return null;

  // profiles 테이블 값 우선, 없으면 OAuth 메타데이터 폴백
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
      className="w-7 h-7 rounded-full overflow-hidden bg-[#F5A623] flex items-center justify-center text-white text-xs font-bold select-none shrink-0 hover:opacity-80 transition-opacity"
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="프로필" className="w-full h-full object-cover" />
      ) : (
        initial
      )}
    </button>
  );
}
