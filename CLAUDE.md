# 이게머고? 프로젝트 — 작업 인수인계 문서

새 채팅창에서 처음 보는 사람도 바로 이어서 작업할 수 있도록 작성됨.

---

## 프로젝트 개요

- **사이트명**: 이게머고?
- **성격**: 신기하고 별난 물건 큐레이션 사이트 (thisiswhyimbroke.com 벤치마크)
- **타겟**: 20~40대, 밈 친화적, 얼리어답터
- **톤**: 힙하고 위트있는 긱 스페이스, 촌철살인 드립
- **수익모델**: 쿠팡파트너스 + 알리익스프레스 어필리에이트 + 아마존 어소시에이트 (추가 예정)

---

## 기술 스택

- **Frontend**: Next.js 16 (TypeScript, App Router, Tailwind CSS)
- **DB/Auth**: Supabase
- **이미지 스토리지**: Supabase Storage (`product-images` 버킷)
- **배포**: Vercel (GitHub 자동 연동, push하면 자동 재배포)
- **저장소**: https://github.com/djk-7788/egomeo.git

---

## 환경변수

### 로컬 (`.env.local`) — git에 올라가지 않음
```
NEXT_PUBLIC_SUPABASE_URL=https://akcpwirzkjdmdrajntum.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ADMIN_PASSWORD=egomeo1234
ALIEXPRESS_APP_KEY=발급받은키
ALIEXPRESS_APP_SECRET=발급받은시크릿
ALIEXPRESS_TRACKING_ID=default
```

### Vercel — 대시보드에서 직접 설정됨 (Production + Preview)
| 변수명 | 비고 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 키 |
| `ADMIN_PASSWORD` | 관리자 페이지 비밀번호 (`egomeo1234`) |
| `ALIEXPRESS_APP_KEY` | 알리 Open Platform 앱 키 (6자리) |
| `ALIEXPRESS_APP_SECRET` | 알리 Open Platform 앱 시크릿 (32자리) |
| `ALIEXPRESS_TRACKING_ID` | 알리 트래킹 ID (현재 `default`) |

---

## Supabase 구조

### `products` 테이블
```sql
id            uuid (PK, 자동생성)
created_at    timestamp (자동생성)
title         text          -- 드립형 제목
category      text          -- 'mild' | 'medium' | 'hot'
image_url     text          -- Supabase Storage 퍼블릭 URL
price         text          -- 표시용 (예: ₩32,900)
affiliate_link text         -- 쿠팡/알리 링크
is_active     boolean       -- false면 메인페이지에 안 보임
```

**RLS**: 비활성화됨 (`alter table products disable row level security`)
→ 나중에 Supabase Auth 연동 시 RLS 정책 재설정 필요

### Storage
- 버킷명: `product-images` (퍼블릭)
- 정책: anon INSERT 허용
- 관리자 페이지에서 이미지 업로드 → 자동으로 퍼블릭 URL 저장

---

## 디자인 규칙

- **배경**: `#FFFFFF`
- **텍스트**: `#111111`
- **포인트 컬러**: `#FF5A00` — 가격, 버튼, 호버에만 제한적 사용
- **레이아웃**: 풀와이드 그리드, 사이드바 없음
  - 모바일: 1열
  - 태블릿: 2열
  - 데스크톱: 3열
  - 와이드: 4열
- **헤더**: sticky, 흰 배경, 하단 border

---

## 카드 구조 (5층)

```
┌─────────────────────────┐
│ 1층: 카테고리 뱃지        │
│ 2층: 1:1 이미지          │  ← 클릭 시 쿠팡/알리 링크 새 창
│ 3층: 드립형 제목          │
│ 4층: 가격 ₩00,000  [🔗]  │  ← 🔗 클릭 시 상세페이지 URL 복사
│ 5층: [구경하러 가기]       │  ← 쿠팡/알리 링크 새 창
└─────────────────────────┘
```

---

## 카테고리

| 값 | 표시 레이블 |
|---|---|
| `mild` | 이게 머고? |
| `medium` | 이게? 머고??? |
| `hot` | 이게??? 머고??????? |

### 분류 기준

| 카테고리 | 기준 | 예시 반응 |
|---|---|---|
| `mild` | 실용성 있거나 디자인이 기발하거나 있으면 좋겠는 것 | "이거 나한테 선물 받으면 갖고 싶다/써보고 싶다" |
| `medium` | 황당하지만 실제로 존재하는 게 신기한 것 | "이게 뭐야 ㅋㅋ 근데 웃기다" |
| `hot` | 보는 순간 소리 나오는 것, 구매 의사 0% | "이걸 누가 사? 미쳤나?" |

