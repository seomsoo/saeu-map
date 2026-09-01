# Phase 0 — 스캐폴드 · 하네스

## Context
새우맵 프로젝트의 첫 단계. 빈 git repo에 docs/와 mock 데이터만 있는 상태에서 Next.js App Router 프로젝트를 스캐폴드하고, 개발 하네스(린트·타입체크·테스트·CI·Claude 훅)를 세팅한다. 완료 조건: 네이버 지도에 50개 핀이 뜨는 페이지가 로컬에서 동작하고, `pnpm typecheck && pnpm lint && pnpm test` 통과.

## 제약
- 현재 폴더에 직접 스캐폴드 (하위 폴더 X)
- 이미 존재: docs/, lib/mock/*.json, scripts/, CLAUDE.md, AGENTS.md, .git
- Supabase 코드 금지 (목 단계)
- next/image 최적화 끔 (unoptimized)
- Pretendard self-host (Google Fonts X)
- coolicons = Iconify `ci` 세트 (@iconify/react)

## 주요 의존성
| 패키지 | 버전 | 용도 |
|--------|------|------|
| next | 16.3.3 | 프레임워크 |
| react, react-dom | 19.2.8 | UI |
| typescript | 7.0.2 | 타입 |
| @tsconfig/strictest | 2.0.8 | strict 프리셋 |
| tailwindcss | 4.3.3 | 스타일 (v4) |
| @tailwindcss/postcss | latest | PostCSS 플러그인 |
| pretendard | 1.3.9 | 폰트 (woff2 추출 → public/fonts/) |
| @iconify/react | 6.0.2 | coolicons (ci) |
| react-naver-maps | 0.2.2 | 네이버 지도 (decisions.md 결정) |
| @types/navermaps | 3.9.2 | 지도 타입 |
| @t3-oss/env-nextjs | 0.13.11 | 타입 안전 환경변수 |
| zod | 4.x | 스키마 검증 |
| react-hook-form | 7.87.0 | 폼 (설치만, Phase 2+) |
| @hookform/resolvers | 5.9.1 | zod 연동 |
| class-variance-authority | 0.7.1 | cva 컴포넌트 변형 |
| eslint | 10.x | 린트 |
| @typescript-eslint/* | 8.69.0 | TS 린트 |
| eslint-plugin-jsx-a11y | 6.x | 접근성 |
| eslint-plugin-boundaries | 7.x | 의존 방향 강제 |
| vitest, @testing-library/react, jsdom | latest | 테스트 |
| @b12k/gitleaks | 8.30.x | 시크릿 스캔 (npm 래퍼) |

**참고**: 디렉토리에 기존 파일(docs/, lib/, .git)이 있으므로 `create-next-app`은 사용 불가. 수동 스캐폴드.

## 파일 구조 (생성/수정 대상)

```
saeu-map/
├── app/
│   ├── layout.tsx              # Pretendard + metadata
│   ├── page.tsx                # 메인: 풀스크린 지도 + 마커
│   └── globals.css             # @import "tailwindcss" + CSS 변수 토큰
├── components/
│   └── map/
│       ├── naver-map-provider.tsx  # NavermapsProvider 래퍼 (client)
│       └── map-with-markers.tsx    # Container + NaverMap + 마커 렌더 (client)
├── lib/
│   ├── types.ts                # Place, Checkin, Review 타입
│   ├── data.ts                 # getPlaces, getCheckins, getReviews 등
│   ├── env.ts                  # t3-env (NEXT_PUBLIC_NCP_CLIENT_ID)
│   └── mock/                   # (기존 유지)
├── public/
│   └── fonts/                  # Pretendard woff2 (variable)
├── .claude/
│   ├── settings.json           # hooks
│   └── agents/
│       └── reviewer.md         # 리뷰어 에이전트
├── .github/
│   ├── workflows/ci.yml
│   └── pull_request_template.md
├── package.json
├── tsconfig.json               # extends @tsconfig/strictest
├── next.config.ts              # images.unoptimized
├── postcss.config.mjs          # @tailwindcss/postcss
├── eslint.config.mjs           # flat config, strict-type-checked
├── vitest.config.ts
├── .env.example                # NEXT_PUBLIC_NCP_CLIENT_ID=
├── .gitignore
└── CLAUDE.md                   # 명령어 섹션 업데이트
```

## 실행 단계

### 1. 프로젝트 초기화
- `pnpm init` → package.json 생성
- 의존성 설치 (위 테이블)
- .gitignore (node_modules, .next, .env*.local, *.tsbuildinfo 등)

### 2. TypeScript 설정
- tsconfig.json: `@tsconfig/strictest` 확장 + Next.js 필수 옵션 (jsx: preserve, module: esnext, paths @/*)
- next-env.d.ts 포함

### 3. Next.js 설정
- next.config.ts: images.unoptimized = true
- postcss.config.mjs: `@tailwindcss/postcss`

### 4. Tailwind v4 + CSS 변수 토큰
- globals.css: `@import "tailwindcss"` + `@theme` 블록으로 색상 토큰 정의
  - `--color-accent: #F04A28` (새우 레드)
  - `--color-grill: #F0885C` (구이 코랄)
  - `--color-raw: #14957B` (회 틸)
  - `--color-ink: #191F28` (텍스트)
  - 뉴트럴 스케일, 라운드, 폰트 토큰
- 다크 모드는 토큰 두 벌만 준비 (사용은 나중)

### 5. Pretendard self-host
- pretendard npm 패키지에서 variable woff2 추출 → public/fonts/
- next/font/local로 로드 → CSS variable `--font-pretendard`
- layout.tsx에서 적용

### 6. 타입 정의 (lib/types.ts)
- `Place`, `Menu`, `Sides`, `Checkin`, `Review` — mock JSON 구조와 1:1 매칭

### 7. 데이터 접근 계층 (lib/data.ts)
- `getPlaces(filter?)`: places.json 읽기 + 필터
- `getCheckins(placeId?)`: checkins.json 읽기
- `getReviews(placeId?)`: reviews.json 읽기
- `getPlaceById(id)`: 단건 조회
- 서버 사이드에서 JSON import, 타입 단언

### 8. 환경변수 (lib/env.ts)
- `@t3-oss/env-nextjs`로 `NEXT_PUBLIC_NCP_CLIENT_ID` 검증
- `.env.example`에 키 이름만

### 9. 메인 페이지 (app/page.tsx + components/map/)
- `app/page.tsx`: 서버 컴포넌트. getPlaces()로 50곳 로드 → MapWithMarkers에 전달
- `components/map/naver-map-provider.tsx`: "use client" NavermapsProvider 래퍼 (ncpClientId = env)
- `components/map/map-with-markers.tsx`: "use client" Container + NaverMap (서울 중심) + places.map → Marker (카테고리별 색점)
- 마커: grill = #F0885C, raw = #14957B, 둘 다 = grill 우선 (코랄)

### 10. ESLint (flat config)
- `eslint.config.mjs`:
  - typescript-eslint strict-type-checked
  - eslint-plugin-jsx-a11y recommended
  - eslint-plugin-boundaries: app → components → lib 방향만
  - Next.js core-web-vitals

### 11. Vitest + Testing Library
- `vitest.config.ts`: jsdom 환경, path alias
- `lib/__tests__/data.test.ts`: getPlaces 반환값 검증 (길이, 타입, 필터)
- 간단한 스모크 테스트로 시작

### 12. Claude Code 훅 (.claude/settings.json)
- PostToolUse (Edit|Write): `pnpm eslint --fix $CLAUDE_FILE_PATH` (해당 파일 린트)
- Stop: `pnpm typecheck && pnpm lint && pnpm test`
- PreToolUse (Write): 시크릿 패턴 감지 스크립트 (API key, password, secret 등 하드코딩 차단)

### 13. 리뷰어 에이전트 (.claude/agents/reviewer.md)
- AGENTS.md 체크리스트 기반
- 모바일 뷰포트 확인, 절대 규칙 1~7, 4상태 체크

### 14. CI (ci.yml)
- GitHub Actions: Node 22, pnpm
- Steps: checkout → pnpm install → typecheck → lint → test → gitleaks (gitleaks-action) → build
- 스모크: build 성공 = 통과

### 15. PR 템플릿
- `.github/pull_request_template.md`: 변경 요약, 모바일 확인 여부, 절대 규칙 체크리스트

### 16. CLAUDE.md 업데이트
- 명령어 섹션에 실제 값 채우기: `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm typecheck && pnpm lint`

### 17. 수동 작업 안내 (사람이 할 것)
- 네이버 NCP 콘솔에서 Maps Client ID 발급 → `.env.local`에 설정
- GitHub 원격 저장소 생성 + push
- Codex GitHub App 설치 + Code review 켜기
- Vercel 연결 + 배포
- NCP 콘솔 사용량 알림 400만 건 설정

## 검증
1. `pnpm dev` → localhost에서 지도 + 마커 50개 렌더 확인 (NCP Client ID 필요)
2. `pnpm typecheck` — 0 errors
3. `pnpm lint` — 0 errors/warnings
4. `pnpm test` — 통과
5. `pnpm build` — 성공
6. 320/390/430px 뷰포트에서 지도 풀스크린 확인

## Roadmap 체크리스트 매핑
| 항목 | 이 플랜 | 비고 |
|------|---------|------|
| Next.js + Tailwind + Pretendard + coolicons | 단계 1~5, 9 | |
| 프리셋 | 단계 2, 8, 10 | |
| CLAUDE.md + docs/ | 기존 완료 + 단계 16 | |
| lib/mock/ + lib/data.ts | 기존 완료 + 단계 6~7 | |
| 훅 | 단계 12 | |
| ci.yml | 단계 14 | |
| .claude/agents/reviewer.md | 단계 13 | |
| Codex PR 리뷰 | AGENTS.md 기존 완료, 앱 설치는 수동 | |
| 네이버 지도 + 핀 | 단계 9 | NCP ID는 수동 |

---

## 결과 (2026-09-01 완료)

계획과 달라진 것:
- **배포: Vercel → Cloudflare Workers(OpenNext)** — 비용 사례 분석 후 당일 스파이크로 전환 (decisions.md 참조). 수동 작업 안내의 Vercel 항목은 무효.
- **TypeScript 7.0.2 → 6.0.3** — typescript-eslint 미지원으로 다운그레이드.
- **네이버 지도 인증: `ncpClientId` → `ncpKeyId`** — 신규 NCP Maps 상품은 ncpKeyId 사용.
- **Pretendard: 단일 woff2 → dynamic subset** — 방문당 전송 2MB → ~100KB.
- **추가**: gap-sweeper 에이전트 (스펙 대조 감사), CI 액션 SHA 고정 + Node 24 세대 업그레이드.
