import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | 이게머고?",
  description: "이게머고?는 세계 각지의 기발하고 독특한 아이템을 소개하는 큐레이션 사이트입니다.",
};

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      <h1 className="text-2xl font-bold mb-8 text-[#111111]">About</h1>
      <div className="space-y-5 text-sm text-gray-600 leading-relaxed">
        <p>
          이게머고?는 세계 각지의 기발하고 독특한 아이템을 소개하는 큐레이션 사이트입니다.
        </p>
        <p>
          &ldquo;이게 뭐야?&rdquo; 하는 순간의 설렘을 전달하고 싶어서 만들었습니다.
        </p>
        <div className="pt-4 border-t border-gray-100 space-y-2">
          <p><span className="text-[#111111] font-medium">운영자</span>: Mugo</p>
          <p>
            <span className="text-[#111111] font-medium">문의</span>:{" "}
            <a href="mailto:hello@igemugo.com" className="text-[#FF7A30] hover:underline">
              hello@igemugo.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
