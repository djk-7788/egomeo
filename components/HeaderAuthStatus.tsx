"use client";

import { useAuth } from "@/context/AuthContext";

export default function HeaderAuthStatus() {
  const { user, loading } = useAuth();
  if (loading || !user) return null;

  const initial = (
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    user.email ||
    "U"
  )
    .trim()[0]
    .toUpperCase();

  return (
    <span
      title={user.email}
      className="w-7 h-7 rounded-full bg-[#F5A623] flex items-center justify-center text-white text-xs font-bold select-none shrink-0"
    >
      {initial}
    </span>
  );
}
