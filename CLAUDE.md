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

- **Frontend**: Next.js 16 (TypeScript, App Router, Tailwind CSS), @tanstack/react-virtual v3 (가상 스크롤)
- **DB/Auth**: Supabase
- **미디어 스토리지**: Cloudflare R2 (`@aws-sdk/client-s3`, S3 호환 API)
- **배포**: Vercel (GitHub 자동 연동, push하면 자동 재배포)
- **도메인**: www.igemugo.com (Cloudflare Registrar 구매, Vercel 연결)
- **이메일**: hello@igemugo.com (Cloudflare Email Routing → Gmail 포워딩)
- **저장소**: https://github.com/djk-7788/egomeo.git

---

## 환경변수

### 로컬 (`.env.local`) — git에 올라가지 않음
```
NEXT_PUBLIC_GA_ID=G-6P979RX187
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
| `NEXT_PUBLIC_GA_ID` | Google Analytics 측정 ID (`G-6P979RX187`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 롤 키 — 서버 전용, 회원 탈퇴·서버사이드 JWT 검증에 사용 |
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
image_urls    text[]        -- 슬라이드용 추가 이미지 배열 (선택, null 가능, 2장 이상이면 카드에서 슬라이드)
video_url     text          -- Cloudflare R2 영상 URL (선택, null 가능)
affiliate_link text         -- 쿠팡/알리/아마존 링크
is_active     boolean       -- false면 메인페이지에 안 보임
is_queued     boolean       -- true면 큐(임시저장) 상태, is_active=false와 함께 사용
sort_order    integer       -- 노출 순서 (낮을수록 앞에 표시, null이면 맨 뒤)
platform      text          -- 'amazon_us' | 'amazon_jp' | 'aliexpress' | 'coupang' | 'klook' | 'etc' | null
button_text   text          -- 카드/상세 페이지 버튼 텍스트 커스터마이징 (null이면 "구경하러 가기" 기본값)
```

> **가격(price) 컬럼은 제거됨** — 2026-05-23 `ALTER TABLE products DROP COLUMN price;` 실행 완료  
> **platform 컬럼 추가** — 2026-05-24 `ALTER TABLE products ADD COLUMN IF NOT EXISTS platform text;` 실행 완료  
> **is_queued 컬럼 추가** — 2026-05-26 `ALTER TABLE products ADD COLUMN IF NOT EXISTS is_queued boolean DEFAULT false;` 실행 완료  
> **image_urls 컬럼 추가** — 2026-05-28 `ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls text[];` 실행 완료  
> **button_text 컬럼 추가** — 2026-05-29 `ALTER TABLE products ADD COLUMN IF NOT EXISTS button_text text;` 실행 완료

**RLS**: 활성화됨 (2026-06-07)
- SELECT: `is_active = true`인 상품만 공개 (anon 포함 누구나)
- INSERT/UPDATE/DELETE: 정책 없음 → 클라이언트 쓰기 완전 차단 (service_role은 RLS 우회하므로 어드민 API 정상 동작)

### `likes` 테이블
```sql
id          uuid DEFAULT gen_random_uuid() PRIMARY KEY
user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE
product_id  uuid REFERENCES products(id) ON DELETE CASCADE
created_at  timestamp with time zone DEFAULT now()
UNIQUE(user_id, product_id)
```
**RLS 활성화됨** (정책명: likes_select_own / likes_insert_own / likes_delete_own)
- SELECT: `auth.uid() = user_id` (본인 likes만 조회)
- INSERT: `auth.uid() = user_id` (WITH CHECK)
- DELETE: `auth.uid() = user_id`

### `profiles` 테이블
```sql
id          uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY
nickname    text
avatar_url  text
updated_at  timestamp with time zone DEFAULT now()
```
**RLS 활성화됨** (정책명: profiles_select_own / profiles_insert_own / profiles_update_own / profiles_delete_own)
- SELECT: `auth.uid() = id`
- INSERT: `auth.uid() = id` (WITH CHECK)
- UPDATE: `auth.uid() = id`
- DELETE: `auth.uid() = id`

> **목적**: 닉네임·아바타를 OAuth 메타데이터 대신 여기에 저장해 재로그인 시 OAuth가 덮어쓰는 것을 방지.
> 조회 우선순위: profiles 테이블 → OAuth user_metadata 폴백

### `viewed_products` 테이블
```sql
id          uuid DEFAULT gen_random_uuid() PRIMARY KEY
user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE
product_id  uuid REFERENCES products(id) ON DELETE CASCADE
viewed_at   timestamptz DEFAULT now()
UNIQUE(user_id, product_id)
```
**RLS 활성화됨** (정책명: viewed_products_select_own / viewed_products_insert_own / viewed_products_delete_own)
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id` (WITH CHECK)
- DELETE: `auth.uid() = user_id`

> **목적**: "안 본 것만 보기" 기능용. 사용자가 /unseen 페이지에서 스크롤로 상단을 벗어난 상품이 여기에 기록됨. 다음 방문 시 NOT IN 필터로 이미 본 상품 제외.

### Storage
- 버킷명: `product-images` (퍼블릭) — 기존 레거시. 신규 업로드는 R2로만
- 신규 이미지/영상은 모두 Cloudflare R2에 저장됨 (`/api/upload`)

---

## 디자인 규칙

- **배경**: `#FFFFFF`
- **텍스트**: `#111111`
- **포인트 컬러**: `#F5A623` — 버튼, 호버에만 제한적 사용 (호버: `#d8921f`)
- **레이아웃**: 풀와이드 그리드, 사이드바 없음, 최대 3열
  - 모바일 (< 640px): 1열
  - 태블릿 (640px ~): 2열
  - 데스크톱 (768px ~): 3열
- **헤더**: sticky, 흰 배경, 하단 border, 높이 74px
- **헤더 아이콘/버튼**: `#555555` (돋보기, 로그인, 햄버거 3줄)

---

## 카드 구조 (4층)

```
┌─────────────────────────┐
│ 1층: 드립형 제목 (2줄, 가운데 정렬, 고정 높이) │
│ 2층: 1:1 영상/슬라이드/이미지                 │  ← 우선순위: video_url > image_urls(2장↑, 1초 자동슬라이드) > image_url
│ 3층: [♡]              [🔗]                  │  ← 왼쪽 하트(찜하기, 로그인 필요), 오른쪽 🔗 클릭 시 상세페이지 URL 복사
│ 4층: [구경하러 가기]                          │  ← 쿠팡/알리 링크 새 창 (button_text 커스터마이징 가능)
└─────────────────────────┘
```

