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
- **미디어 스토리지**: Cloudflare R2 (`@aws-sdk/client-s3`, S3 호환 API)
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
CLOUDFLARE_R2_ENDPOINT=https://<계정ID>.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY_ID=액세스키
CLOUDFLARE_R2_SECRET_ACCESS_KEY=시크릿키
CLOUDFLARE_R2_BUCKET_NAME=버킷명
CLOUDFLARE_R2_PUBLIC_URL=https://퍼블릭도메인
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
| `CLOUDFLARE_R2_ENDPOINT` | `https://<계정ID>.r2.cloudflarestorage.com` |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 API 토큰 액세스 키 |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 API 토큰 시크릿 키 |
| `CLOUDFLARE_R2_BUCKET_NAME` | R2 버킷명 |
| `CLOUDFLARE_R2_PUBLIC_URL` | R2 퍼블릭 도메인 (버킷에 연결된 도메인) |

---

## Supabase 구조

### `products` 테이블
```sql
id            uuid (PK, 자동생성)
created_at    timestamp (자동생성)
title         text          -- 드립형 제목
category      text          -- 'mild' | 'medium' | 'hot'
image_url     text          -- Cloudflare R2 퍼블릭 URL (기존 Supabase Storage에서 마이그레이션 완료)
video_url     text          -- Cloudflare R2 영상 URL (선택, null 가능)
price         text          -- 표시용 (예: ₩32,900)
affiliate_link text         -- 쿠팡/알리 링크
is_active     boolean       -- false면 메인페이지에 안 보임
```

**RLS**: 비활성화됨 (`alter table products disable row level security`)
→ 나중에 Supabase Auth 연동 시 RLS 정책 재설정 필요

### Storage
- 버킷명: `product-images` (퍼블릭) — 기존 레거시. 신규 업로드는 R2로만
- 신규 이미지/영상은 모두 Cloudflare R2에 저장됨 (`/api/upload`)

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
│ 2층: 1:1 영상 또는 이미지  │  ← 클릭 시 쿠팡/알리 링크 새 창 (video_url 있으면 autoplay 영상)
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
│   │   ├── AdminPanel.tsx    # 상품 CRUD 관리 패널 — 3개 탭 + R2 업로드 + 마이그레이션 버튼
│   │   ├── AliexpressSearch.tsx  # 알리 검색 탭 (좌우 분할, URL 직접 입력, 클리어 버튼)
│   │   └── UrlParser.tsx     # URL 파싱 탭 (쿠팡/아마존 URL → 이미지/가격 추출)
│   ├── api/
│   │   ├── upload/
│   │   │   └── route.ts      # R2 파일 업로드 (이미지/영상, admin_auth 쿠키 필요)
│   │   ├── migrate-to-r2/
│   │   │   └── route.ts      # Supabase Storage → R2 일괄 마이그레이션 (maxDuration 300s)
│   │   ├── aliexpress/
│   │   │   ├── search/
│   │   │   │   └── route.ts  # 알리 키워드 검색 (MD5 서명, KRW 변환, 최대 50개)
│   │   │   └── parse/
│   │   │       └── route.ts  # 알리 URL → 상품 ID 추출 → API 조회
│   │   └── parse-url/
│   │       └── route.ts      # 쿠팡/아마존 URL 파싱 (봇 차단으로 제한적)
│   └── product/
│       └── [id]/
│           └── page.tsx      # 상품 상세 페이지 (공유 링크용, 영상 지원)
├── components/
│   ├── Header.tsx            # 상단 고정 헤더 + 카테고리 네비
│   ├── Footer.tsx            # 쿠팡파트너스 고지 문구 + 저작권
│   ├── ProductCard.tsx       # 5층 카드 컴포넌트 (video_url 있으면 영상 표시)
│   ├── CardShareButton.tsx   # 카드 내 공유 버튼 (클라이언트)
│   └── ShareButton.tsx       # 상세 페이지 공유 버튼 (클라이언트)
├── lib/
│   ├── supabase.ts           # Supabase 클라이언트 싱글톤
│   └── r2.ts                 # Cloudflare R2 S3 클라이언트 (endpoint/bucket/publicUrl export)
└── chrome-extension/         # 크롬 확장 프로그램 "이게머고? 미디어툴" (Manifest V3)
    ├── manifest.json         # MV3 설정 (host_permissions: aliexpress/alicdn)
    ├── background.js         # 아이콘 클릭 → 새 탭 열기
    ├── newtab.html           # 전체 화면 UI (슬라이드쇼 + 영상 자르기 탭)
    ├── newtab.css            # 스타일 (#FF5A00 포인트)
    └── newtab.js             # 알리 이미지 fetch, Canvas+MediaRecorder 슬라이드쇼, 영상 자르기