**추가 규칙**
- 애매하면 `mild`로
- `hot`은 전체 상품의 20% 넘으면 안 됨

---

## 파일 구조

```
egomeo/
├── app/
│   ├── layout.tsx            # 전체 레이아웃 (Header + main + Footer)
│   ├── page.tsx              # 메인 페이지 — Supabase에서 상품 목록 fetch
│   ├── globals.css           # 전역 스타일 (색상 변수 포함)
│   ├── admin/
│   │   ├── page.tsx          # 쿠키 확인 → LoginForm or AdminPanel
│   │   ├── actions.ts        # 로그인/로그아웃 서버 액션
│   │   ├── LoginForm.tsx     # 비밀번호 입력 화면 (클라이언트)
│   │   ├── AdminPanel.tsx    # 상품 CRUD 관리 패널 (클라이언트) + 알리 검색 탭
│   │   └── AliexpressSearch.tsx  # 알리익스프레스 상품 검색 컴포넌트 (클라이언트)
│   ├── api/
│   │   └── aliexpress/
│   │       └── search/
│   │           └── route.ts  # 알리 Affiliate API 키워드 검색 (MD5 서명, KRW 변환)
│   └── product/
│       └── [id]/
│           └── page.tsx      # 상품 상세 페이지 (공유 링크용)
├── components/
│   ├── Header.tsx            # 상단 고정 헤더 + 카테고리 네비
│   ├── Footer.tsx            # 쿠팡파트너스 고지 문구 + 저작권
│   ├── ProductCard.tsx       # 5층 카드 컴포넌트
│   ├── CardShareButton.tsx   # 카드 내 공유 버튼 (클라이언트)
│   └── ShareButton.tsx       # 상세 페이지 공유 버튼 (클라이언트)
└── lib/
    └── supabase.ts           # Supabase 클라이언트 싱글톤
```

---

## 페이지별 동작

### 메인 페이지 (`/`)
- Supabase에서 `is_active = true` 상품을 최신순으로 fetch (서버 컴포넌트)
- 풀와이드 그리드로 ProductCard 렌더링

### 상품 상세 페이지 (`/product/[id]`)
- **공유 링크 전용** — 카드에서 직접 진입 불가, 공유 버튼으로만 접근
- 상단: 해당 상품 크게 표시 (이미지 + 카테고리 + 제목 + 가격 + 구경하러가기 버튼 + 공유 버튼)
- 하단: 다른 상품 그리드 ("이건 또 머고?" 섹션)
- OG 태그 포함 → 카톡/SNS 공유 시 미리보기 표시

### 관리자 페이지 (`/admin`)
- 비밀번호: `ADMIN_PASSWORD` 환경변수 (현재 `egomeo1234`)
- 인증: HttpOnly 쿠키 기반, 24시간 유지
- **탭 1 — 상품 목록**: 등록/수정/삭제, 노출/숨김 토글, 미리보기 링크
- **탭 2 — 알리익스프레스 검색**: 키워드 검색 → 상품 클릭 → 폼에 이미지/가격/링크 자동입력
- 이미지: 파일 업로드(Supabase Storage) 또는 알리 검색으로 외부 URL 자동 입력
- 모달: backdrop 클릭 시 닫기, 내부 스크롤(max-height 90vh)

---

## 어필리에이트 현황 (2026-05-21 기준)

| 플랫폼 | 상태 | 비고 |
|---|---|---|
| 쿠팡파트너스 | 가입 신청 중 / 예정 | 링크 발급 후 즉시 적용 가능 |
| 알리익스프레스 | **API 연동 완료** | APP_KEY/SECRET/TRACKING_ID Vercel 등록 완료. 검색 → 폼 자동입력 동작 중 |
| 아마존 어소시에이트 | 가입 신청 중 / 예정 | 해외 상품 대응용, 달러 수익 |

> 알리익스프레스: API로 불러온 `promotion_link`가 어필리에이트 링크로 자동 저장됨. 트래킹 ID는 현재 `default` 사용 중 — 포털에서 별도 ID 생성 후 `ALIEXPRESS_TRACKING_ID` 환경변수 교체 가능.
>
> 쿠팡파트너스/아마존: 가입 승인 후 관리자 패널에서 `affiliate_link` 필드 직접 수정.

