"use client";

import { useState } from "react";

export default function ShareButton() {
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
      {copied ? "✓ 링크 복사됨!" : "🔗 공유 링크 복사"}
    </button>
  );
}
