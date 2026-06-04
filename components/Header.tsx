"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HamburgerMenu from "./HamburgerMenu";
import HeaderAuthStatus from "./HeaderAuthStatus";

export default function Header() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchInput("");
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    function handleClick(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [searchOpen]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setSearchOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <header ref={headerRef} className="w-full border-b border-gray-200 bg-white sticky top-0 z-40">
      <div className="max-w-screen-xl mx-auto pl-0 pr-3 sm:pl-0 sm:pr-4 h-[74px] flex items-center justify-between">
        <Link href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/2.png" alt="이게머고?" style={{ height: "66px", width: "auto" }} />
        </Link>
        <div className="flex items-center gap-4 sm:gap-5">
          <button
            onClick={() => setSearchOpen(v => !v)}
            aria-label="검색"
            className="text-[#555555] hover:text-[#111111] transition-colors shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <HeaderAuthStatus />
          <HamburgerMenu />
        </div>
      </div>

      {/* 검색 드롭다운 */}
      {searchOpen && (
        <div className="absolute left-0 right-0 bg-white border-b border-gray-200 px-3 sm:px-4 py-3 shadow-md">
          <form onSubmit={handleSearch} className="max-w-screen-xl mx-auto flex gap-2">
            <input
              ref={searchInputRef}
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="상품 검색..."
              className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#F5A623] transition-colors"
            />
            <button
              type="submit"
              className="px-4 py-2.5 text-sm font-bold text-white bg-[#F5A623] rounded-lg hover:bg-[#d8921f] transition-colors shrink-0"
            >
              검색
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