> **카테고리 뱃지 제거됨** — 2026-05-29  
> **가격 표시 제거됨** — 2026-05-23 가격 기능 완전 삭제 (DB 컬럼 포함)

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
│   ├── layout.tsx            # 전체 레이아웃 (Header + main + Footer, AuthProvider + LikesProvider)
│   ├── page.tsx              # 메인 페이지 — Supabase에서 상품 목록 fetch
│   ├── globals.css           # 전역 스타일 (색상 변수 포함)
│   ├── mypage/
│   │   └── page.tsx          # 마이페이지 — 프로필(아바타/닉네임/이메일), 찜 목록, 로그아웃, 회원탈퇴
│   ├── admin/
│   │   ├── page.tsx          # 쿠키 확인 → LoginForm or AdminPanel
│   │   ├── actions.ts        # 로그인/로그아웃 서버 액션
│   │   ├── LoginForm.tsx     # 비밀번호 입력 화면 (클라이언트)
│   │   ├── AdminPanel.tsx    # 상품 CRUD 관리 패널 — 6개 탭 (상품목록/큐관리/순서편집/URL불러오기/URL파싱/통계) + R2 업로드
│   │   ├── QueueManager.tsx  # 큐 관리 탭 (is_queued 상품, 드래그 앤 드롭, 공개하기/전체공개)
│   │   ├── AliexpressSearch.tsx  # URL 불러오기 탭 (알리/쿠팡 플랫폼 탭, URL 입력 → 이미지 선택)
│   │   ├── UrlParser.tsx     # URL 파싱 탭 (쿠팡/아마존 URL → 이미지/상품명 추출, 봇 차단으로 제한적)
│   │   ├── OrderEditor.tsx   # 순서 편집 탭 (drag & drop, sort_order 저장, 🎬 영상/슬라이드 배지)
│   │   └── StatsPanel.tsx    # 통계 탭 (공개/큐/숨김 현황, 플랫폼 분포, 미디어 타입, GA 바로가기)
│   ├── api/
│   │   ├── upload/
│   │   │   └── route.ts      # R2 파일 업로드 (이미지/영상, admin_auth 쿠키 필요)
│   │   ├── delete-account/
│   │   │   └── route.ts      # 회원 탈퇴 (서비스 롤 클라이언트로 JWT 검증 + auth.admin.deleteUser)
│   │   ├── user/
│   │   │   ├── upload-avatar/
│   │   │   │   └── route.ts  # 프로필 사진 R2 업로드 (Bearer 토큰 인증, profiles/{user_id}.{ext})
│   │   │   └── delete/
│   │   │       └── route.ts  # 회원 탈퇴 구 경로 (delete-account로 대체됨)
│   │   ├── migrate-to-r2/
│   │   │   └── route.ts      # Supabase Storage → R2 일괄 마이그레이션 (maxDuration 300s)
│   │   ├── admin/
│   │   │   ├── products/
│   │   │   │   └── route.ts  # 어드민 상품 서버사이드 fetch (?type=all|queued|active, admin_auth 쿠키 인증)
│   │   │   └── refresh-ali-images/
│   │   │       └── route.ts  # 알리 이미지 고화질 일괄 교체 (스트리밍 NDJSON)
│   │   ├── aliexpress/
│   │   │   ├── search/
│   │   │   │   └── route.ts  # 알리 키워드 검색 (MD5 서명, KRW 변환, 최대 50개)
│   │   │   └── parse/
│   │   │       └── route.ts  # 알리 URL → 상품 ID 추출 → API 조회
│   │   └── parse-url/
│   │       └── route.ts      # 쿠팡/아마존 URL 파싱 (봇 차단으로 제한적)
│   ├── auth/
│   │   └── callback/
│   │       └── page.tsx      # OAuth 콜백 처리 (PKCE 교환 → 리다이렉트)
│   ├── search/
│   │   └── page.tsx          # 검색 결과 페이지 (`/search?q=키워드`, ilike 검색, 카드 그리드)
│   ├── unseen/
│   │   └── page.tsx          # 안 본 것만 보기 페이지 — viewed_products NOT IN 필터, 클라이언트 페이징(12개), 카드 뷰 추적(IntersectionObserver + 배치 upsert)
│   └── product/
│       └── [id]/
│           └── page.tsx      # 상품 상세 페이지 (공유 링크용, 영상 지원)
├── components/
│   ├── Header.tsx            # 상단 고정 헤더 (클라이언트 컴포넌트) — 로고(/public/2.png, 66px) + 돋보기(검색팝업) + EyeButton + HeaderAuthStatus + HamburgerMenu
│   ├── Footer.tsx            # 쿠팡파트너스 고지 문구 + 저작권
│   ├── EyeButton.tsx         # 안 본 것만 보기 토글 버튼 — ON(/unseen): 주황, OFF: 회색. 첫 클릭 시 설명 팝업, 비로그인 시 로그인 모달
│   ├── HeaderAuthStatus.tsx  # 비로그인: "로그인" 버튼 → 로그인 모달 / 로그인: 원형 아바타 → /mypage (이미지 오류 시 이니셜 폴백, loading 중 placeholder로 레이아웃 유지)
│   ├── ProductCard.tsx       # 4층 카드 컴포넌트 (제목→이미지→하트+공유→버튼)
│   ├── CardLikeButton.tsx    # 찜하기 버튼 (로그인 시 토글, 비로그인 시 로그인 모달)
│   ├── ImageSlider.tsx       # 이미지 슬라이더 (auto: IntersectionObserver 1초 자동, manual: 화살표)
│   ├── CardShareButton.tsx   # 카드 내 공유 버튼 (클라이언트)
│   ├── HamburgerMenu.tsx     # 우측 사이드 드로어 — About/Privacy/Contact 링크 + 로그인 시 마이페이지 + 로그아웃(드로어 맨 하단 고정)
│   └── ShareButton.tsx       # 상세 페이지 공유 버튼 (클라이언트)
├── context/
│   ├── AuthContext.tsx       # 인증 상태 전역 관리 (user, profile, profileLoaded, signOut, updateProfile)
│   └── LikesContext.tsx      # 찜 목록 전역 관리 (likedIds Set, toggleLike — 낙관적 업데이트)
├── lib/
│   ├── supabase.ts           # Supabase 브라우저 클라이언트 싱글톤
│   ├── supabase-admin.ts     # Supabase 서비스 롤 클라이언트 (서버 전용, getSupabaseAdmin())
│   └── r2.ts                 # Cloudflare R2 S3 클라이언트 (endpoint/bucket/publicUrl export)
├── chrome-extension/         # 크롬 확장 프로그램 "참아야하느니라 미디어툴" (Manifest V3)
│   ├── manifest.json         # MV3 설정 (host_permissions: aliexpress/alicdn, CSP: wasm-unsafe-eval)
│   ├── background.js         # 아이콘 클릭 → 새 탭 열기
│   ├── newtab.html           # 전체 화면 UI (슬라이드쇼 + 영상 자르기 + 포맷 변환 탭)
│   ├── newtab.css            # 스타일 (#F5A623 포인트, 크롭 오버레이, 포맷 변환 UI 포함)
│   ├── newtab.js             # 알리 이미지 fetch + 로컬 파일 업로드, ffmpeg.wasm 슬라이드쇼(H.264/yuv420p/1080×1080/이미지별 개별 간격), ffmpeg.wasm 영상 자르기 (크롭 비율 선택·CRF압축), GIF/WebP→MP4 포맷 변환
│   ├── ffmpeg.js             # @ffmpeg/ffmpeg UMD 번들 (로컬)
│   ├── ffmpeg-util.js        # @ffmpeg/util UMD 번들 (fetchFile, toBlobURL)
│   ├── 814.ffmpeg.js         # ffmpeg.wasm Worker 스크립트 (ffmpeg.js가 로드)
│   ├── ffmpeg-core.js        # @ffmpeg/core 112KB — Worker가 importScripts로 로드
│   └── ffmpeg-core.wasm      # @ffmpeg/core WASM 바이너리 31MB
└── sourcing-extension/       # 크롬 확장 프로그램 "참아야하느니라 소싱툴" (Manifest V3)
    ├── manifest.json         # MV3 설정 (side_panel, content_scripts: aliexpress/coupang)
    ├── background.js         # 아이콘 클릭 → 사이드패널 열기 (setPanelBehavior)
    ├── config.js             # 사용자 설정 (SITE_URL, ADMIN_KEY, Supabase 키)
    ├── db.js                 # IndexedDB 헬퍼 (dbGetAll/dbAdd/dbPut/dbDelete/dbReorder)
    ├── content.js            # 상품 페이지 자동 파싱 (제목/이미지 최대 12장/URL, 가격 없음)
    ├── sidepanel.html/css/js # 사이드패널 UI — 탭 이동 시 자동 파싱, 이미지 단일 선택, 직접 추가
    └── queue.html/css/js     # 큐 관리 페이지 — 드래그 정렬, 링크/이미지 인라인 편집, 공개/비공개 토글, 업로드
