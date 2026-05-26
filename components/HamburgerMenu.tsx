"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU_ITEMS = [
  { label: "About", href: "/about" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Contact", href: "/contact" },
];

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="메뉴 열기"
        className="flex flex-col justify-center gap-[5px] w-8 h-8 items-center"
      >
        <span className="block w-5 h-[2px] bg-[#111111]" />
        <span className="block w-5 h-[2px] bg-[#111111]" />
        <span className="block w-5 h-[2px] bg-[#111111]" />
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
        className={`fixed top-0 right-0 h-full w-64 bg-white z-50 shadow-lg transform transition-transform duration-250 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
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
        <nav className="flex flex-col py-4">
          {MENU_ITEMS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="px-5 py-3 text-sm text-[#111111] hover:text-[#FF5A00] hover:bg-gray-50 transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
