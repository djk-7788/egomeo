"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const MENU_ITEMS = [
  { label: "About", href: "/about" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Contact", href: "/contact" },
];

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { user, openLoginModal, signOut } = useAuth();

  useEffect(() => {
    setOpen(false);
    setSearchInput("");
  }, [pathname]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      // 열리면 검색창에 포커스
      setTimeout(() => inputRef.current?.focus(), 250);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="메뉴 열기"
        className="flex flex-col justify-center gap-[5px] w-8 h-8 items-center"
      >
        <span className="block w-5 h-[2px] bg-[#555555]" />
        <span className="block w-5 h-[2px] bg-[#555555]" />
        <span className="block w-5 h-[2px] bg-[#555555]" />
      </button>

      {/* 오버레이 */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 사이드 드로어 */}
      <div
        className={`fixed top-0 right-0 h-full w-72 bg-white z-50 shadow-lg transform transition-transform duration-250 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-gray-100">
          <span className="text-sm font-bold text-[#111111]">이게머고?</span>
          <button
            onClick={() => setOpen(false)}
            aria-label="메뉴 닫기"
            className="text-gray-400 hover:text-[#111111] transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* 검색창 */}
        <div className="px-4 py-4 border-b border-gray-50">
          <form onSubmit={handleSearch} className="relative">
            <input
              ref={inputRef}
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="상품 검색..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#F5A623] transition-colors pr-16"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-white bg-[#F5A623] px-2.5 py-1 rounded-md hover:bg-[#d8921f] transition-colors"
            >
              검색
            </button>
          </form>
        </div>

        {/* 메뉴 항목 */}
        <nav className="flex flex-col py-3">
          {user && (
            <Link
              href="/mypage"
              className="px-5 py-3 text-sm font-medium text-[#111111] hover:text-[#F5A623] hover:bg-gray-50 transition-colors"
            >
              마이페이지
            </Link>
          )}
          {MENU_ITEMS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="px-5 py-3 text-sm text-[#111111] hover:text-[#F5A623] hover:bg-gray-50 transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* 로그인/로그아웃 */}
        <div className="absolute bottom-0 left-0 right-0 px-5 py-4 border-t border-gray-100">
          {user ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 truncate max-w-[160px]" title={user.email}>
                {user.email}
              </span>
              <button
                onClick={() => { signOut(); setOpen(false); }}
                className="text-xs text-gray-400 hover:text-[#111111] transition-colors ml-3 shrink-0"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setOpen(false); openLoginModal(); }}
              className="w-full py-2.5 text-sm font-bold text-white bg-[#F5A623] rounded-xl hover:bg-[#d8921f] transition-colors"
            >
              로그인
            </button>
          )}
        </div>
      </div>
    </>
  );
}