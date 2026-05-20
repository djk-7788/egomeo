# 이게머고? 프로젝트 — 작업 인수인계 문서

새 채팅창에서 처음 보는 사람도 바로 이어서 작업할 수 있도록 작성됨.

---

## 프로젝트 개요

- **사이트명**: 이게머고?
- **성격**: 신기하고 별난 물건 큐레이션 사이트 (thisiswhyimbroke.com 벤치마크)
- **타겟**: 20~40대, 밈 친화적, 얼리어답터
- **톤**: 힙하고 위트있는 긱 스페이스, 촌철살인 드립
- **수익모델**: 쿠팡파트너스 + 알리익스프레스 어필리에이트 링크

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
```

### Vercel — 대시보드에서 직접 설정됨
위 3개 환경변수 모두 Vercel Settings > Environment Variables에 등록 완료.

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
│   │   └── AdminPanel.tsx    # 상품 CRUD 관리 패널 (클라이언트)
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
- 기능: 상품 등록/수정/삭제, 노출/숨김 토글, 미리보기 링크
- 이미지: 파일 업로드 → Supabase Storage 자동 저장

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

---

## 다음 할 일 (우선순위순)

1. **무한 스크롤** — 메인 페이지 상품 목록 페이지네이션 (현재 전체 로드)
2. **카테고리 필터** — 헤더 네비 클릭 시 해당 카테고리만 표시 (URL 쿼리 파라미터 방식)
3. **소셜 로그인** — Supabase Auth (구글/카카오/네이버)
4. **찜하기** — 하트 버튼, 마이페이지
5. **쿠팡/알리 API 연동** — 나중 단계

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
