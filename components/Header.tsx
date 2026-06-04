import { Suspense } from "react";
import Link from "next/link";
import CategoryNav from "./CategoryNav";
import HamburgerMenu from "./HamburgerMenu";
import HeaderAuthStatus from "./HeaderAuthStatus";

export default function Header() {
  return (
    <header className="w-full border-b border-gray-200 bg-white sticky top-0 z-40">
      <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/이게_머고.png" alt="이게머고?" style={{ height: "44px", width: "auto" }} />
        </Link>
        <div className="flex items-center gap-3">
          <Suspense
            fallback={
              <nav className="flex gap-4 text-sm font-medium text-gray-500">
                <span>전체</span>
                <span>순한맛</span>
                <span>보통맛</span>
                <span>매운맛</span>
              </nav>
            }
          >
            <CategoryNav />
          </Suspense>
          <HeaderAuthStatus />
          <HamburgerMenu />
        </div>
      </div>
    </header>
  );
}
