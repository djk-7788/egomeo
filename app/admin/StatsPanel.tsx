"use client";

type Platform = "amazon_us" | "amazon_jp" | "aliexpress" | "coupang" | "etc" | null;

type Product = {
  is_active: boolean;
  is_queued: boolean;
  platform: Platform;
  video_url: string | null;
  image_urls: string[] | null;
};

type Props = {
  products: Product[];
};

const PLATFORM_LABELS: Record<string, string> = {
  aliexpress: "알리익스프레스",
  coupang: "쿠팡",
  amazon_us: "🇺🇸 아마존 US",
  amazon_jp: "🇯🇵 아마존 JP",
  etc: "기타",
  none: "미분류",
};

const PLATFORM_COLORS: Record<string, string> = {
  aliexpress: "bg-orange-50 border-orange-200 text-orange-700",
  coupang: "bg-red-50 border-red-200 text-red-700",
  amazon_us: "bg-yellow-50 border-yellow-200 text-yellow-700",
  amazon_jp: "bg-yellow-50 border-yellow-200 text-yellow-700",
  etc: "bg-gray-50 border-gray-200 text-gray-600",
  none: "bg-gray-50 border-gray-100 text-gray-400",
};

export default function StatsPanel({ products }: Props) {
  const active = products.filter((p) => p.is_active && !p.is_queued);
  const queued = products.filter((p) => p.is_queued);
  const hidden = products.filter((p) => !p.is_active && !p.is_queued);

  // 플랫폼 분포 (공개+큐 합산)
  const visible = products.filter((p) => p.is_active || p.is_queued);
  const platformKeys: (string)[] = ["aliexpress", "coupang", "amazon_us", "amazon_jp", "etc", "none"];
  const platformCounts = platformKeys.reduce<Record<string, number>>((acc, key) => {
    acc[key] = visible.filter((p) =>
      key === "none" ? p.platform === null : p.platform === key
    ).length;
    return acc;
  }, {});

  const videoCount = products.filter((p) => p.video_url).length;
  const slideCount = products.filter(
    (p) => Array.isArray(p.image_urls) && p.image_urls.length >= 2
  ).length;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

      {/* 상품 현황 */}
      <section>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">상품 현황</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="전체" value={products.length} color="bg-white" />
          <StatCard label="공개" value={active.length} color="bg-white" accent />
          <StatCard label="큐 대기" value={queued.length} color="bg-amber-50" labelColor="text-amber-600" valueColor="text-amber-600" />
          <StatCard label="숨김" value={hidden.length} color="bg-white" labelColor="text-gray-400" valueColor="text-gray-400" />
        </div>
      </section>

      {/* 플랫폼 분포 */}
      <section>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
          플랫폼별 분포 <span className="normal-case font-normal text-gray-300">(공개+큐 {visible.length}개 기준)</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {platformKeys.map((key) => (
            platformCounts[key] > 0 || key !== "none" ? (
              <div
                key={key}
                className={`rounded-xl border px-4 py-3 flex items-center justify-between ${PLATFORM_COLORS[key]}`}
              >
                <span className="text-sm font-semibold">{PLATFORM_LABELS[key]}</span>
                <span className="text-2xl font-black">{platformCounts[key]}</span>
              </div>
            ) : null
          ))}
        </div>
      </section>

      {/* 미디어 타입 */}
      <section>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">미디어 타입 (전체 기준)</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-1">🎬 영상 상품</p>
              <p className="text-3xl font-black text-[#111111]">{videoCount}</p>
            </div>
            <p className="text-xs text-gray-300">
              {products.length > 0 ? Math.round((videoCount / products.length) * 100) : 0}%
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-1">🖼️ 슬라이드 상품</p>
              <p className="text-3xl font-black text-[#111111]">{slideCount}</p>
            </div>
            <p className="text-xs text-gray-300">
              {products.length > 0 ? Math.round((slideCount / products.length) * 100) : 0}%
            </p>
          </div>
        </div>
      </section>

      {/* 외부 링크 */}
      <section>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">외부 도구</h2>
        <a
          href="https://analytics.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-5 py-3 text-sm font-semibold text-[#111111] hover:border-[#F5A623] hover:text-[#F5A623] transition-colors"
        >
          <span>📊</span>
          Google Analytics 대시보드 열기 ↗
        </a>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "bg-white",
  accent = false,
  labelColor = "text-gray-400",
  valueColor,
}: {
  label: string;
  value: number;
  color?: string;
  accent?: boolean;
  labelColor?: string;
  valueColor?: string;
}) {
  const resolvedValueColor = valueColor ?? (accent ? "text-[#F5A623]" : "text-[#111111]");
  const resolvedLabelColor = accent ? "text-[#F5A623]" : labelColor;

  return (
    <div className={`${color} rounded-xl border border-gray-100 px-4 py-4`}>
      <p className={`text-xs font-semibold mb-1 ${resolvedLabelColor}`}>{label}</p>
      <p className={`text-4xl font-black ${resolvedValueColor}`}>{value}</p>
    </div>
  );
}
