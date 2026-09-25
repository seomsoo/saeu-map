# SEO·GEO 보강 — 크롤러가 읽을 내용과 링크 (2026-09-25, 런칭 전 점검에서 나온 것)

**상태: 실행 중.** 브랜치 `seo/crawlability`(문구 커밋 `45be047` "서울 → 전국"에서 이어감), PR 하나.

## Context

prod(`새우맵.kr`)를 curl로 그대로 점검했다(2026-09-25). **메타·OG·robots·sitemap·봇 통과는 다 돼 있다** — title 템플릿, description, canonical, og:*, twitter:card(Next 자동), 네이버 소유 확인, OG 카드 822장 전부 200, sitemap 804 URL, GPTBot·ClaudeBot·PerplexityBot·Yeti·bingbot 전부 200(Cloudflare가 안 막는다). 빠진 건 **크롤러가 읽을 내용과 링크**다. 코드 추측이 아니라 실측만 고친다.

| # | 발견 | 실측 |
|---|---|---|
| 1 | **내부 링크 0개.** 홈·구·상세 HTML 어디에도 `/gu/…`·`/place/…`로 가는 `<a>`가 없다 — 카드가 `<button>`이다. 크롤러는 sitemap으로만 페이지를 안다 | `href="/place/` 0 · `href="/gu/` 0 (세 페이지 모두) |
| 2 | **상세 HTML에 주소가 없다.** 역이 있으면 주소가 disclosure 접힘 뒤라 렌더 자체가 안 된다 | 본문 287자, 도로명 0건(RSC 페이로드엔 있다) |
| 3 | **구조화 데이터 없음.** `ld+json` 0건 — AI 검색은 사실상 이걸 읽는다 | grep 0 |
| 4 | **홈만 canonical·og:url 없음.** `saeu-map.saeu-map.workers.dev`가 200 + robots 허용이라 홈은 중복 후보 | 홈 `<link rel=canonical>` 없음 |
| 5 | **하위 페이지에 og:site_name·og:locale 없음.** 페이지의 `openGraph`가 레이아웃 것을 통째로 덮는다(Next는 얕은 병합) | 상세·구·테스트·약관 전부 |
| 6 | **약관·방침 og:image 없음.** `legalMeta` 주석은 "루트 카드가 붙는다"인데 안 붙는다 → twitter:card `summary` | `/privacy` og:image 0 |
| 7 | 파비콘 32px — 구글 검색결과 노출 권장 48px 이상 | `app/icon.png` 32×32 |
| 8 | 홈 본문 텍스트 101자(목록이 지도 idle 뒤에 채워진다) | — 구 페이지는 2,533자로 정상 |

## 변경 (커밋 단위 = 한 턴, 각 커밋마다 `pnpm typecheck && pnpm lint && pnpm test`)

| # | 무엇 | 파일 | 근거·방법 |
|---|---|---|---|
| 0 | **turnstile 폴링 teardown 픽스 cherry-pick**(`7ffec0a`, 5줄). origin/main엔 없어 이 브랜치의 전체 테스트가 간헐적으로 "Errors 1"로 빨갛다(stop hook 재현) | `lib/turnstile-client.ts` | `fix/turnstile-poll-teardown` 브랜치는 머지 뒤 지운다 |
| 1 | **메타 보강** — ① 홈 `canonical: "/"`·`og:url` ② `openGraph` 공통 조각(siteName·locale·type)을 `lib/seo.ts`의 모든 메타에 스프레드(발견 5) ③ 약관·방침 `images: /opengraph-image`(발견 6) ④ 상세 title `"상호 · ○○구 새우구이"`(og:title은 상호 그대로 — 카톡 카드용) ⑤ description 첫 조각을 구 대신 **도로명 주소**(없으면 구) ⑥ `viewport.themeColor` 흰색 | `lib/seo.ts` `app/(home)/page.tsx` `app/layout.tsx` `lib/__tests__/seo.test.ts` | 순수 함수라 테스트로 고정 |
| 2 | **JSON-LD** — 홈 `WebSite` · 상세 `Restaurant`(name·url·image·PostalAddress·GeoCoordinates·servesCuisine·aggregateRating(리뷰 3개↑만)·sameAs 네이버 링크) · 구 `BreadcrumbList` + `ItemList`(가게 url·name). `components/seo/json-ld.tsx`는 `<script type="application/ld+json">`에 **텍스트 자식**으로 넣는다 — React는 script 자식을 이스케이프하지 않는다(`renderToStaticMarkup` 실측 2026-09-25) → `JSON.stringify` 뒤 `<`·`>`·`&`를 `<`·`>`·`&`으로 바꿔 `</script>` 탈출을 막는다. **dangerouslySetInnerHTML은 안 쓴다(규칙 6 유지)** | `lib/seo.ts`(순수 객체) `components/seo/json-ld.tsx` 홈·상세·구 page.tsx 테스트 | 상호는 유저 입력이다 — `</script>` 상호로 테스트 고정 |
| 3 | **내부 링크** — ① 카드 `<button>` → `<a href="/place/<id>">`. 클릭은 지금처럼 `preventDefault` + 시트 열기(URL은 이미 `pushState`로 `/place/<id>`가 된다), **수정키·가운데 클릭은 기본 동작**(새 탭). `next/link`가 아니라 일반 `<a>` — 771개 뷰포트 프리페치는 워커 비용이다. `draggable={false}` ② 상세 헤더 "새우구이 · 마포구"의 구 → `<a href="/gu/마포구">`(서울 25구만, 일반 `<a>` 전체 이동 — 앱 내 history 상태기와 클라이언트 라우팅이 섞이지 않게) ③ 주소 disclosure: 접힌 상태에도 주소 블록을 DOM에 두고 `hidden`(발견 2) | `components/map-screen/place-card.tsx` `components/place-detail/place-header.tsx` `components/place-detail/info-rows.tsx` 테스트 3파일(`button` → `link` 6곳) | 보이는 결과는 같다 |
| 4 | **파비콘** `app/icon1.png` 96×96(`public/shrimp.webp` 138px 알파 원본에서 sips) — Next가 `<link rel=icon sizes=96x96>`을 추가로 낸다(발견 7) | `app/icon1.png` | 32px는 탭용으로 그대로 |
| 5 | **docs** — decisions(카드=링크·JSON-LD 채택과 규칙 6 해석·description 주소), runbook 사용자 확인 줄(sitemap 제출), 이 파일 "## 결과" | `docs/decisions.md` `docs/runbook.md` 이 파일 | |

