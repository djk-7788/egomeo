"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function EyeButton() {
  const { user, openLoginModal } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showTooltip, setShowTooltip] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const isOn = pathname === "/unseen";

  // 팝업 외부 클릭 시 닫기
  useEffect(() => {
    if (!showTooltip) return;
    function handleOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showTooltip]);

  // 페이지 이동 시 팝업 닫기
  useEffect(() => {
    setShowTooltip(false);
  }, [pathname]);

  function handleClick() {
    // ON 상태에서 클릭 → 메인으로
    if (isOn) {
      router.push("/");
      return;
    }

    // 처음 사용: 설명 팝업 표시
    const explained =
      typeof window !== "undefined" && !!localStorage.getItem("unseen_explained");
    if (!explained) {
      setShowTooltip(true);
      return;
    }

    // 설명 본 적 있음 → 바로 동작
    if (!user) {
      openLoginModal();
      return;
    }
    router.push("/unseen");
  }

  function handleStart() {
    if (typeof window !== "undefined") localStorage.setItem("unseen_explained", "1");
    setShowTooltip(false);
    if (!user) {
      openLoginModal();
      return;
    }
    router.push("/unseen");
  }

  function handleClose() {
    if (typeof window !== "undefined") localStorage.setItem("unseen_explained", "1");
    setShowTooltip(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={handleClick}
        aria-label="안 본 것만 보기"
        className={`transition-colors shrink-0 ${
          isOn
            ? "text-[#F5A623]"
            : "text-[#555555] hover:text-[#111111]"
        }`}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {showTooltip && (
        <div className="absolute top-full right-0 mt-3 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50">
          {/* 말풍선 꼭짓점 */}
          <div className="absolute -top-1.5 right-2.5 w-3 h-3 bg-white border-t border-l border-gray-100 rotate-45" />
          <p className="text-sm font-black text-[#111111] mb-1.5">안 본 것만 보기</p>
          <p className="text-xs text-gray-500 leading-relaxed mb-4">
            이미 스크롤한 상품을 제외하고 보여드려요.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="flex-1 text-xs font-semibold py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              닫기
            </button>
            <button
              onClick={handleStart}
              className="flex-1 text-xs font-bold py-2 rounded-lg bg-[#F5A623] text-white hover:bg-[#d8921f] transition-colors"
            >
              시작하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
