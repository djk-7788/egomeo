import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "참아야하느니라",
  description: "참아야하느니라 — 사면 안 되는데 손이 가는 별난 물건들.",
  verification: {
    yandex: "0f0bdf1351e0e1ac",
  },
  other: {
    "naver-site-verification": "ed3bbd4ce60a2bd260807f4900ffb9676ed58e6e",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable}`}>
      {GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}
          </Script>
        </>
      )}
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