---

## 완료된 작업

- [완료] Next.js 프로젝트 생성 (TypeScript, App Router, Tailwind CSS)
- [완료] GitHub 연동 (https://github.com/djk-7788/egomeo.git)
- [완료] Vercel 배포 + 환경변수 등록
- [완료] Supabase 연동 (`lib/supabase.ts`)
- [완료] `products` 테이블 생성 + RLS 비활성화
- [완료] Supabase Storage 버킷 생성 (`product-images`, 퍼블릭)
- [완료] 전역 디자인 시스템 (색상, 폰트, 레이아웃)
- [완료] Header 컴포넌트 (sticky, 카테고리 네비)
- [완료] Footer 컴포넌트 (쿠팡파트너스 고지 문구)
- [완료] ProductCard 컴포넌트 (5층 구조)
- [완료] 메인 페이지 — Supabase 실데이터 연결
- [완료] 관리자 페이지 (`/admin`) — 전체 CRUD
- [완료] 상품 상세 페이지 (`/product/[id]`) — 공유 링크용
- [완료] 카드 이미지 클릭 → 쿠팡/알리 링크 새 창
- [완료] 카드 공유 버튼 (🔗) → 상세페이지 URL 클립보드 복사
- [완료] 상세 페이지 공유 버튼 → 현재 URL 클립보드 복사
- [완료] OG 태그 (카톡/SNS 공유 미리보기)
- [완료] 관리자 노출/숨김 토글 버튼
- [완료] 헤더 카테고리 필터 — URL 쿼리 파라미터 방식 (`?category=mild|medium|hot`)
- [완료] 메인 페이지 dynamic 렌더링 설정 + Supabase 에러 로그 추가
- [완료] 알리익스프레스 Affiliate API 연동 (`/api/aliexpress/search` — MD5 서명, KRW 변환)
- [완료] 관리자 페이지 알리 검색 탭 추가 (`AliexpressSearch.tsx`)
- [완료] 알리 검색 결과 클릭 시 등록 폼 자동입력 (이미지/가격/링크 + 원본명 참고 힌트)
- [완료] 모달 스크롤 개선 (backdrop 분리, max-height 90vh, 바깥 클릭 닫기)

---

## 다음 할 일 (우선순위순)

1. **AI 드립 제목 생성** — 알리 검색 후 원본 상품명 기반으로 Claude API 호출해 드립형 제목 자동 생성
2. **반자동 포스팅 시스템** — 상품 URL 입력 시 제목/이미지/가격 자동 추출 (구현 방식 미정)
3. **무한 스크롤** — 메인 페이지 상품 목록 페이지네이션 (현재 전체 로드)
4. **알리 트래킹 ID 교체** — 포털에서 전용 ID 생성 후 `ALIEXPRESS_TRACKING_ID` 환경변수 교체
5. **소셜 로그인** — Supabase Auth (구글/카카오/네이버)
6. **찜하기** — 하트 버튼, 마이페이지

---

## 주요 설계 결정사항

| 결정 | 이유 |
|---|---|
| 상세페이지는 공유 링크로만 접근 | 카드에서 상세페이지로 직접 이동하면 SEO 낭비, 공유 바이럴에 집중 |
| 가격을 text 타입으로 저장 | `₩32,900` 형태 그대로 표시, 정렬/계산 기능 없음 |
| RLS 비활성화 | 소셜 로그인 미구현 상태에서 임시 조치. Auth 붙이면 재설정 필요 |
| 관리자 인증을 쿠키+환경변수로 | Supabase Auth 없이 빠르게 구현. 나중에 Supabase Admin 역할로 교체 가능 |
| 이미지를 Supabase Storage에 저장 | CDN 역할, 퍼블릭 URL 영구 유지 |
| 서버 컴포넌트로 데이터 fetch | SEO와 초기 로딩 속도 최적화 |

---

## 작업 방식 (중요 — 반드시 지킬 것)

- **사용자는 개발 경험이 없는 완전 초보**
- 단계별로 확인하면서 진행할 것 — 한 번에 너무 많이 바꾸지 말 것
- 각 단계마다 뭘 했는지 한국어로 설명할 것
- 에러 나면 혼자 못 고치니 우회 방법 먼저 제시할 것
- **모든 대화는 한국어로**
- 작업 완료 후에는 반드시 `npm run build`로 빌드 검증 후 push
- push는 항상 `git add → git commit → git push` 순서