## 그대로 둔다 / 범위 밖 (이미 결정됐거나 다른 플랜)

- **홈 페이로드 800KB·본문 101자(발견 8)** → `docs/plans/perf-diet.md` B1(요약형 페이로드). 홈은 카드 링크(3-①)로 링크 그래프만 얻는다.
- **www 리다이렉트** → phase7-launch D8 "계속 보류". **workers.dev 중복** → 홈 canonical(1-①)로 해소. 프록시 리다이렉트는 요청마다 워커 CPU라 안 한다.
- **푸터(구별 링크·약관)** → D1c "지도 앱이라 푸터가 없다". 구 링크는 상세 헤더(3-②)로 대신한다.
- manifest/PWA·`llms.txt`·`favicon.ico`(ICO 생성 도구 없음, `<link rel=icon>`이 있어 실효 없음)·상세 리뷰 본문 노출(리뷰 0건 가게가 대부분).
- `maximum-scale=1`: Lighthouse 접근성 감점이지만 지도 앱의 핀치 충돌 방지로 보고 둔다(결정 기록은 없다 — 바꾸려면 따로).

## 검증

- **단위**: `seo.test.ts`(title·description·og 공통·legal 이미지·JSON-LD 형태) · `json-ld.test.tsx`(`</script>` 상호 → 출력에 `<` 0개, `JSON.parse` 복원) · `place-card.test.tsx`(role link·href·수정키 클릭은 onSelect 안 부름) · 기존 597개.
- **SSR 발화**(로컬 Supabase가 떠 있다): `pnpm dev` 뒤 curl `/`·`/place/<id>`·`/gu/마포구` → `href="/place/`·`href="/gu/` 개수, `ld+json` 블록을 `JSON.parse`, 본문에 도로명, 홈 canonical, 약관 og:image.
- **prod**(배포 뒤, 사용자): 같은 curl + Google Rich Results Test 1회 + 서치어드바이저 "웹 페이지 최적화".

## 위험

- 카드가 링크가 되면 Enter는 anchor 기본 클릭 → onClick과 같다. 마우스 드래그가 링크 드래그가 되지 않게 `draggable={false}`. `aria-current="page"`로 바꾼다(anchor 관용).
- 주소 `hidden`: 접힌 상태의 [복사] 버튼은 DOM에 있지만 `hidden`이라 포커스 순서에 안 들어간다.
- JSON-LD 이스케이프가 깨지면 상호로 스크립트 주입 → 테스트가 `</script>` 상호를 고정한다. 서버 컴포넌트에서만 렌더(클라이언트 경로 없음).
- 상세 title 변경으로 검색결과 제목이 길어진다(상호 20자 + 12자) — 60자 안.

## 의존성 버전(변경 없음)

next 16.3.3 · react 19.2.8. **새 패키지 없음.**

## 사용자 몫

- 네이버 서치어드바이저·구글 서치콘솔에 **sitemap.xml 제출됐는지** 확인(runbook엔 소유 확인만 완료로 적혀 있다).
- 배포 뒤 Rich Results Test(`https://search.google.com/test/rich-results`)에 상세 URL 하나.