```

---

## 페이지별 동작

### 메인 페이지 (`/`)
- Supabase에서 `is_active = true` 상품을 최신순으로 fetch (서버 컴포넌트)
- `InfiniteProductGrid`로 렌더링 — 가상 스크롤 적용 (뷰포트 근처 행만 DOM에 유지)

### 상품 상세 페이지 (`/product/[id]`)
- **공유 링크 전용** — 카드에서 직접 진입 불가, 공유 버튼으로만 접근
- 상단: 해당 상품 크게 표시 (영상 또는 이미지 + 카테고리 + 제목 + 구경하러가기 버튼 + 공유 버튼)
- 하단: 다른 상품 그리드 ("이건 또 머고?" 섹션)
- OG 태그 포함 → 카톡/SNS 공유 시 미리보기 표시

### 마이페이지 (`/mypage`)
- 비로그인 접근 시 `/`로 자동 리다이렉트
- **프로필 섹션**: 아바타 사진(label 클릭 → 파일 선택 → R2 업로드 → profiles 테이블 저장), 닉네임 인라인 편집(최대 20자), 이메일 표시(수정 불가)
- **찜한 상품**: likes 테이블 기반, 3열 그리드, 하트 해제 시 즉시 사라짐
- **로그아웃**: 클릭 즉시 로컬 상태 초기화 → 메인 이동 (서버 세션 취소는 백그라운드)
- **회원 탈퇴**: 확인 팝업 → `/api/delete-account` → Supabase admin.deleteUser → 메인 이동
- 헤더 아바타 버튼 클릭 또는 햄버거 메뉴 "마이페이지" 링크로 진입

### 관리자 페이지 (`/admin`)
- 비밀번호: `ADMIN_PASSWORD` 환경변수 (현재 `egomeo1234`)
- 인증: HttpOnly 쿠키 기반, 30일 유지 (만료 시 401 반환 → 자동 로그아웃)
- **탭 1 — 상품 목록**: 등록/수정/삭제, 노출/숨김 토글, 미리보기 링크, 미디어 타입 표시
  - "☁️ Supabase → R2 마이그레이션" 버튼 (Supabase Storage URL → R2 URL 일괄 변환)
  - "🖼️ 알리 이미지 고화질 교체" 버튼 — platform=aliexpress이고 image_url이 R2 주소인 상품들의 이미지를 AliExpress API로 재조회 후 R2 재업로드 (스트리밍 진행 로그 표시, `/api/admin/refresh-ali-images`)
  - 큐에 저장된 상품은 제목 옆 "대기중" 배지 표시, 노출 컬럼에 "공개하기" 버튼으로 즉시 공개 가능
- **탭 2 — 큐 관리**: is_queued=true 상품들만 표시
  - 썸네일 카드 그리드 (플랫폼 배지 + 영상 배지 표시)
  - 드래그 앤 드롭으로 큐 순서 변경 + "순서 저장" 버튼
  - 카드별 체크박스로 개별 선택 + 선택 오버레이(주황 테두리+반투명)
  - "전체 선택" / "전체 해제" 버튼 + 선택 수 표시
  - "선택한 상품 공개하기" 버튼 → 체크된 상품만 공개
  - 개별 "공개하기" 버튼 → is_active=true, is_queued=false
  - "전체 공개" 버튼 → 큐 전체 한번에 공개
  - 탭 버튼에 큐 상품 수 배지 표시
- **탭 6 — 통계** (`StatsPanel.tsx`): 공개/큐/숨김 상품 수, 플랫폼별 분포(공개+큐 합산), 영상·슬라이드 수, GA 대시보드 바로가기
- **탭 3 — URL 불러오기** (`AliexpressSearch.tsx`):
  - 플랫폼 탭으로 알리익스프레스 / 쿠팡 전환
  - 알리: URL 입력 → `/api/aliexpress/parse` → 이미지 목록 표시
  - 쿠팡: URL 입력 → `/api/parse-url` → 이미지 목록 표시 (봇 차단 시 에러)
  - 좌우 분할 레이아웃 (왼쪽 URL 입력 / 오른쪽 이미지 선택 패널)
  - 이미지 선택 → "폼에 불러오기" → platform 자동 저장 (aliexpress/coupang)
  - 썸네일 hover 시 280px 확대 팝업, 알리 상품은 "원본 보기 ↗" 버튼
  - 키워드 검색/정렬/카테고리 필터 기능은 2026-05-28 제거됨
- **탭 4 — URL 파싱**:
  - 쿠팡/아마존 상품 URL 붙여넣기 → 이미지/상품명 자동 추출 (가격 제거됨)
  - **주의**: 쿠팡/아마존 모두 봇 차단(403/Cloudflare)으로 현재 제한적으로만 동작
- **탭 5 — 순서 편집**:
  - 드래그 앤 드롭으로 메인 피드 노출 순서 조정
  - `sort_order` 컬럼에 저장, 메인 피드는 sort_order ASC 정렬
  - 영상 상품은 썸네일 우상단에 🎬 배지 표시
  - 플랫폼 뱃지: `platform` 컬럼 값 기반 (amazon_us → 🇺🇸 아마존, amazon_jp → 🇯🇵 아마존JP, aliexpress → 알리, coupang → 쿠팡, etc → 기타, null → 표시 안 함)
- **상품 등록/수정 모달**:
  - 이미지 업로드 → R2 저장 (`/api/upload`)
  - 영상 업로드 (선택) → R2 저장, `video_url` 컬럼에 저장
  - **추가 이미지 (슬라이드용)**: URL 입력 또는 파일 직접 업로드(R2 저장)로 `image_urls` 배열 관리 (썸네일 미리보기, ↑↓ 순서변경, 🗑️ 삭제, URL 입력과 파일 업로드 혼용 가능)
  - 제휴 링크 입력 시 platform 자동 감지: 알리/쿠팡은 URL로 자동, 아마존(amazon.com/amzn.to/amazon.co.jp)은 지역 라디오 버튼 표시 (🇺🇸 미국 기본 / 🇯🇵 일본), Involve Asia(invl.me/invol.co)는 파트너 선택 드롭다운 표시 (현재: 클룩), 그 외 URL은 'etc' 자동 저장
  - Involve Asia 파트너는 `AdminPanel.tsx` 상단 `INVOLVE_ASIA_PARTNERS` 배열에 `{ value, label }` 추가하면 드롭다운에 자동 반영
  - URL 불러오기 탭에서 불러오면 platform 자동 설정 (aliexpress/coupang)
  - **공개 상태 라디오**: "바로 공개" (is_active=true, is_queued=false) / "큐에 저장" (is_active=false, is_queued=true) — **기본값: 큐에 저장**
  - **버튼 텍스트**: `button_text` 입력 필드 (비워두면 "구경하러 가기" 기본값)
  - 모달: X·취소 버튼으로만 닫기 (backdrop 클릭으로 닫히지 않음), 내부 스크롤(max-height 90vh)

---

## 최근 완료 작업 (2026-06-09 기준)

- **Eye 팝업 항상 표시 방식으로 변경** (`components/EyeButton.tsx`) — `localStorage unseen_explained` 플래그 제거. 로그인 상태에서 Eye 버튼 클릭 시 매번 팝업 표시(1회 체크 없음). 비로그인 클릭 시 로그인 모달. 팝업 문구 업데이트. `handleStart`/`handleClose`에서 localStorage 쓰기 코드 제거.
- **About 페이지 문구 수정** (`app/about/page.tsx`) — '세계 각지의' → '세상의'
- **Footer About 링크 통합** (`components/Footer.tsx`) — About 단독 링크 → 'About | Privacy Policy | Contact' 단일 텍스트 링크로 통합

- **어드민 모달 Involve Asia 플랫폼 지원 추가** (`app/admin/AdminPanel.tsx`, `QueueManager.tsx`, `OrderEditor.tsx`, `StatsPanel.tsx`) — affiliate_link에 `invl.me` 또는 `invol.co` 입력 시 "Involve Asia 파트너 선택" 드롭다운 자동 표시. 현재 파트너: 클룩(`klook`). `INVOLVE_ASIA_PARTNERS` 배열에 `{ value, label }` 추가만 하면 드롭다운+배지 자동 확장. 큐관리/순서편집/통계 탭 배지 함수를 if문 체인 → 레코드 맵(`PLATFORM_BADGE`, `PLATFORM_COLOR`)으로 리팩터링. 클룩은 🎫 보라색 배지.

- **미디어툴 영상 자르기 크롭 비율 선택 기능 추가** (`chrome-extension/newtab.html/css/js`) — 1:1 토글 버튼 → 5개 비율 선택 버튼으로 교체: 크롭 없음(기본값) / 1:1(정사각형) / 9:16(릴스·틱톡) / 16:9(유튜브) / 자유 크롭. 비율별 초기 박스를 중앙에 최대 크기로 자동 배치. SE 핸들 드래그 시 고정 비율은 대각 평균으로 비율 유지, 자유 크롭은 dx/dy 독립 조절. `cropBox`를 `sizeFrac` → `wFrac`+`hFrac`으로 분리, `buildCropFilter`가 비정사각형 `crop=W:H:X:Y` 생성.

- **미디어툴 슬라이드쇼 개별 간격 설정 추가** (`chrome-extension/newtab.js/css/html`) — 전체 간격 슬라이더 범위 0.5초~2.0초 → 0.5초~5.0초로 확장. 3단계 순서 조정 화면 각 썸네일 하단에 숫자 입력창(0.5~5초, step 0.5) 추가. 비워두면 전체 기본값 사용, 입력하면 해당 이미지에만 적용. 드래그 재정렬 후에도 개별 간격값이 이미지와 함께 이동.
- **미디어툴 슬라이드쇼 MP4 생성을 ffmpeg 인코딩으로 전환** (`chrome-extension/newtab.js`) — 기존 `MediaRecorder+captureStream` 방식 제거. 메타 광고 호환 스펙으로 교체: `libx264 / yuv420p / 1080×1080 / -an / -movflags +faststart`. 각 이미지를 canvas로 1080×1080 PNG 변환 후 ffmpeg 가상 FS 기록, `concat.txt`로 이미지별 개별 간격 반영. 마지막 프레임 중복으로 concat demuxer duration 버그 우회. 영상 자르기 탭의 ffmpeg 인스턴스 공유.

- **메인 피드 가상 스크롤 적용** (`components/InfiniteProductGrid.tsx`) — `@tanstack/react-virtual` v3 `useWindowVirtualizer` 사용. 카드 3개를 1행으로 묶어 행 단위 가상화, 뷰포트 위아래 5행(overscan=5)만 실제 DOM 유지, 나머지는 빈 공간. `measureElement`로 실제 카드 높이 자동 측정, `scrollMargin`으로 헤더 오프셋 보정. 반응형 열 수 JS 감지 (`useColumnCount`: <640px=1열, 640~767px=2열, 768px+=3열). 무한 스크롤 센티넬 방식 유지. 500개+ 카드 DOM 누적으로 인한 영상 카드 메모리 누수 문제 해결.
- **Supabase RLS 전체 테이블 적용** (2026-06-07) — 4개 테이블 모두 RLS 활성화 완료:
  - `products`: SELECT는 `is_active=true`만 공개, 쓰기 정책 없음(클라이언트 쓰기 차단). service_role(어드민 API)은 RLS 우회로 영향 없음. `/product/[id]` 비활성 상품 직접 접근 시 404 처리됨(의도적)
  - `likes` / `profiles` / `viewed_products`: `auth.uid() = user_id(또는 id)` 정책 재정의 (정책명 통일: `테이블명_동작_own`)
- **Pinterest 도메인 인증 메타태그 추가** — `app/layout.tsx`에 Pinterest 소유 확인 메타태그 추가
- **큐 관리 탭 공개하기 버튼 API 라우트 전환** (`QueueManager.tsx`) — `supabase` 브라우저 클라이언트 직접 호출로 인한 무반응 버그 수정. 4개 함수 모두 `/api/admin/products` 경유로 전환 (`publishOne` → PUT, `handleSaveOrder` → PATCH, `handlePublishSelected` → PUT 반복, `handlePublishAll` → PUT 반복)
- **헤더 프로필 아이콘 간헐적 사라짐 수정** — 두 가지 원인 동시 해결:
  - `AuthContext.tsx`: Supabase가 SIGNED_OUT 아닌데 null session을 일시적으로 내보낼 때 `setUser(null)` 호출 방지 (`if (!u && event !== "SIGNED_OUT") return` guard 추가)
  - `HeaderAuthStatus.tsx`: `loading=true`일 때 `return null` 대신 동일 크기 placeholder(`<div className="w-7 h-7 rounded-full bg-gray-100" />`) 반환으로 헤더 레이아웃 흔들림 방지
- **"안 본 것만 보기" 기능 추가** (`/unseen`) — 로그인 사용자 전용, 전체 구현:
  - `viewed_products` Supabase 테이블 — RLS 활성화, `UNIQUE(user_id, product_id)` 제약
  - `components/EyeButton.tsx` — 헤더 Eye 토글 아이콘. 로그인 시 클릭마다 설명 팝업 표시(localStorage 플래그 없음), 비로그인 시 로그인 모달, ON(주황·/unseen)/OFF(회색) 상태 전환
  - `app/unseen/page.tsx` — viewed_products NOT IN 필터로 안 본 상품 전체 로드 → `displayCount/STEP=12` 클라이언트 페이징 + 하단 센티넬 IntersectionObserver. 카드별 뷰 추적: viewport 진입 → `seenRef.add()`, 상단 이탈 → `scheduleViewed()` (2초 디바운스, 10개마다 즉시 flush, unmount/unload 시 flush)
- **어드민 전체 DB 쓰기 작업을 API 라우트 경유로 전환** (2026-06-05, 참고용):
  - `AdminPanel`, `OrderEditor` 모두 API 라우트 경유로 전환, `import { supabase }` 완전 제거
  - `PATCH /api/admin/products` 배치 업데이트 + 진행률 표시
- **About 페이지 통합** — `/privacy`, `/contact` 페이지를 `redirect("/about")`로 교체. `/about` 페이지에 Privacy Policy + Contact 섹션 통합, 로고 이미지(`/public/2.png`) 제목 위에 추가
- **푸터 개편** (`components/Footer.tsx`) — 제휴 마케팅 문구 제거, SNS 아이콘 5개(X·인스타그램·쓰레드·페이스북·핀터레스트) 추가 (인라인 SVG, `#555555` → 호버 `#F5A623`), Privacy Policy·Contact 링크 제거 → About 하나만 유지
- **햄버거 메뉴 링크 정리** (`components/HamburgerMenu.tsx`) — Privacy Policy·Contact 항목 제거, About만 유지

