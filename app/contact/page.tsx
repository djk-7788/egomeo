import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact | 참아야하느니라",
  description: "참아야하느니라 문의하기",
};

export default function ContactPage() {
  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      <h1 className="text-2xl font-bold mb-8 text-[#111111]">Contact</h1>
      <div className="space-y-5 text-sm text-gray-600 leading-relaxed">
        <p>문의사항이 있으시면 아래 이메일로 연락해 주세요.</p>
        <p>
          <a href="mailto:hello@igemugo.com" className="text-[#F5A623] hover:underline text-base font-medium">
            hello@igemugo.com
          </a>
        </p>
        <p>빠른 시일 내에 답변 드리겠습니다.</p>
      </div>
    </div>
  );
}