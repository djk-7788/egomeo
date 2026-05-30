import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | 참아야하느니라",
  description: "참아야하느니라 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      <h1 className="text-2xl font-bold mb-8 text-[#111111]">Privacy Policy</h1>
      <div className="space-y-5 text-sm text-gray-600 leading-relaxed">
        <p>
          참아야하느니라(igemugo.com)는 이용자의 개인정보를 수집하지 않습니다.
        </p>
        <p>
          본 사이트는 제휴 마케팅 프로그램에 참여하고 있습니다. 상품 링크를 통해 구매가 이루어질 경우 소정의 수수료를 받을 수 있습니다. 이는 이용자에게 추가 비용을 발생시키지 않습니다.
        </p>
        <div className="pt-4 border-t border-gray-100">
          <p>
            <span className="text-[#111111] font-medium">문의</span>:{" "}
            <a href="mailto:hello@igemugo.com" className="text-[#F5A623] hover:underline">
              hello@igemugo.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}