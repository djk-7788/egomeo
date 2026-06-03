"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function HeaderAuthStatus() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading || !user) return null;

  const meta = user.user_metadata ?? {};
  const avatarUrl: string | null = meta.avatar_url || null;
  const initial = (meta.name || meta.full_name || user.email || "U").trim()[0].toUpperCase();

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
