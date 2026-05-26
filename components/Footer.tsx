import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full border-t border-gray-100 bg-white mt-12">
      <div className="max-w-screen-xl mx-auto px-4 py-6 text-center space-y-2">
        <p className="text-xs text-gray-400 leading-relaxed">
          이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
        </p>
        <p className="text-xs text-gray-300">
          © 2025 이게머고?{" "}
          <span className="text-gray-200 mx-1">|</span>
          <Link href="/about" className="hover:text-[#FF5A00] transition-colors">About</Link>
          <span className="text-gray-200 mx-1">|</span>
          <Link href="/privacy" className="hover:text-[#FF5A00] transition-colors">Privacy Policy</Link>
          <span className="text-gray-200 mx-1">|</span>
          <Link href="/contact" className="hover:text-[#FF5A00] transition-colors">Contact</Link>
        </p>
      </div>
    </footer>
  );
}