---

## 어필리에이트 현황 (2026-06-03 기준)

| 플랫폼 | 상태 | 비고 |
|---|---|---|
| 쿠팡파트너스 | 가입 신청 중 / 예정 | 링크 발급 후 즉시 적용 가능. 소싱툴에서는 수동 입력 방식으로 처리 예정 |
| 알리익스프레스 | **API 연동 완료** | APP_KEY/SECRET/TRACKING_ID Vercel 등록 완료. 소싱툴 큐 추가 시 `link.generate`로 자동 변환 |
| 아마존 어소시에이트 | **어소시에이트 유지** | 쇼핑몰 계정 영구 잠금 (계정 정보 불일치). 어소시에이트 대시보드는 유지 중. JP 상품 100개 기존 링크/이미지 영향 없음 |
| Involve Asia | **사이트 승인 완료** | 2026-06-03 승인. 다양한 해외 어필리에이트 네트워크 접근 가능 |
| 클룩 (Klook Travel - CPS) | **심사 대기 중** | Involve Asia 통해 2026-06-03 신청. 최대 2영업일 소요 예정 |
| Rakuten Advertising | **재시도 필요** | 계정 생성 시도 시 서버 타임아웃 발생. 나중에 재시도. 엣시 입점 목적 |
| 엣시 | **대기 중** | Rakuten 계정 생성 완료 후 신청 예정 |

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
- [완료] 크롬 확장 프로그램 "참아야하느니라 미디어툴" 제작 (`chrome-extension/` 폴더, Manifest V3)
  - 슬라이드쇼 만들기 탭: 알리 URL 입력 → 이미지 선택(체크박스) → 드래그 순서 조정 → 간격 설정(0.5~5초) → 이미지별 개별 간격 입력 → ffmpeg.wasm으로 메타 광고 호환 MP4 생성(H.264/yuv420p/1080×1080) + 다운로드
  - 영상 자르기 탭: **ffmpeg.wasm 기반** (libx264 CRF 압축 + 해상도 제한 + 오디오 제거 + 크롭 오버레이)
    - 품질: 고(CRF 26·1080p) / 중간(CRF 30·720p, 권장) / 저(CRF 34·480p), ultrafast preset, `-an`
    - 크롭 비율 선택: 크롭 없음(기본) / 1:1(정사각형) / 9:16(릴스·틱톡) / 16:9(유튜브) / 자유 크롭
    - 드래그 이동·SE핸들 리사이즈, 분율 좌표 관리(창 리사이즈 안전), 고정 비율은 대각 평균으로 비율 유지, `crop=W:H:X:Y,scale` 순서
    - 로컬 번들: ffmpeg.js·ffmpeg-util.js·814.ffmpeg.js(Worker)·ffmpeg-core.js(112KB)·ffmpeg-core.wasm(31MB)
    - 로드: `chrome.runtime.getURL("ffmpeg-core.js")` 직접 전달 → Worker `importScripts`가 CSP `'self'`로 허용
  - host_permissions으로 aliexpress.com/alicdn.com CORS 없이 직접 fetch
