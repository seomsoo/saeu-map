# 성능 다이어트 — prod 실측으로 고른 것들 (2026-09-25, 런칭 뒤 첫 성능 작업)

**상태: 착수(사용자 "추천으로 가고" 2026-09-25).** 브랜치 `perf/diet-1`. 결정: **A 전부 · B1 요약형 · B2 점진 렌더 · B3ⓐ 사진 Cache API = 한다**, B4 SWR 보류, B5 Sentry 몫은 측정만. 전후 수치는 아래 "측정 프로토콜"로 같은 방법으로 잰다.

커밋 순서(한 턴 = 하나): 0 플랜·프로브·기준선 → A1 zod → A2 폰트 헤더 → A3 세션 SSR → A4 상세 병렬 → A5 SDK preload → A6 의존성 → B3ⓐ 사진 캐시 → B2 점진 렌더 → B1 요약형 → B5 Sentry 몫 측정 → S1 CI 예산 게이트 → "## 결과".

## Context

런칭(9-26) 직전에 prod(`새우맵.kr`)를 그대로 재 봤다. 코드 추측이 아니라 **실측에서 나온 것만** 고쳤고, 이미 결정된 것(Workers Paid · 콜드 스타트/서버 Sentry는 1~2주 실측 뒤 · Lighthouse 예산 12s)은 다시 열지 않는다(decisions 2026-09-18).

### 실측 (2026-09-25, prod, 콜로 LAX — 한국 KT 경로와 같은 조건)

| 항목 | 값 | 방법 |
|---|---|---|
| 홈 TTFB | **0.7~0.9s** (3회) · `/place/[id]` **1.7~2.5s** (2회) | `curl -w time_starttransfer` |
| 홈 HTML | **920KB**(압축 125KB) — 그중 **RSC 페이로드 903KB** = 가게 771곳 854KB(gz 109KB). 필드별: `menus` 34% · `nearestStation` 7% · `naverPlaceUrl` 7% · `sides` 6% · 주소 11% · 타임스탬프 8% | HTML의 `__next_f.push` 파싱 |
| 홈 JS | **16청크 397KB gz**. 그중 **zod 4 + 253개 로케일 86KB gz(22%)** · react-dom+라우터+Sentry 116KB · 앱 코드(지도·클러스터 포함) 44KB · Next 런타임 43KB · 폴리필 39KB는 `nomodule`이라 요즘 브라우저는 안 받는다 | 프로덕션 청크를 내려받아 문자열 지문(`invalid_type`×88, `E.164-nummer`) |
| 첫 로드 타임라인 | TTFB 0.6s → JS 다 받음 3.2s → 하이드레이션 → **지도 SDK 요청 3.3s** · **세션 POST `/` 3.3s(+0.3s)** → 타일 3.6s → LCP 4.2s(IMG) | Playwright 390×702, 콜드, `performance` 엔트리 |
| 폰트 | 조각 **19개** 요청, 첫 요청 2.5s. 응답 `Cache-Control: public, max-age=0, must-revalidate` — **`next.config` `headers()`의 `/fonts/*` immutable은 Workers에서 안 먹는다**(정적 에셋은 ASSETS 바인딩이 워커 앞에서 내고 `public/_headers`만 본다). 재방문마다 19번 재검증 | `curl -I .../woff2` · Playwright |
| DOM | 3,454 노드 · **`li` 281개** · `img` 191개 — 첫 뷰포트의 카드 전부를 시트에 그린다(반쯤 열린 시트엔 2~3장 보인다) | `document.querySelectorAll` |
| Lighthouse CI(모바일 스로틀) | 홈 **55 / LCP 5.3s** · 상세 **56 / 8.6s** | PR #21 코멘트 |
| `/photos/<key>` | 매 요청 워커 호출 + R2 읽기, 엣지 캐시 없음(워커 응답의 Cache-Control은 CDN에 안 남는다). TTFB ~1s | `curl` |

### 곁가지 발견 (이 플랜 밖 — 사용자 판단)

