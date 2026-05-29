import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full border-t border-gray-100 bg-white mt-12">
      <div className="max-w-screen-xl mx-auto px-4 py-6 text-center space-y-2">
        <p className="text-xs text-gray-400 leading-relaxed">
          이 사이트는 제휴 마케팅을 통해 수수료를 받을 수 있습니다.
        </p>
        <p className="text-xs text-gray-300">
          © 이게머고?{" "}
          <span className="text-gray-200 mx-1">|</span>
          <Link href="/about" className="hover:text-[#F5A623] transition-colors">About</Link>
          <span className="text-gray-200 mx-1">|</span>
          <Link href="/privacy" className="hover:text-[#F5A623] transition-colors">Privacy Policy</Link>
          <span className="text-gray-200 mx-1">|</span>
          <Link href="/contact" className="hover:text-[#F5A623] transition-colors">Contact</Link>
        </p>
      </div>
    </footer>
  );
}