import { Suspense } from "react";
import CategoryNav from "./CategoryNav";
import HamburgerMenu from "./HamburgerMenu";

export default function Header() {
  return (
    <header className="w-full border-b border-gray-200 bg-white sticky top-0 z-40">
      <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/" className="text-xl font-black tracking-tight text-[#111111]">
          참아야하느니라
        </a>
        <div className="flex items-center gap-4">
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
          <HamburgerMenu />
        </div>
      </div>
    </header>
  );
}