- **prod 사진 404**: 사진이 있는 유일한 가게(`e0dd1e42…`)의 사진 2장이 DB `photos` 행은 있는데 R2 객체가 없다(`wrangler r2 object get … --remote` → "The specified key does not exist"). 그 상세 스트립은 깨진 타일이다. 객체를 수동으로 지웠는지, 아니면 행만 남는 경로가 있는지(업로드 중 `put` 실패 뒤 행 삽입? 삭제 경로가 객체만 지움?) 확인이 필요하다.
- **Smart Placement 미적용**(`cf-placement: local-LAX`, 09-22와 같음) — 대시보드 Placement 상태 확인은 사용자 몫(phase7-launch 0-6).
- **안 쓰는 의존성**: `react-hook-form`·`@hookform/resolvers` — 소스에서 import 0건(번들엔 안 들어가지만 lock·설치·보안 알림만 먹는다). A6에서 뺀다.

## 변경

### A. 결정 없이 바로 — 커밋 단위 = 한 턴, PR 하나 (`perf/diet-1`)

| # | 무엇 | 파일 | 기대 효과(실측 근거) |
|---|---|---|---|
| A1 | **zod를 클라이언트 번들에서 뺀다.** zod 4 classic은 `export * as locales`로 253개 로케일을 실어 보내고 Turbopack이 못 털어 낸다(`zod` 4.5.4). 브라우저에서 zod를 쓰는 곳은 셋뿐: `lib/env.ts`(t3-env, `NEXT_PUBLIC_*`) · `profile-row.tsx`의 `nicknameSchema.safeParse` · `menu-draft.ts`의 `reportMenuSchema.safeParse`. 그리고 `lib/data.ts`의 `export * from "./schemas"`가 값 재수출이라 스키마 전부가 딸려 온다. ① `lib/env.ts`에 `import "server-only"`, 클라이언트 두 곳(`turnstile-client.ts`·`instrumentation-client.ts`)은 `process.env["NEXT_PUBLIC_…"]` 직접 읽기(`naver-map-provider.tsx`가 이미 그렇게 한다) ② 상수·문구(`MAX_PHOTO_BYTES`·닉네임 길이/패턴·메뉴 상한 등)를 zod 없는 `lib/limits.ts`로 옮기고 zod 스키마는 그 상수로 만든다(원본 하나) ③ 닉네임·메뉴 줄 클라이언트 검증은 같은 상수로 짠 순수 함수(`validateNickname`·기존 `validateMenuDraft`) ④ `lib/data.ts`는 `export * from "./limits"` + `export type * from "./schemas"`(타입은 지워진다). 새 패키지 없음 | `lib/env.ts` `lib/schemas.ts` `lib/limits.ts`(신설) `lib/data.ts` `lib/turnstile-client.ts` `instrumentation-client.ts` `components/activity/profile-row.tsx` `components/report/menu-draft.ts` + 테스트 | JS **397 → ~310KB gz(−22%)**. 하이드레이션이 앞당겨지므로 지도 SDK 요청·세션 부트스트랩도 같이 당겨진다. 검증: 빌드 뒤 홈 청크 전체에서 `invalid_type` 0건 |
| A2 | **폰트 immutable 헤더를 `public/_headers`로.** `/fonts/*` → `Cache-Control: public, max-age=31536000, immutable`. `next.config.ts`의 `headers()`는 Workers에서 죽은 코드라 지운다. decisions 2026-09-01 "`/fonts/*`는 immutable 캐시 헤더"는 **적용된 적이 없었다**고 정정 항목을 쓴다 | `public/_headers` `next.config.ts` `docs/decisions.md` | 재방문 시 조건부 요청 **19 → 0**. 발화: 배포 뒤 `curl -I …/woff2`가 immutable |
| A3 | **세션을 SSR로 내려 첫 로드 POST `/`를 없앤다.** `loadMapScreenData`가 이미 쿠키 클라이언트로 찜을 읽는다 — `getSession()`을 같은 `Promise.all`에 넣고 `MapScreen`→`SessionProvider`에 `initialSession`으로 준다. 마운트 시 `getSession()` 호출은 초기값이 있으면 건너뛴다(`login=fail` 처리·`refreshSession`·OAuth 뒤 갱신은 그대로). 카카오 세션의 `me` RPC가 SSR로 오지만 병렬이라 TTFB에 안 붙는다 | `lib/map-screen-data.ts` `components/map-screen/map-screen.tsx` `components/auth/session-provider.tsx` + 세션 테스트 | 페이지뷰마다 **워커 호출 1회·왕복 ~0.3s** 제거, 프로필 아이콘의 "아직 모름" 깜빡임 제거 |
| A4 | **`/place/[id]` 데이터 병렬화.** 지금은 `detailOrRedirect` → `loadMapScreenData` 직렬. `Promise.all`로 묶고 `notFound()`는 둘 다 온 뒤(리다이렉트 throw는 그대로 전파) | `app/place/[id]/page.tsx` | 캐시 왕복 한 단(홈 0.8s vs 상세 1.7~2.5s의 일부). 전후 curl로 확인 |
| A5 | **지도 SDK를 HTML 단계에서 미리 받는다.** 지금은 하이드레이션(3.3s) 뒤에야 `<script>`가 꽂힌다. 지도 페이지 3개의 서버 컴포넌트에서 React 19 `preload(SDK_URL, { as: "script" })` + `preconnect("https://oapi.map.naver.com")`·타일 호스트. URL은 react-naver-maps `buildUrl`과 **바이트 단위로 같아야** 재사용된다(`?ncpKeyId=…&submodules=geocoder`) — 문자열을 `lib/`에 상수로 두고 테스트로 고정. 규칙 3과 무관(SDK 스크립트·타일은 우리 이미지가 아니다) | `lib/naver-sdk.ts`(신설, 상수 하나) `app/(home)/page.tsx` `app/place/[id]/page.tsx` `app/gu/[name]/page.tsx` | SDK 다운로드(데스크톱 0.2s, 폰 망에선 더)가 하이드레이션과 겹친다 → 지도가 먼저 뜬다 |
| A6 | 안 쓰는 `react-hook-form`·`@hookform/resolvers` 제거 | `package.json` `pnpm-lock.yaml` | 번들 변화 0, 위생 |