```

---

## 페이지별 동작

### 메인 페이지 (`/`)
- Supabase에서 `is_active = true` 상품을 최신순으로 fetch (서버 컴포넌트)
- 풀와이드 그리드로 ProductCard 렌더링

### 상품 상세 페이지 (`/product/[id]`)
- **공유 링크 전용** — 카드에서 직접 진입 불가, 공유 버튼으로만 접근
- 상단: 해당 상품 크게 표시 (영상 또는 이미지 + 카테고리 + 제목 + 가격 + 구경하러가기 버튼 + 공유 버튼)
- 하단: 다른 상품 그리드 ("이건 또 머고?" 섹션)
- OG 태그 포함 → 카톡/SNS 공유 시 미리보기 표시

### 관리자 페이지 (`/admin`)
- 비밀번호: `ADMIN_PASSWORD` 환경변수 (현재 `egomeo1234`)
- 인증: HttpOnly 쿠키 기반, 24시간 유지
- **탭 1 — 상품 목록**: 등록/수정/삭제, 노출/숨김 토글, 미리보기 링크, 미디어 타입 표시
  - "☁️ Supabase → R2 마이그레이션" 버튼 (Supabase Storage URL → R2 URL 일괄 변환)
- **탭 2 — 알리익스프레스 검색**:
  - 좌우 분할 레이아웃 (왼쪽 65% 그리드 스크롤 / 오른쪽 35% sticky 패널)
  - 키워드 검색 (최대 50개, 정렬: 관련도/판매량/가격순, 카테고리 필터 10종)
  - URL 직접 입력: 알리 상품 URL → 상품 ID 추출 → Affiliate API 조회
  - 상품 클릭 → 오른쪽 패널에 이미지 여러 장 표시 → 선택 후 폼에 불러오기
  - 썸네일 hover 시 280px 확대 팝업, 원본 보기 버튼
  - 입력창 클리어(X) 버튼 (키워드/URL 모두)
- **탭 3 — URL 파싱**:
  - 쿠팡/아마존 상품 URL 붙여넣기 → 이미지/가격/상품명 자동 추출
  - **주의**: 쿠팡/아마존 모두 봇 차단(403/Cloudflare)으로 현재 제한적으로만 동작
- **상품 등록/수정 모달**:
  - 이미지 업로드 → R2 저장 (`/api/upload`)
  - 영상 업로드 (선택) → R2 저장, `video_url` 컬럼에 저장
  - 모달: backdrop 클릭 시 닫기, 내부 스크롤(max-height 90vh)

---

## 최근 완료 작업 (2026-05-22 기준)

아래 항목들이 이번 세션에서 완료됨. 상세 내용은 하단 "완료된 작업" 참고.

- Cloudflare R2 연동 (이미지+영상 스토리지, 버킷: `egomeo-media`)
- 기존 Supabase Storage 이미지 40개 R2 마이그레이션 완료
- MP4 영상 업로드 기능 (`video_url` 컬럼 추가, Vercel 4.5MB 한계는 청크 분할 업로드로 우회)
- 스크롤 재생/정지 (VideoPlayer 컴포넌트, Intersection Observer, threshold 0.5)
- 무한 스크롤 전면 개편 (메인 피드 + 상세 페이지 하단, 12개씩, 하단 400px 전 미리 로드)
- 공정위 고지 문구 추가 (헤더 아래 비고정, 전 페이지 공통)
- 크롬 확장 프로그램 "이게머고? 미디어툴" 제작 (`chrome-extension/` 폴더, Manifest V3)

---

## 어필리에이트 현황 (2026-05-22 기준)

| 플랫폼 | 상태 | 비고 |
|---|---|---|
| 쿠팡파트너스 | 가입 신청 중 / 예정 | 링크 발급 후 즉시 적용 가능 |
| 알리익스프레스 | **API 연동 완료** | APP_KEY/SECRET/TRACKING_ID Vercel 등록 완료. 검색 → 폼 자동입력 동작 중 |
| 아마존 어소시에이트 | 가입 신청 중 / 예정 | 해외 상품 대응용, 달러 수익 |

---

## 완료된 작업

- [완료] Next.js 프로젝트 생성 (TypeScript, App Router, Tailwind CSS)
- [완료] GitHub 연동 (https://github.com/djk-7788/egomeo.git)
- [완료] Vercel 배포 + 환경변수 등록
- [완료] Supabase 연동 (`lib/supabase.ts`)
- [완료] `products` 테이블 생성 + RLS 비활성화
- [완료] Supabase Storage 버킷 생성 (`product-images`, 퍼블릭) — 레거시, 신규는 R2
- [완료] 전역 디자인 시스템 (색상, 폰트, 레이아웃)
- [완료] Header 컴포넌트 (sticky, 카테고리 네비)
- [완료] Footer 컴포넌트 (쿠팡파트너스 고지 문구)
- [완료] ProductCard 컴포넌트 (5층 구조, video_url 지원)
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
- [완료] 알리 검색 결과 50개로 확대, 정렬 옵션(관련도/판매량/가격순), 카테고리 필터 10종
- [완료] 알리 검색 탭 좌우 분할 레이아웃 (왼쪽 65% 그리드 / 오른쪽 35% sticky 패널)
- [완료] 이미지 썸네일 hover 확대 팝업 (280px, viewport 클램핑)
- [완료] 알리 검색 상품 원본 보기 버튼 (알리익스프레스 새 탭)
- [완료] 알리 URL 직접 입력 기능 (`/api/aliexpress/parse` — 상품 ID 추출 후 API 조회)
- [완료] 입력창 커스텀 클리어(X) 버튼 (키워드/URL 입력창, 텍스트 있을 때만 표시)
- [완료] URL 파싱 탭 추가 (`UrlParser.tsx` + `/api/parse-url`) — 쿠팡/아마존 URL 파싱 (봇 차단으로 제한적)
- [완료] Cloudflare R2 연동 (`lib/r2.ts`, `@aws-sdk/client-s3`, 버킷: `egomeo-media`)
- [완료] R2 업로드 API (`/api/upload`) — 이미지/영상 모두 처리, admin_auth 쿠키 인증
- [완료] Supabase Storage → R2 마이그레이션 API (`/api/migrate-to-r2`) + 관리자 버튼
- [완료] `products` 테이블에 `video_url` 컬럼 추가 (text, nullable)
- [완료] ProductCard에 영상 지원 — video_url 있으면 VideoPlayer(Intersection Observer), 없으면 이미지
- [완료] 상품 상세 페이지에 VideoPlayer 적용 (뷰포트 이탈 시 정지+되감기)
- [완료] 관리자 모달에 영상 업로드 필드 추가 (선택사항)
- [완료] 무한 스크롤 (`InfiniteProductGrid`) — 메인 피드 + 상세 페이지 하단, 12개씩 추가 로드, 하단 400px 전 미리 로드, 스피너
- [완료] 상품 페이지네이션 API (`/api/products`) — page, limit, excludeId, category 파라미터
- [완료] 공정위 고지 문구 추가 — 헤더 바로 아래 비고정(sticky 아님), 전 페이지 공통 적용 (`app/layout.tsx`)
- [완료] 크롬 확장 프로그램 "이게머고? 미디어툴" 제작 (`chrome-extension/` 폴더, Manifest V3)
  - 슬라이드쇼 만들기 탭: 알리 URL 입력 → 이미지 선택(체크박스) → 드래그 순서 조정 → 간격 설정(0.5~2초) → Canvas+MediaRecorder로 MP4/WebM 생성 + 다운로드
  - 영상 자르기 탭: 영상 파일 업로드 → 타임라인 핸들로 구간 선택 → 자르기 + 다운로드
  - host_permissions으로 aliexpress.com/alicdn.com CORS 없이 직접 fetch

---

## 다음 할 일 (우선순위순)

1. **AI 드립 제목 생성** — 알리 검색 후 원본 상품명 기반으로 Claude API 호출해 드립형 제목 자동 생성
2. **크롬 확장 슬라이드쇼 이미지 추출 개선** — 알리 페이지가 JS 렌더링 전용이면 정적 HTML에서 이미지 못 찾는 문제 해결 필요 (content script 방식 검토)
3. **쿠팡/아마존 URL 파싱 개선** — 현재 봇 차단으로 제한적. Puppeteer/플레이라이트 서버리스 또는 별도 파싱 서비스 검토 필요
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
| 이미지/영상을 Cloudflare R2에 저장 | Supabase Storage 대비 대용량 파일 비용 유리, 글로벌 CDN, 영상 스트리밍 적합 |
| R2 업로드를 서버 API 경유 | 브라우저에서 직접 R2에 올리면 시크릿 키 노출 위험. `/api/upload`가 admin 쿠키 검증 후 처리 |
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
