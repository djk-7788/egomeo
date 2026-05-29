"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const CATEGORIES = [
  { label: "전체", value: "" },
  { label: "순한맛", value: "mild" },
  { label: "보통맛", value: "medium" },
  { label: "매운맛", value: "hot" },
];

export default function CategoryNav() {
  const searchParams = useSearchParams();
  const current = searchParams.get("category") ?? "";

  return (
    <nav className="flex gap-4 text-sm font-medium">
      {CATEGORIES.map(({ label, value }) => (
        <Link
          key={value}
          href={value ? `/?category=${value}` : "/"}
          className={
            current === value
              ? "text-[#F5A623] font-bold"
              : "text-gray-500 hover:text-[#F5A623] transition-colors"
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}