순서: A1(가장 큰 수치) → A2 → A3 → A4 → A5 → A6. 각 커밋마다 `pnpm typecheck && pnpm lint && pnpm test`.

### B. 결정이 필요한 것 — 하나씩 답을 받은 뒤 `perf/diet-2`

| # | 무엇 | 수치 | 결정할 점 | 추천 |
|---|---|---|---|---|
| B1 | **홈 페이로드 요약형**(roadmap 백로그 "워커 CPU 다이어트 ②"). 목록은 카드·마커·검색이 읽는 필드만(`id·name·gu·lat·lng·tags·specialist·thumbnailUrl·rating·checkCount·lastCheckedAt·isNew·nearestStation·sides·addressRoad` + 대표 메뉴 한 줄), 상세의 전체(`menus` 전부·`hoursNote`·`naverPlaceUrl`·`addressJibun`·`photos`)는 `getPlaceDetail`이 이미 돌려주는 `place`로 채운다 | 771곳 기준 **854 → 413KB raw, gz 109 → 65KB**. 서버 직렬화 CPU(홈 +180ms, decisions 09-18)도 절반 | ① 앱 안에서 카드를 탭하면 정보 행(메뉴 전체·영업시간·주소·사진 스트립)이 리뷰처럼 **잠깐 스켈레톤**이었다가 채워진다(`/place/[id]` 직접 진입은 `initialDetail`이라 지금과 같음). 4상태 규칙대로 로딩 상태를 만든다 ② 타입이 `PlaceSummary` + `Place`로 갈리고 상세·제보(중복 후보)·수정 제안·내 활동이 어느 쪽을 받는지 정리(1.5~2일, 테스트 픽스처 다수) | **한다** — 가게 2,000곳(백로그 조건)이 아니어도 지금 HTML의 98%가 이 페이로드다. 미루면 **A7 대안**: 클라이언트가 안 읽는 것만 뺀다(`needsReview`·`source`·`createdAt`·`menus[].raw`·타임스탬프 초 단위) → 854 → 699KB, gz 94KB(−14%), UX 변화 0, 반나절 |
| B2 | **목록 점진 렌더.** 시트·패널 목록을 처음 30장만 그리고 끝의 감시 `li`가 보이면 30장씩 더(IntersectionObserver, 패키지 없음). 보이는 결과는 같다 | `li` 281 → 30, DOM 3,454 → ~1,000 추정. 하이드레이션·필터 전환 시 커밋 비용 | design 화면 1에 목록 양의 규정이 없다(관리자 표만 `ADMIN_PAGE_SIZE` 100 + [더 보기]). "빠르게 끝까지 스크롤하면 잠깐 비는 것"을 받아들일지 | 한다(사용자가 알아채기 어렵고 B1과 합치면 홈 하이드레이션이 가장 가벼워진다) |
| B3 | **사진 서빙** 셋 중 택. ⓐ `/photos` 라우트에 Cache API(`caches.default`) — 재요청은 R2를 안 간다(워커 호출은 남음), 변경 10줄 ⓑ 업로드 때 **썸네일 변형**(160px, 카드 72px×2) 하나 더 — 카드가 1200px(150~270KB)을 받는 걸 ~5KB로. Images 변환이 장당 2회라 앱 상한 4,500 → 2,250장/월 ⓒ **R2 커스텀 도메인 직서빙**(엣지 캐시·워커 0) — 규칙 3 문구·`safeAssetPath`·DNS가 바뀐다 | 지금 사진은 2장(그마저 404)이라 **오늘 수치엔 안 나온다**. 쌓이면 목록 스크롤이 사진 바이트로 먹는다 | 어느 것을, 언제 | ⓐ는 지금 같이(싸다), ⓑ·ⓒ는 **사진이 100장 넘을 때** |
| B4 | **핀 목록 캐시를 SWR로.** 확인 한 번마다 `updateTag(places)` → 다음 홈 요청이 뷰 재조회(771행 × lateral 3개, LAX→서울)를 **기다린다**. `revalidateTag(TAG_PLACES, "max")`(Next 16: 낡은 걸 주고 뒤에서 갱신, context7 확인)로 바꾸고 `place:<id>`·`season`은 `updateTag` 유지(상세는 read-your-writes) | 쓰기 뒤 첫 홈 요청의 TTFB(측정 전) | ① 목록의 그 가게 `checkCount`가 한 요청 늦는다(누른 사람 화면은 낙관적 업데이트라 같다) ② OpenNext Cloudflare가 `unstable_cache`의 백그라운드 갱신을 `waitUntil`로 처리하는지 문서 확인 필요 — decisions 2026-09-10 "read-your-writes"를 뒤집는 결정 | 쓰기 트래픽이 생긴 뒤. 지금은 보류 |
| B5 | **Sentry 브라우저 SDK 다이어트.** react-dom과 같은 청크(116KB gz)에 들어 있어 몫을 모른다. 먼저 `instrumentation-client.ts` 초기화를 뺀 빌드와 비교해 몫을 잰다. 방법 후보: 지연 초기화(`load` 뒤 동적 import — **부팅 중 오류(React #412·부트스트랩 fetch 실패)를 놓친다**, 지금까지 잡은 이슈가 그 종류였다) / 최소 클라이언트(`BrowserClient` + 필요한 통합만) | 측정 전 | 몫이 30KB gz를 넘으면 어느 쪽으로 갈지 | **측정만** 이 PR에서, 결정은 수치 뒤 |

### C. 그대로 둔다 (이미 결정)

- 워커 콜드 스타트·서버 Sentry(`@sentry/cloudflare` 교체) — decisions 2026-09-18 조건(홈 TTFB p50 > 1s 유지 또는 2,000곳) 그대로. 오늘 홈 TTFB 0.7~0.9s는 조건 아래.
- Lighthouse 예산(error 12s·warn 0.5)은 A·B 뒤 CI 코멘트 중앙값을 보고 조인다(LCP 4s 아래면 error 8s 제안). 지금 손대지 않는다.

### S. 시니어가 더 할 것 (사용자 "다른 건 더 할 거 없어?" 2026-09-25)

| # | 무엇 | 왜 |
|---|---|---|
| S1 | **CI 번들 예산 게이트**: `check` 잡의 workerd 스모크 뒤 `scripts/perf-probe.sh http://localhost:8787 --budget-js-kb <A1 뒤 수치 + 10%>`. 넘으면 실패 | zod 로케일 86KB 같은 회귀를 사람이 아니라 CI가 잡는다. Lighthouse는 흔들리지만 바이트는 결정적이다 |
| S2 | **실사용자 수치는 Cloudflare Web Analytics의 Core Web Vitals**(이미 붙어 있다 — `static.cloudflareinsights.com` 비콘). 배포 전 7일·후 7일의 LCP p75(국가 KR)를 사용자가 대시보드에서 읽어 "## 결과"에 적는다 | 내 측정은 LAX·헤드리스, CI는 미국 러너다. 한국 폰의 진짜 값은 여기뿐이다 |
| S3 | **서버 CPU 전후**: Workers GraphQL `workersInvocationsAdaptive`(방법은 decisions 2026-09-18)로 배포 전후 24시간 CPU p50/p90 | A1·B1이 줄이는 건 브라우저만이 아니라 홈 직렬화 CPU(+180ms)다 |
| S4 | 프로브 스크립트를 리포에 둔다(`scripts/perf-probe.sh`, curl+python3만) | "전후"가 같은 방법이어야 비교다. 로컬·프리뷰·prod 어디든 같은 표 |

확인했지만 손대지 않는 것: 홈 셸 스트리밍(`loading.tsx`로 이미 먼저 나간다) · `nomodule` 폴리필(요즘 브라우저는 안 받는다) · DB 인덱스(집계 3개 전부 인덱스 있음) · Sentry 서버(결정 조건 아래) · 청크 분할(A1 뒤 다시 잰다).

## 측정 프로토콜 (전후 같은 방법)

| 층 | 방법 | 언제 |
|---|---|---|
| 랩(네트워크·바이트) | `scripts/perf-probe.sh https://xn--r02bv8jvof.kr` — TTFB 5회 중앙값(홈·상세), HTML 전송/원본, RSC 바이트, JS 청크 수·전송 합, 폰트·사진 헤더 | 커밋 0(기준선) · 각 배포 뒤 |
| 랩(브라우저 타임라인) | Playwright 390×702 콜드: 폰트 요청 수, SDK 요청 시작, 같은 origin POST 수, DOM 노드·`li` 수, LCP | 기준선 · PR 프리뷰 · 머지 뒤 |
| CI | PR의 Lighthouse 코멘트(홈·상세 performance/LCP 중앙값) | PR마다 |
| 실사용자 | Cloudflare Web Analytics CWV LCP p75(KR), 배포 전 7일 vs 후 7일 | 사용자 대시보드 |
| 서버 | Workers GraphQL CPU p50/p90, 배포 전후 24시간 | 결과 쓸 때 |

## 기준선 (before — 2026-09-25, 커밋 0, prod, LAX)

`scripts/perf-probe.sh https://xn--r02bv8jvof.kr`:

| 항목 | 값 |
|---|---|
| 홈 TTFB (5회 중앙값) | 0.68s |
| 상세 TTFB (5회 중앙값) | 1.16s (`/place/e0dd1e42…`) |
| 홈 HTML 전송 / 원본 | 114KB / 898KB |
| 홈 RSC 페이로드(원본) | 881KB |
| 홈 JS 청크 수 / 전송 합 | 16 / 384KB |
| 폰트 woff2 Cache-Control | `public, max-age=0, must-revalidate` |
| 사진 첫 장 | 404 (곁가지 발견 참조) |

Playwright 390×702 콜드(같은 날, 위 실측 표): 폰트 요청 19 · SDK 요청 시작 3.3s · 같은 origin POST 1(세션) · DOM 3,454 노드 / `li` 281 · LCP 4.2s. Lighthouse CI(PR #21): 홈 55 / 5.3s · 상세 56 / 8.6s. 실사용자 CWV·서버 CPU는 사용자가 배포 전 값을 대시보드에서 적는다(S2·S3).

## 진행 (커밋별 — 로컬 빌드 수치는 잠정, prod 배포 뒤 프로브가 확정)

| 커밋 | 무엇 | 전 → 후 (같은 방법) | 검증 |
|---|---|---|---|
| A1 | zod 클라이언트 제거 — `lib/limits.ts`(상수·닉네임·메뉴 순수 검증) 분리, `lib/env.ts` server-only, `lib/data.ts`는 `export type *` | 홈 JS gz 합 **397KB → 301KB(−24%)**(로컬 프로덕션 빌드, `gzip -c` 합), 정적 청크 26개에서 zod 로케일 문자열 **0건** | typecheck·lint·vitest 597 통과. 닉네임·메뉴 줄 판정은 서버 스키마와 같은 함수·상수 |
| A2 | 폰트 immutable → `public/_headers`, `next.config` `headers()` 삭제, decisions 09-01 정정·runbook 3절 | 폰트 조각 Cache-Control `max-age=0, must-revalidate` → `max-age=31536000, immutable` — **배포 뒤 prod에서 확인**(로컬 next start는 `_headers`를 안 본다). 재방문 조건부 요청 19 → 0 예상 | 코드 변화 없음. 발화는 배포 뒤 `curl -I` |
| A3 | 세션을 `loadMapScreenData`의 `Promise.all`에 넣어 `SessionProvider` `initialSession`으로 — 첫 로드 `getSession()` POST 생략 | 첫 로드의 같은 origin POST **1 → 0**(페이지뷰당 워커 호출 1회·~0.3s), 프로필 아이콘 "아직 모름" 구간 0 — **배포 뒤 Playwright로 확인** | session.test 11(+1: 초기값이 있으면 getSession 미호출·갱신은 그대로) |
| A4 | `/place/[id]`에서 상세와 지도 데이터를 `Promise.all` | 상세 TTFB 기준선 1.16s → **배포 뒤 프로브** | notFound·permanentRedirect 경로 그대로(둘 다 기다린 뒤 판정) |
| A5 | `NaverMapProvider` 렌더에서 `preconnect`+`preload(SDK)` — SSR이 head에 `<link>`를 넣는다. 주소는 `lib/naver-sdk.ts`, 테스트가 react-naver-maps `buildUrl`과 대조 | SDK 요청 시작 3.3s(하이드레이션 뒤) → **HTML 파싱 직후** — 배포 뒤 Playwright로 시작 시각·요청 1회 확인 | naver-sdk.test 2. 타일 호스트(pstatic)는 규칙 3 도메인이라 코드에 안 둔다 |
| A6 | `react-hook-form`·`@hookform/resolvers` 제거(import 0건) | 번들 변화 0 | lock 갱신, 테스트 그대로 |
| B3ⓐ | `/photos` 라우트에 Cache API(`caches.default`) — 히트면 R2를 안 읽고, 저장은 `waitUntil` | 같은 콜로 재요청 TTFB ~1s → **캐시 히트** — 배포 뒤 `curl` 2회로 확인(지금 prod 사진은 404라 새 업로드 뒤) | `next dev`엔 `caches`가 없어 그대로 R2. 유닛 테스트 없음(워커 전용) |
| B2 | `useIncrementalList` — 시트 카드 30장 + 끝 감시 `li`(600px 앞에서 30장씩) | 첫 화면 `li` 281 → **≤31** — 배포 뒤 Playwright DOM 수 | 훅 테스트 4(늘림·짧은 목록·목록 교체 시 리셋·IO 없으면 전부). map-screen 테스트는 jsdom(IO 없음)이라 전부 그리는 경로 |
| B1 | `PlaceSummary`(목록·마커·검색 필드 + 대표 메뉴 `menu`) / `Place extends PlaceSummary`(전체). `getPlaces`는 `toSummary`, 상세는 `getPlaceDetail`의 전체로 채우고 그동안 사진·영업시간·메뉴 자리는 스켈레톤, 확인·사진·제안은 잠금. 부모 목록의 항목이 전체면(쓰기 응답·`/place/[id]` 시드) 재요청 없이 바로 | 홈 `places` 페이로드 **854KB → 528KB(−38%), gz 109 → 77KB(−30%)** — prod 771곳 데이터에 같은 필드 목록을 적용한 예상치, **배포 뒤 프로브로 확정** | typecheck·lint·vitest 607(+3: 요약 → 스켈레톤 → 채움 · 로드 전 다녀왔어요 잠금 · 전체면 재요청 없음). 지번은 동 이름 검색 때문에 남겼다 |
| B5 | Sentry 브라우저 몫 **측정** — 같은 트리를 `instrumentation-client.ts` 있이/없이 빌드해 홈 JS gzip 합 비교 | **299KB → 247KB: Sentry 브라우저 SDK = 52KB gz(17%)** | **결정(시니어 통상 선택): 지금은 둔다.** 지금까지 잡은 5건 중 2건이 부팅 중 오류(React #412·부트스트랩 fetch)라 지연 로드는 그걸 놓친다. 최소 클라이언트(`@sentry/browser` `BrowserClient` + 필요한 통합만)는 RUM·Lighthouse가 JS를 병목으로 지목할 때 집는다 — 판돈 52KB |
| S1 | CI `check` 잡 스모크 뒤 `scripts/perf-probe.sh http://localhost:8787 --budget-js-kb 330`(299KB + 10%). 프로브는 gzip을 직접 해 prod(brotli)·wrangler dev(무압축)를 같은 자로 잰다 | 회귀 가드 — zod 로케일(+86KB)이 다시 들어오면 CI 실패 | **발화는 이 PR의 CI에서**(하네스 규칙). 표는 잡 로그 |

## 검증

- **같은 방법으로 전후 비교**: 위 프로토콜. 결과는 이 파일 "## 결과"에 표로.
- **발화(하네스 규칙)**: A2는 배포 뒤 `curl -I …/woff2` immutable · A3는 네트워크 탭에 `POST /` 없음 · A5는 SDK URL 요청이 **1회**(프리로드 재사용, 이중 다운로드 아님) · A1은 프로덕션 청크에서 `invalid_type` 0건.
- PR의 Lighthouse 코멘트(홈·상세 performance/LCP 중앙값) — 예산 조정은 그 뒤.
- `pnpm typecheck && pnpm lint && pnpm test`, PR 템플릿 체크리스트, security-reviewer(A3가 SSR HTML에 세션 필드를 싣는다 — 응답은 이미 `private, no-store`).

## 위험

- **A1** 닉네임·메뉴 검증 문구가 서버 zod와 갈릴 수 있다 → 상수·정규식 원본을 `lib/limits.ts` 하나로, 양쪽 테스트가 같은 입력으로 같은 결과인지 고정.
- **A2** pretendard 버전을 올릴 때 경로가 같으면 옛 조각이 1년 남는다 → runbook에 "폰트 갱신 시 디렉터리에 버전 접미" 한 줄.
- **A3** OAuth 콜백 뒤(`login=ok`)·다른 탭 로그인은 지금처럼 `refreshSession`이 맞춘다. 초기값이 있으면 마운트 fetch를 건너뛰므로 StrictMode 이중 effect 경로가 사라진다 — 세션 테스트 갱신.
- **A5** URL이 한 글자라도 다르면 프리로드가 버려지고 SDK를 두 번 받는다 → 상수 테스트 + 발화 검증에서 요청 1회 확인. 지도 없는 페이지(`/privacy`·`/test`)엔 안 건다.
- **B1** 상세가 두 단계로 채워지는 동안 "정보 수정 제안"·사진 업로드 버튼이 전체 데이터 전에 눌릴 수 있다 → 상세 로딩 중엔 그 버튼을 잠근다(4상태).

## 의존성 버전(변경 없음)

next 16.3.3 · react 19.2.8 · zod 4.5.4 · @opennextjs/cloudflare 1.20.5 · @sentry/nextjs 10.74.0 · react-naver-maps 0.2.2. **새 패키지 없음**, 제거 2개(A6).

## 범위 밖

곁가지 발견 3건(사진 404·Smart Placement·의존성)은 위 "곁가지" 절 — 사진 404는 이 플랜과 별개로 먼저 봐야 한다. 청크 분할(제보·리뷰·내 활동을 `next/dynamic`으로)은 앱 코드 몫이 44KB gz라 A1 뒤 다시 잰다 — 20KB 아래면 안 한다.

## 결과 (2026-09-25 코드 완료 · prod 확정치는 배포 뒤 이 표에 채운다)

커밋 12개(브랜치 `perf/diet-1`): 0 플랜·프로브·기준선 → A1 zod → A2 폰트 헤더 → A3 세션 SSR → A4 상세 병렬 → A5 SDK preload → A6 의존성 → B3ⓐ 사진 캐시 → B2 점진 렌더 → B1 요약형 → B5 측정 + S1 예산 게이트(이 커밋). vitest **597 → 607**(+10: 세션 초기값 1 · SDK 주소 대조 2 · 점진 렌더 4 · 상세 요약 3), typecheck·lint 통과, 새 패키지 0 · 제거 2.

| 지표 | 전 (기준선, prod) | 후 | 근거 |
|---|---|---|---|
| 홈 JS gzip 합 | 397KB (16청크) | **301KB** (로컬 프로덕션 빌드, −24%) → prod 확정: _배포 뒤_ | A1 (zod 로케일 86KB). B5 측정: 그중 Sentry 52KB는 둔다 |
| 홈 `places` 페이로드 | 854KB (gz 109KB) | **528KB 예상** (gz 77KB, −38%/−30%) → prod 확정: _배포 뒤_ | B1 |
| 폰트 조각 캐시 | `max-age=0, must-revalidate` (재방문마다 19회 재검증) | `immutable` 1년 → prod 확정: _배포 뒤 curl -I_ | A2 |
| 첫 로드 세션 POST | 1회 (+0.3s, 하이드레이션 뒤) | **0회** → prod 확정: _배포 뒤 Playwright_ | A3 |
| 지도 SDK 요청 시작 | 3.3s (하이드레이션 뒤) | HTML 파싱 직후 preload → prod 확정: _배포 뒤_ | A5 |
| 첫 화면 시트 카드 DOM | `li` 281 | **≤31** → prod 확정: _배포 뒤_ | B2 |
| 사진 재요청 | 매번 워커 + R2 | 같은 콜로 재요청은 캐시 히트 → _새 업로드 뒤 확인_ | B3ⓐ |
| 상세 TTFB | 1.16s (홈 0.68s) | _배포 뒤 프로브_ | A4 |
| Lighthouse(CI, 모바일) | 55 / LCP 5.3s · 상세 56 / 8.6s | _이 PR의 CI 코멘트_ | — |
| 실사용자 LCP p75(KR) · 서버 CPU p50 | _사용자가 대시보드에서_ | _배포 7일 뒤_ | S2·S3 |

계획에서 바뀐 것: ① B5는 측정 뒤 "둔다"로 결정(부팅 중 오류가 실제 이슈의 40%) ② A5의 타일 호스트 preconnect는 규칙 3 도메인이라 뺌 ③ 프로브의 JS 지표를 "서버 전송 바이트"에서 "직접 gzip"으로 — prod(brotli)·CI(wrangler dev 무압축)를 같은 자로 재기 위해 ④ B1의 지번(`addressJibun`)은 동 이름 검색 때문에 요약에 남김(예상치 413 → 528KB). 남은 것: 배포 뒤 prod 프로브·Playwright·`curl -I`로 위 표의 "배포 뒤" 칸 채우기, 7일 뒤 S2·S3.
