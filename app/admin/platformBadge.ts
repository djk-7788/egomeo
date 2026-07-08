// 플랫폼 배지 공통 정의 — AdminPanel / OrderEditor / QueueManager에서 import해서 사용
export const PLATFORM_BADGE: Record<string, string> = {
  amazon_us: "🇺🇸 아마존",
  amazon_jp: "🇯🇵 아마존JP",
  aliexpress: "알리",
  coupang: "쿠팡",
  etsy: "🧶 엣시",
  klook: "🎫 클룩",
  etc: "🌐",
};

export const PLATFORM_COLOR: Record<string, string> = {
  amazon_us: "bg-blue-100 text-blue-700",
  amazon_jp: "bg-indigo-100 text-indigo-700",
  aliexpress: "bg-orange-100 text-orange-700",
  coupang: "bg-red-100 text-red-700",
  etsy: "bg-amber-100 text-amber-700",
  klook: "bg-purple-100 text-purple-700",
  etc: "bg-gray-100 text-gray-600",
};

export function getPlatformBadge(platform: string | null): string | null {
  if (!platform) return null;
  return PLATFORM_BADGE[platform] ?? null;
}

export function getPlatformColor(platform: string | null): string {
  if (!platform) return "bg-gray-50 text-gray-400";
  return PLATFORM_COLOR[platform] ?? "bg-gray-50 text-gray-400";
}