- [완료] 크롬 확장 프로그램 "참아야하느니라 소싱툴" 제작 (`sourcing-extension/` 폴더, Manifest V3)
  - Chrome Side Panel 방식: 탭 이동해도 닫히지 않음, `chrome.tabs.onActivated/onUpdated`로 자동 재파싱
  - content.js: 알리/쿠팡 상품 페이지 자동 파싱 (제목/이미지 최대 12장/URL)
  - 이미지 단일 선택 그리드 (클릭 시 1장만 선택, 주황 테두리+대표 배지, 파일 드롭존/URL 직접 추가)
  - IndexedDB 큐: 드래그 정렬, 인라인 수정, 체크박스 선택 일괄 업로드/삭제
  - 큐 업로드: 이미지 → `/api/extension/proxy-image` → R2, 영상 → presigned URL → R2, Supabase insert
  - 알리 어필리에이트 링크 자동 변환: `link.generate` API 사용 (상품 ID 보존 보장, `product_id` 검증 추가)
  - `/api/upload` + `/api/extension/proxy-image` 모두 `X-Admin-Key` 헤더 인증 지원
- [완료] 관리자 순서 편집 탭 (`OrderEditor.tsx`) — 드래그 앤 드롭으로 메인 피드 순서 조정, `sort_order` 저장, 🎬 영상 배지
- [완료] 가격(price) 기능 완전 제거 — `ALTER TABLE products DROP COLUMN price` 실행, 전체 코드에서 제거
- [완료] 소싱툴 이미지 단일 선택으로 변경 — 어차피 1장만 R2에 저장되므로 UI 단순화
- [완료] 소싱툴 큐 카드 링크 인라인 편집 (클릭 시 수정 가능, blur 시 자동 저장)
- [완료] 소싱툴 큐 카드 이미지 변경 (URL 입력 or 파일 업로드, 모달 방식)
- [완료] 소싱툴 큐 공개/비공개 토글 — 업로드 시 `is_active` 컬럼에 반영 (기본값: 공개)
- [완료] 메인 피드 반응형 3열 레이아웃 (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3`)
- [완료] `products` 테이블에 `sort_order` 컬럼 추가 (integer, nullable, 낮을수록 앞에 표시)
- [완료] `products` 테이블에 `platform` 컬럼 추가 (text, nullable — 'amazon_us'|'amazon_jp'|'aliexpress'|'coupang'|null)
- [완료] 순서 편집 탭 플랫폼 뱃지: URL 자동판별 → platform 컬럼 값 기반으로 변경
- [완료] 관리자 모달 플랫폼 처리: 아마존 URL 감지 시 지역 라디오(🇺🇸 미국/🇯🇵 일본), 알리/쿠팡은 URL 자동판별로 platform 저장
- [완료] igemugo.com 도메인 구입 (Cloudflare Registrar) + Vercel 커스텀 도메인 연결 (www.igemugo.com)
- [완료] sitemap.xml 동적 생성 (`app/sitemap.ts`) — `is_active = true` 상품 전체 포함, 메인 페이지 포함
- [완료] 구글 서치 콘솔 등록 + 사이트맵 제출
- [완료] 네이버 서치어드바이저 등록 (소유 확인 메타태그: `naver-site-verification`)
- [완료] 빙 웹마스터 등록 (사이트맵은 DNS 전파 완료 후 제출 필요)
- [완료] 얀덱스 웹마스터 등록 + 사이트맵 제출 (소유 확인 메타태그: `yandex-verification`)
- [완료] 바이두 — 중국 전화번호 필요로 패스
- [완료] platform `'etc'` 추가 — 알리/쿠팡/아마존 외 URL 입력 시 자동으로 `platform = 'etc'` 저장, 순서 편집 탭에 '기타' 뱃지 표시
- [완료] 어드민 모달 backdrop 클릭 닫힘 방지 — X 버튼·취소 버튼으로만 닫기 (실수 입력 방지)
- [완료] 알리 이미지 `upgradeAliRes` 강화 — `_.avif` 포맷 변환 접미사 포함 3단계 정규식으로 모든 크기/품질 파라미터 제거 (content.js + refresh-ali-images API 동일 적용)
- [완료] 알리 이미지 일괄 고화질 교체 (`/api/admin/refresh-ali-images`) — AliExpress API 재조회 → R2 재업로드 → DB 업데이트, 스트리밍 NDJSON 진행 로그
- [완료] 소싱툴 이미지 URL 복사 버튼 — `type='url'` 이미지 호버 시 우상단 "URL" 버튼, 클릭 시 클립보드 복사 후 "✓" 피드백
- [완료] 스크롤 북마크 확장 UX 개선 — '여기까지 봤다' 덮어쓰기 확인 팝업, 이동 버튼 비활성화 시 🔄 새로고침 버튼 자동 표시
- [완료] 상품 463개 등록 완료
- [완료] About 페이지 (`app/about/page.tsx`) — 운영자/문의 정보 + Privacy Policy + Contact 통합. 로고 이미지 상단 추가
- [완료] Privacy Policy 페이지 (`app/privacy/page.tsx`) — `/about`으로 redirect
- [완료] Contact 페이지 (`app/contact/page.tsx`) — `/about`으로 redirect
- [완료] Footer 개편 (`components/Footer.tsx`) — SNS 아이콘 5개(X·인스타·쓰레드·페이스북·핀터레스트) 추가, About 링크만 유지, 제휴 마케팅 문구 제거
- [완료] 헤더 우측 햄버거 메뉴 추가 (`components/HamburgerMenu.tsx`) — 클릭 시 우측 사이드 드로어, About 링크 + 마이페이지 + 로그아웃(절대 하단), 페이지 이동 시 자동 닫힘
- [완료] 순서 편집 탭 "정렬 최적화" 기능 추가 (`OrderEditor.tsx`) — sort_order 범위 지정 후 플랫폼 분산+영상 4칸 간격 그리디 알고리즘으로 자동 재배치, 미리보기(변경 전/후 나란히) 후 적용, 규칙 충족 불가 시 경고 표시
- [완료] hello@igemugo.com 이메일 설정 (Cloudflare Email Routing → Gmail 포워딩)
- [완료] 어드민 상품 목록 sort_order 기준 정렬 + 순서 번호 표기 + 제목 검색 기능
- [완료] 사이트 검색 페이지 추가 (`app/search/page.tsx`) — `/search?q=키워드`, ilike 검색, 카드 그리드
- [완료] 햄버거 메뉴에 사이트 검색창 추가
- [완료] 헤더 우측 햄버거 메뉴 (`components/HamburgerMenu.tsx`) — 사이드 드로어, 사이트 검색, 페이지 이동 시 자동 닫힘
- [완료] 어드민 큐(임시저장) 기능 추가
  - `products` 테이블에 `is_queued` 컬럼 추가 (boolean, default false)
  - 상품 추가/수정 모달에 "공개 상태" 라디오 버튼 ("바로 공개" / "큐에 저장", 기본값: 큐에 저장)
  - 어드민 "큐 관리" 탭 추가 (`QueueManager.tsx`) — 카드 그리드, 드래그 앤 드롭 순서 변경, 개별 "공개하기", "전체 공개" 버튼, 탭에 큐 상품 수 배지
  - 상품 목록에서 큐 상품 "대기중" 배지 표시 + "공개하기" 버튼으로 즉시 공개
- [완료] 큐 관리 탭 개별 선택 공개 — 카드 체크박스, 전체 선택/해제, 선택한 상품 공개하기
- [완료] `products` 테이블에 `image_urls` 컬럼 추가 (text[], nullable) — `ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls text[];`
- [완료] `ImageSlider` 컴포넌트 신규 생성 (`components/ImageSlider.tsx`) — auto 모드(IntersectionObserver 1초 자동슬라이드, 이탈 시 첫 장 리셋) / manual 모드(화살표+dots)
- [완료] ProductCard `image_urls` 슬라이드 지원 — 우선순위: video_url > image_urls(2장↑ auto슬라이드) > image_url
- [완료] 상세 페이지 `image_urls` auto 슬라이드 지원
- [완료] 어드민 모달 "추가 이미지 (슬라이드용)" 섹션 — URL 입력/추가, 썸네일 미리보기, ↑↓ 순서변경, 🗑️ 삭제, image_urls 컬럼 저장
- [완료] 큐 관리·순서 편집 탭 썸네일 image_urls 대응 — 이미지 우선순위(image_url → image_urls[0] → 빈박스), image_urls 2장↑ 상품 🎬 배지 표시
- [완료] 소싱툴 쿠팡 이미지 Referer 차단 우회 — content.js `parseCoupangImages()` 개선: 로드된 img 요소를 canvas.drawImage() → toDataURL()로 base64 변환, canvas taint 시 원본 URL 폴백
- [완료] 어드민 탭 이름 변경: "알리익스프레스 검색" → "URL 불러오기"
- [완료] 어드민 URL 불러오기 탭 개편 (`AliexpressSearch.tsx`) — 키워드 검색/정렬/카테고리 전체 제거, 알리/쿠팡 플랫폼 탭 추가, 쿠팡은 기존 `/api/parse-url` 재활용, platform 자동 저장
- [완료] `products` 테이블에 `button_text` 컬럼 추가 — 카드 버튼 텍스트 커스터마이징 (`ALTER TABLE products ADD COLUMN IF NOT EXISTS button_text text;`)
- [완료] 전체 포인트 색상 변경 — `#FF5A00` → `#F5A623`, 호버색 `#e04e00` → `#d8921f` (23개 파일 일괄 적용)
- [완료] 메인 카드 구조 변경 — 카테고리 뱃지 제거, 5층 → 4층 (제목→이미지→하트+공유→버튼 순)
- [완료] 카드 제목 스타일 개선 — 가운데 정렬, 최대 2줄 말줄임, 고정 높이(`h-[3.5rem]`)로 카드 균일화
- [완료] 카드 하트 아이콘(♡) 추가 → 찜하기 기능 완전 연결 (로그인 토글, 비로그인 시 로그인 모달)
- [완료] 사이트명 전체 변경 — "참아야하느니라" → "이게머고?" (헤더/푸터/메타/어드민 전체)
- [완료] 헤더 로고 이미지 교체 — `/public/2.png` (66px, 뷰포트 왼쪽 끝)
- [완료] 헤더 전면 개편 — 카테고리 제거, 돋보기 검색팝업, 로그인버튼/아바타, 햄버거 단순화 (`Header.tsx` 클라이언트 컴포넌트 전환)
- [완료] `HeaderAuthStatus` — 비로그인 "로그인" 버튼, 로그인 아바타, 이미지 오류 이니셜 폴백
- [완료] `HamburgerMenu` — 검색창 제거, About + 마이페이지 + 로그아웃(절대 하단) 구조
- [완료] `/api/admin/products` 신규 생성 — 어드민 데이터 fetch 서버사이드 전환 (`?type=all|queued|active`)
- [완료] `AdminPanel`, `QueueManager`, `OrderEditor` fetch → API 라우트 경유 (브라우저→Supabase 직접 연결 타임아웃 문제 해결)
- [완료] 어드민 전체 DB 쓰기 작업 API 라우트 전환 — `PATCH`(배치 순서 업데이트) / `POST`(등록) / `PUT`(수정·토글) / `DELETE`(삭제) 핸들러 추가, `AdminPanel`·`OrderEditor`에서 `supabase` 브라우저 클라이언트 직접 호출 완전 제거
- [완료] 정렬 최적화 적용 배치 처리 + 진행률 표시 — 50개씩 순차 처리, `적용 중... N/전체` 실시간 표시
- [완료] Google Analytics 연동 (`G-6P979RX187`, `NEXT_PUBLIC_GA_ID`, `next/script afterInteractive`)
- [완료] 어드민 통계 탭 (`StatsPanel.tsx`) — 공개/큐/숨김, 플랫폼 분포, 미디어 타입, GA 바로가기
- [완료] 미디어툴 영상 자르기 크롭 비율 선택 — 크롭 없음/1:1/9:16/16:9/자유 크롭 버튼, 비율 유지 리사이즈, 비정사각형 crop 필터 생성
- [완료] 어드민 모달 Involve Asia 플랫폼 지원 — invl.me/invol.co 감지 시 파트너 드롭다운, klook 🎫 배지, INVOLVE_ASIA_PARTNERS 배열로 파트너 관리
- [완료] Eye 팝업 항상 표시 방식으로 변경 (`EyeButton.tsx`) — localStorage 플래그 제거, 로그인 시 클릭마다 팝업 표시
- [완료] About 페이지 문구 수정 + Footer About 링크 'About | Privacy Policy | Contact' 단일 링크로 통합
- [완료] 미디어툴 영상 자르기 ffmpeg.wasm 전환, 1:1 크롭 오버레이, 로컬 번들, 압축 튜닝, 포맷 변환 탭
- [완료] 미디어툴 슬라이드쇼 개별 간격 설정 — 전체 슬라이더 0.5~5초 확장, 썸네일별 개별 초 입력, 재정렬 후에도 간격값 유지
- [완료] 미디어툴 슬라이드쇼 MP4 생성 ffmpeg 전환 — 메타 광고 호환 스펙(H.264/yuv420p/1080×1080/-an), concat demuxer, MediaRecorder 방식 제거
- [완료] 어드민 쿠키 만료 시 401 처리 + 유효기간 30일로 연장
- [완료] 메인 피드 카드 이미지·영상 `object-fit: contain` + 흰색 배경으로 변경
- [완료] 소셜 로그인 구현 — 구글/카카오 (Supabase Auth OAuth, `/auth/callback` PKCE 처리)
- [완료] 찜하기 기능 구현 — `likes` 테이블(RLS), `LikesContext`(전역+낙관적 업데이트), `CardLikeButton` DB 연결
- [완료] 마이페이지 구현 (`/mypage`) — 프로필 사진/닉네임 편집, 찜 목록, 로그아웃, 회원 탈퇴
- [완료] `profiles` 테이블 도입 — 닉네임/아바타 분리 저장, OAuth 재로그인 덮어쓰기 방지
- [완료] `lib/supabase-admin.ts` 생성 — 서비스 롤 클라이언트 (`getSupabaseAdmin()`)
- [완료] `AuthContext` 전면 개편 — profile 상태, updateProfile, fetchProfile 방어 처리, TOKEN_REFRESHED 스킵, getSession 제거, signOut 즉시 초기화
- [완료] `HeaderAuthStatus` 컴포넌트 추가 — 로그인 시 아바타 버튼, profiles 테이블 기반 아바타/이니셜
- [완료] Pinterest 도메인 인증 메타태그 추가 (`app/layout.tsx`)
- [완료] 큐 관리 탭 공개하기 버튼 API 라우트 전환 (`QueueManager.tsx`) — `supabase` 브라우저 클라이언트 직접 호출 제거, `/api/admin/products` PUT/PATCH 경유로 전환
- [완료] 헤더 프로필 아이콘 간헐적 사라짐 수정 — `AuthContext` null session guard 추가 + `HeaderAuthStatus` loading 중 placeholder로 레이아웃 유지
- [완료] "안 본 것만 보기" 기능 추가 — `viewed_products` 테이블(RLS), `EyeButton` 헤더 토글 아이콘, `/unseen` 페이지 (NOT IN 필터, 클라이언트 페이징, 카드 뷰 배치 upsert 추적)
- [완료] 메인 피드 가상 스크롤 적용 (`InfiniteProductGrid.tsx`) — `@tanstack/react-virtual` v3, `useWindowVirtualizer`, 행 단위 가상화(overscan=5), measureElement, scrollMargin, 반응형 열 수 JS 감지
- [완료] Supabase RLS 전체 적용 — products(is_active=true SELECT 공개·쓰기차단), likes/profiles/viewed_products(auth.uid() 정책 재정의)

---

## 다음 할 일 (우선순위순)

1. **AI 드립 제목 생성** — 알리 검색 후 원본 상품명 기반으로 Claude API 호출해 드립형 제목 자동 생성
2. **소싱툴 쿠팡 링크 처리** — 쿠팡파트너스 가입 완료 후, 소싱툴에서 쿠팡 상품 URL을 파트너스 링크로 수동 입력하는 UI 추가
3. **크롬 확장 슬라이드쇼 이미지 추출 개선** — 알리 페이지가 JS 렌더링 전용이면 정적 HTML에서 이미지 못 찾는 문제 해결 필요 (content script 방식 검토)
4. **쿠팡 URL 파싱 개선** — 현재 봇 차단으로 제한적. Puppeteer/플레이라이트 서버리스 또는 별도 파싱 서비스 검토 필요 (아마존은 보류)
5. **알리 트래킹 ID 교체** — 포털에서 전용 ID 생성 후 `ALIEXPRESS_TRACKING_ID` 환경변수 교체 + `sourcing-extension/config.js`도 동일하게 업데이트
6. **네이버 소셜 로그인** — 구글/카카오는 완료. 네이버는 미구현

---

## 주요 설계 결정사항

| 결정 | 이유 |
|---|---|
| 상세페이지는 공유 링크로만 접근 | 카드에서 상세페이지로 직접 이동하면 SEO 낭비, 공유 바이럴에 집중 |
| 가격 기능 제거 | 플랫폼마다 가격 형식이 달라 통일 불가, 실시간성도 없어 오히려 오해 유발. 링크로 직접 확인하는 게 나음 |
| 이미지 단일 선택 (소싱툴) | R2에는 실제로 1장만 업로드됨. UI를 실제 동작과 일치시켜 혼란 방지 |
| sort_order로 메인 피드 순서 관리 | created_at 역순 대신 수동 정렬 지원. null이면 맨 뒤에 위치 |
| products RLS SELECT를 `is_active=true`로 제한 | anon key로 비활성 상품 직접 조회 차단. 클라이언트 코드에 이미 is_active 필터가 있지만 RLS로 DB 레벨에서도 이중 보호 |
| products 쓰기 정책 없음 (서버만 허용) | 클라이언트 쓰기 완전 차단. 어드민 API는 service_role key로 RLS 우회하므로 기능 영향 없음 |
| 관리자 인증을 쿠키+환경변수로 | Supabase Auth 없이 빠르게 구현. 나중에 Supabase Admin 역할로 교체 가능 |
| 이미지/영상을 Cloudflare R2에 저장 | Supabase Storage 대비 대용량 파일 비용 유리, 글로벌 CDN, 영상 스트리밍 적합 |
| R2 업로드를 서버 API 경유 | 브라우저에서 직접 R2에 올리면 시크릿 키 노출 위험. `/api/upload`가 admin 쿠키 검증 후 처리 |
| 서버 컴포넌트로 데이터 fetch | SEO와 초기 로딩 속도 최적화 |
| 소싱툴을 팝업 대신 Side Panel로 | 팝업은 외부 클릭 시 닫힘. 사이드패널은 고정되어 탭 이동하면서 계속 쓸 수 있음 |
| 어필리에이트 변환에 `link.generate` 사용 | `product.query` 등 검색 계열 API는 다른 상품을 반환할 수 있음. `link.generate`는 원본 URL을 그대로 변환해 product_id가 절대 바뀌지 않음 |
| 소싱툴 확장에서 X-Admin-Key 헤더 인증 | 확장에서는 HttpOnly 쿠키 접근 불가. X-Admin-Key 헤더로 동일한 ADMIN_PASSWORD 값 검증 |
| 아마존 지역만 수동 선택, 나머지는 URL 자동판별 | 알리/쿠팡은 URL 패턴이 명확해 자동 감지 가능. 아마존만 amzn.to 단축 URL 사용 시 JP/US 구분 불가능해 라디오로 명시 선택 |
| **아마존 이미지는 R2 저장 절대 금지** | 아마존 이미지는 저작권 문제로 R2에 업로드하지 않음. 관리자 모달에서 이미지 URL 직접 입력 방식만 사용. PA API 승인 받은 이후에도 동일 원칙 유지 |
| 닉네임/아바타를 profiles 테이블에 저장 | OAuth 재로그인 시 `user_metadata`가 구글/카카오 프로필로 덮어써짐. profiles 테이블을 소스 오브 트루스로 사용하고 user_metadata는 폴백으로만 사용 |
| 서버사이드 JWT 검증에 서비스 롤 클라이언트 사용 | `lib/supabase.ts`의 브라우저 클라이언트를 API Route(Node.js)에서 `getUser(jwt)` 호출하면 실패. `getSupabaseAdmin()`(서비스 롤)을 사용해야 정상 동작 |
| `onAuthStateChange`만 사용, `getSession()` 제거 | 둘 다 쓰면 INITIAL_SESSION 이벤트와 getSession()이 fetchProfile을 동시 호출해 경쟁 조건 발생. onAuthStateChange의 INITIAL_SESSION 하나로 통일 |
| TOKEN_REFRESHED 이벤트 시 profiles 재조회 스킵 | 토큰 갱신은 프로필 변경과 무관. 재조회하면 DB 지연 시 profileLoaded=false에 오래 갇히고 optimistic update가 덮어씌워짐 |
| signOut() 즉시 로컬 상태 초기화 | `supabase.auth.signOut()` 완료를 기다리면 반응이 느리거나 onAuthStateChange 타이밍에 따라 profileLoaded가 false에 갇힐 수 있음. 상태 초기화는 동기적으로, 서버 세션 취소는 백그라운드 |
| 어드민 모든 DB 작업을 API 라우트 경유 | 브라우저→Supabase 직접 연결이 특정 네트워크 환경에서 타임아웃 발생. 읽기(GET)뿐 아니라 쓰기(POST/PUT/PATCH/DELETE)도 모두 `/api/admin/products`로 중계. `AdminPanel`·`OrderEditor`에서 `supabase` 브라우저 클라이언트 import 완전 제거 |

---

## 작업 방식 (중요 — 반드시 지킬 것)

- **사용자는 개발 경험이 없는 완전 초보**
- 단계별로 확인하면서 진행할 것 — 한 번에 너무 많이 바꾸지 말 것
- 각 단계마다 뭘 했는지 한국어로 설명할 것
- 에러 나면 혼자 못 고치니 우회 방법 먼저 제시할 것
- **모든 대화는 한국어로**
- 작업 완료 후에는 반드시 `npm run build`로 빌드 검증 후 push
- push는 항상 `git add → git commit → git push` 순서
