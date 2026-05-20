"use client";

import { useState } from "react";

export default function CardShareButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/product/${id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      title="공유 링크 복사"
      className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border transition-colors text-lg
        ${copied
          ? "border-green-200 bg-green-50 text-green-500"
          : "border-gray-200 bg-white text-gray-400 hover:border-[#FF5A00] hover:text-[#FF5A00]"
        }`}
    >
      {copied ? "✓" : "🔗"}
    </button>
  );
}
