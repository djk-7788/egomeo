import Link from "next/link";
import HamburgerMenu from "./HamburgerMenu";
import HeaderAuthStatus from "./HeaderAuthStatus";

export default function Header() {
  return (
    <header className="w-full border-b border-gray-200 bg-white sticky top-0 z-40">
      <div className="max-w-screen-xl mx-auto px-4 h-[74px] flex items-center justify-between">
        <Link href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/이게_머고.png" alt="이게머고?" style={{ height: "66px", width: "auto" }} />
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/search" aria-label="검색" className="text-[#555555] hover:text-[#111111] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </Link>
          <HeaderAuthStatus />
          <HamburgerMenu />
        </div>
      </div>
    </header>
  );
}
