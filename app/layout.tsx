import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "이게머고?",
  description: "이게 대체 머고? 신기하고 별난 물건들을 모아봤습니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable}`}>
      <body className="min-h-screen bg-white text-[#111111]">
        <Header />
        <p className="text-center text-xs text-gray-400 px-4 py-2 border-b border-gray-100">
          이 사이트는 쿠팡파트너스·알리익스프레스·아마존 제휴 활동의 일환으로 소정의 수수료를 제공받습니다. 수수료는 제품 구매 가격에 영향을 주지 않으니 안심하고 즐겨주세요 :)
        </p>
        <main className="w-full px-4 py-8 max-w-screen-xl mx-auto">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
