"use client";

import { useState } from "react";

type Props = {
  /** 버튼 라벨 텍스트 (기본값: "🔗 공유 링크 복사") */
  label?: string;
};

export default function ShareButton({ label = "🔗 공유 링크 복사" }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="w-full text-center font-semibold text-gray-500 border border-gray-200 rounded-xl py-4 hover:bg-gray-50 transition-colors"
    >
      {copied ? "✓ 복사됨!" : label}
    </button>
  );
}
