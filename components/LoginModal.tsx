"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Props = { onClose: () => void };

export default function LoginModal({ onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(window.location.href)}`,
      },
    });
  };

  const handleKakao = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(window.location.href)}`,
        scopes: "profile_nickname profile_image",
      },
    });
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-80 p-7 relative">
        <button
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl leading-none transition-colors"
        >
          ✕
        </button>

        <h2 className="text-lg font-bold text-[#111111] text-center mb-1">로그인</h2>
        <p className="text-xs text-gray-400 text-center mb-6">
          찜하기 기능을 이용하려면 로그인이 필요해요.
        </p>

        <div className="flex flex-col gap-3">
          {/* Google */}
          <button
            onClick={handleGoogle}
            className="flex items-center justify-center gap-2.5 w-full py-3 border border-gray-200 rounded-xl text-sm font-medium text-[#111111] hover:bg-gray-50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.705 17.64 9.2z" fill="#4285F4" />
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
            </svg>
            Google로 계속하기
          </button>

          {/* Kakao */}
          <button
            onClick={handleKakao}
            className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl text-sm font-medium text-[#111111] transition-colors hover:brightness-95"
            style={{ backgroundColor: "#FEE500" }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M9 1.5C4.306 1.5 0.5 4.41 0.5 8.014c0 2.31 1.494 4.34 3.75 5.51L3.19 16.2a.325.325 0 00.472.365l3.95-2.617c.455.064.922.097 1.388.097 4.694 0 8.5-2.91 8.5-6.514S13.694 1.5 9 1.5z"
                fill="#191919"
              />
            </svg>
            카카오로 계속하기
          </button>
        </div>
      </div>
    </div>
  );
}
