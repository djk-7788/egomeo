export default function Header() {
  return (
    <header className="w-full border-b border-gray-200 bg-white sticky top-0 z-50">
      <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/" className="text-xl font-black tracking-tight text-[#111111]">
          이게머고?
        </a>
        <nav className="flex gap-4 text-sm font-medium text-gray-500">
          <a href="/" className="hover:text-[#FF5A00] transition-colors">전체</a>
          <a href="/?category=mild" className="hover:text-[#FF5A00] transition-colors">순한맛</a>
          <a href="/?category=medium" className="hover:text-[#FF5A00] transition-colors">보통맛</a>
          <a href="/?category=hot" className="hover:text-[#FF5A00] transition-colors">매운맛</a>
        </nav>
      </div>
    </header>
  );
}
