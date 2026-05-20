import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

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
        <main className="w-full px-4 py-8 max-w-screen-xl mx-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
