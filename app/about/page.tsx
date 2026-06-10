import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | 이게머고?",
  description: "이게머고?는 세상의 신기하고 재밌는 물건들을 매일 발견해서 모아두는 한국어 큐레이션 사이트입니다.",
};

const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About | 이게머고?",
  url: "https://www.igemugo.com/about",
  mainEntity: {
    "@type": "Organization",
    name: "이게머고?",
    url: "https://www.igemugo.com",
    logo: "https://www.igemugo.com/2.png",
    email: "hello@igemugo.com",
    description: "세상의 신기하고 재밌는 물건들을 매일 발견해서 모아두는 큐레이션 사이트",
  },
};

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }}
      />
      <div className="flex justify-center mb-6">
        <img src="/2.png" alt="이게머고?" style={{ height: "80px" }} />
      </div>
      <h1 className="text-2xl font-bold mb-8 text-[#111111]">About</h1>
      <div className="space-y-5 text-sm text-gray-600 leading-relaxed">
        <p>
          <span className="text-[#F5A623] font-bold">이게머고?</span>는 세상의 신기하고 재밌는 물건들을 매일 발견해서 모아두는 한국어 큐레이션 사이트입니다.
          알리익스프레스, 쿠팡, 아마존 등 전 세계에서 찾아낸 수백 가지 아이템과 이색 체험·여행 액티비티까지,
          특이한 선물, 재밌는 아이디어 물건, 도파민 자극 아이템을 찾고 있다면 여기가 맞습니다.
        </p>
        <p>
          <span className="text-[#F5A623] font-bold">이게머고?</span>는 세상의 기발하고 독특한 아이템을 소개하는 큐레이션 사이트입니다.
        </p>
        <p>
          &ldquo;이게 뭐야?&rdquo; 하는 순간의 설렘과 재미를 공유하고 싶어서 만들었습니다.
        </p>
        <p>
          본 사이트는 제휴 마케팅 프로그램에 참여하고 있습니다. 링크를 통해 구매가 이루어질 경우 소정의 수수료를 받을 수 있습니다. 하지만 이는 이용자에게 추가 비용을 발생시키지 않습니다.
        </p>
        <p>
          <span className="text-[#F5A623] font-bold">이게머고?</span>는 제휴 마케팅 아이템만을 다루지는 않습니다. 제휴 여부와 관계없이 충분히 기발하고 독특한 재미를 주는 것들을 모두 발굴하여, 최대한의 즐거움을 누릴 수 있는 곳으로 만들기 위해 항상 노력하고 있습니다.
        </p>
        <p>
          본 사이트에 어울릴만한, 함께 공유하고 싶은 재미있는 것이 있다면{" "}
          <a href="mailto:hello@igemugo.com" className="text-[#F5A623] hover:underline">
            hello@igemugo.com
          </a>
          으로 제보 주시면 감사하겠습니다.
        </p>
        <p>운영자: Mugo</p>
      </div>

      <hr className="my-8 border-gray-200" />

      <div className="space-y-5 text-sm text-gray-600 leading-relaxed">
        <h2 className="text-base font-bold text-[#111111]">Privacy Policy / Contact</h2>
        <p>
          <span className="text-[#F5A623] font-bold">이게머고?</span>는 개인정보를 수집하지 않습니다. 로그인 시, 서비스 제공에 필요한 최소한의 식별 정보(닉네임, 프로필 사진, 이메일 주소)만 저장되며 이도 탈퇴 시 즉각 폐기됩니다.
        </p>
        <p>
          문의사항이 있으시면{" "}
          <a href="mailto:hello@igemugo.com" className="text-[#F5A623] hover:underline">
            hello@igemugo.com
          </a>
          으로 연락해 주시면 빠른 시일 내에 답변 드리겠습니다.
        </p>
      </div>
    </div>
  );
}
