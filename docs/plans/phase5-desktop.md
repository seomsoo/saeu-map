# Phase 5 — 데스크탑 그릇 · 라우트 (design 화면 6~9 · spec 4.6)

## Context

roadmap Phase 5. 지금 상태: 모든 화면이 390 기준 모바일 그릇(풀스크린 지도 + 바텀시트) 하나뿐이고, 1024px 이상에서도 같은 시트가 화면 아래에 붙는다. `/place/[id]`는 얕은 라우트만 있어 메타·OG가 없고 없는 id는 200 + noindex(루트 `app/loading.tsx` 스트리밍 때문). `/gu/[name]`·sitemap·OG 카드·Lighthouse 예산은 없다. 테스트 377개.

목표: **같은 컴포넌트가 두 그릇에서 렌더**(중복 구현 없음) — 1024px부터 좌측 패널 400px + 지도, 카드↔마커 호버 동기화, 패널 전환(상세·제보·내 활동), 지도가 필요 없는 오버레이만 중앙 480 모달. 라우트는 `/place/[id]` SSR 메타 + 진짜 404, `/gu/[name]` 25구 SSR, `next/og` 공유 카드 3종, sitemap·robots. CI에 Lighthouse 모바일 LCP 예산.

roadmap 규칙대로 **design 화면 6~9(v1 초안)를 v2 언어로 먼저 재작성**하고 그 문서를 기준으로 구현한다. 화면 9 프레임 1(새로 들어온 집)은 2026-09-05 관리자 이동으로 사라졌으므로 화면 9 = 내 활동 패널 전환만.

**주요 의존성(패키지 추가 없음)**: Next 16.3.3 · React 19.2 · Tailwind 4.3 · @opennextjs/cloudflare 1.20.5 · wrangler 4.127 · vitest 4.1. `next/og`(ImageResponse)는 Next 내장(`next/dist/compiled/@vercel/og`)이고 OpenNext 1.20이 edge 빌드로 재배선 + `resvg.wasm`(1.4MB) 동봉을 지원한다(`bundle-server.js` 105~112행). Lighthouse는 CI에서 `npx @lhci/cli@0.15.1`(2025-06, 의존성 아님).

---

## 결정 (사용자 답 3 + 권고)

| 항목 | 결정 | 출처 |
|---|---|---|
| 제보 플로우 그릇(화면 8) | **좌측 패널**(상세·내 활동과 같은 패널 전환). 핀은 본 지도 그대로 — 카카오맵 PC·구글맵 "장소 추가" 문법. 두 번째 지도 인스턴스 없음. design v1의 "중앙 480 모달 + 240 내장 지도"는 폐기 | 사용자 선택 |
| 중앙 480 모달 | 지도가 필요 없는 오버레이만: 로그인 시트 · 리뷰 폼 · 사유(정보 수정 제안) · 사진 신고 · 탈퇴 확인. `ModalSheet`·리뷰 폼 `<dialog>`에 lg 스타일만 더한다(라운드 16 — 미사용 토큰, 딤 40%). 사진 뷰어는 몰입형 전체 화면 유지 | 권고 |
| 진짜 404 | **proxy 대신 로딩 경계 제거.** 홈만 route group `app/(home)/`으로 옮겨 `loading.tsx`를 그 안에 두고, `/place/[id]`(기존 `loading.tsx` 삭제)·`/gu/[name]`엔 Suspense 경계를 두지 않는다 → `notFound()`가 스트리밍 전에 던져져 404. 근거: OpenNext Cloudflare가 Node 런타임 `proxy.ts`를 "실험적·미지원"으로 명시(`bundle-node-middleware.ts`). 직접 진입 스켈레톤이 사라지는 대가는 목 데이터라 수 ms. roadmap의 "(proxy)" 표기는 정정 | 사용자 선택 |
| 루트 `app/not-found.tsx` | 매치 안 되는 경로(`/test` 등)에 Next 기본 404 대신 우리 빈 상태("페이지를 찾을 수 없어요" + [지도로 돌아가기]) | 권고 (진짜 404의 일부) |
| `/gu/[name]` | **같은 지도 화면**: `MapScreen`에 `initialGu` — 그 구 가게로 fitBounds(0곳이면 구 중심·줌 13), 목록은 서버가 그 구 가게를 미리 채워 SSR(크롤러가 상호를 읽음; 지도 idle 뒤엔 뷰포트 기준으로 전환). 서울 25구만(`lib/gu.ts`의 `SEOUL_GU` 상수 25개 — `gu-boundaries.json` 이름과 일치 테스트), 그 밖은 404. 헤더 "마포구 7곳"은 `areaLabel`이 자연히 만든다. 가게 0곳 구는 빈 상태 "이 동네엔 아직 없어요" + [제보] | 사용자 선택 |
| SSR 메타 | `lib/seo.ts`(순수 함수) — place: 제목 `상호`, 설명 "마포구 · 새우구이 · 생새우소금구이 1kg 60,000원 · 어제 확인". gu: 제목 `마포구 새우구이 7곳`, 설명 "마포구의 새우구이·생새우회 가게 7곳. 나라수산, …". 루트 layout에 `metadataBase`·`title.template "%s | 새우맵"`·og siteName/locale. OG 이미지는 파일 컨벤션 `opengraph-image.tsx`가 자동 연결 | spec 4.6 |
| 사이트 URL | 서버 전용 env `SITE_URL`(t3-env `server`에 추가, `NEXT_PUBLIC_` 아님 — 규칙 7 허용 목록 밖). 없으면 `https://saeu-map.saeu-map.workers.dev`. metadataBase·sitemap·robots가 쓴다. CI preview 잡은 `SITE_URL`을 프리뷰 URL로 준다 | 권고 |
| OG 카드(next/og) | 3종 — 루트("서울 새우구이 지도" + N곳), 핀(상호 + "마포구 · 새우구이" + 대표 메뉴 + 확인 라벨 + 카테고리색 마커 모티프), 구(구 이름 + "새우구이 N곳" + 상호 3개). 1200×630, 흰 바탕, 잉크 글자, 좌하단 레드 점 + "새우맵". 사진은 넣지 않는다(외부 fetch 없음, 에셋 대기). 폰트: Pretendard **Bold·Regular subset.woff**(KS X 1001, 각 350KB — satori는 woff2 불가)를 `public/fonts/og/`에 두고 `lib/og/font.ts`가 **ASSETS 바인딩**(`getCloudflareContext().env.ASSETS.fetch("http://assets.local/fonts/og/…")` — OpenNext 내부 캐시와 같은 패턴)으로 읽고, 컨텍스트가 없으면(`next build` 프리렌더·`next dev`) `fs.readFile(public/…)` 폴백. 모듈 캐시로 한 번만. 워커 번들에 폰트가 안 들어간다 | spec 4.6 |
| 워커 크기 | 지금 handler.mjs gzip 1.34MB. resvg.wasm(+yoga)로 ~2.0~2.3MB 예상, Workers Free 상한 3MB. 6번 커밋에서 `opennextjs-cloudflare build` 출력의 gzip 총량을 확인해 결과에 기록. 넘으면 정적 PNG 카드로 후퇴(결정 기록) | 권고 |
| Lighthouse | CI `check` 잡의 스모크 뒤(같은 wrangler dev :8787) `npx @lhci/cli@0.15.1 autorun` + `lighthouserc.json`: URL `/`·`/place/p018`, 3회, 모바일(기본 에뮬레이션). 예산은 **로컬 workerd 실측 뒤 확정**(초안: LCP error 4000ms / warn 2500ms, performance warn 0.8). CI엔 NCP 키가 dummy라 지도는 에러 상태 — 우리 셸의 LCP를 재는 것 | roadmap |
| 데스크탑 지도 컨트롤 | 우하단 [+][−] 줌 + 현위치(design 6 v1 항목). `MapHandle.zoomBy(±1)` 추가. 모바일 FabRow의 현위치 버튼을 `LocateButton`으로 분리해 둘이 같은 컴포넌트 | design 6 |
| 패널 푸터 "새우맵 소개 · 사장님이신가요?" | **뺀다** — 라우트가 spec에 없다(코드 최소주의 1). Phase 7 도메인·소개 페이지 때 재검토 | 권고 |
| 호버 동기화 | 카드 hover → 배경 `bg-bg-dim` + 해당 마커 확대(`saeu-marker--hovered`, z 250). 마커 hover → 위에 툴팁(상호 / 대표 메뉴 두 줄 — 가운데 점으로 잇지 않는다). `pointerType === "mouse"`만 반응(터치 탭의 에뮬레이션 hover 무시). 툴팁은 마커 mouseout·지도 dragstart·idle에 닫힘. 툴팁 위치는 `map.getProjection().fromCoordToOffset` 컨테이너 px | design 6 |
| 데스크탑 판정 | 레이아웃은 **CSS만**(`lg:` 유틸 + globals.css `@variant lg` 블록 — `.saeu-sheet`는 unlayered CSS라 유틸이 못 덮는다). 데스크탑 전용 요소(브랜드 행 [＋ 제보]·줌 컨트롤·툴팁)만 `useMediaQuery("(min-width: 1024px)")`(useSyncExternalStore, 서버 스냅샷 false). 지도 기하(중심 y·fitBounds 마진·드래그 무시)는 핸들러 안에서 `isDesktopViewport()` 즉시 판정 — 구독·하이드레이션 불일치 없음. 상수는 `lib/layout.ts` 한 곳(Tailwind `--breakpoint-lg` 64rem과 같음을 주석) | 권고 |
| 검색·칩 | 데스크탑에서도 목록·상세 모드에 보이고 제보·내 활동엔 숨김 — 모바일과 같은 규칙(네이버지도 PC·카카오맵 PC 둘 다 상세에서 검색 바 유지). 패널 안이라 `lg:shadow-none`(그림자는 지도 위 요소만), 칩은 `lg:flex-wrap`(두 줄) | 권고 |

---

## 디자인 언어 — 화면 6~9 v2 (전문은 design.md에 쓴다; 1440×900 기준, 1024부터 적용)

- **그릇**: `lg:flex` — 왼쪽 패널 `w-100`(400px, 스페이싱 스케일) 흰 표면 + 오른쪽 헤어라인, 나머지 전부 지도. 지도 위에 뜨는 것 없음(검색·칩 전부 패널 안). 패널 안 순서: **브랜드 행**(56: 왼쪽 "새우맵" 워드마크 = 지금 sr-only h1을 `lg:not-sr-only`로, title-s-semibold 잉크 / 오른쪽 [＋ 제보] 레드 pill — 목록 모드만, 화면 유일 채운 레드) → 검색 바(h-12 pill, 프로필 버튼은 모바일과 같이 바 오른쪽 끝) → 칩 행(두 줄 랩) → 시트 헤더 그대로("마포구 일대 12곳" + "가까운순 ▾" / 시즌 카운터 캡션, 아래 헤어라인) → 이벤트 행 → 카드 리스트(패널 내부만 스크롤, 카드 hover `bg-bg-dim`, 선택 `bg-bg-sunken`) . 핸들·FAB 줄은 lg에서 숨김.
- **지도(오른쪽)**: 우하단 세로 스택 — 줌 [+]/[−](흰 40×40 두 칸, 라운드 8, 헤어라인, shadow-fab) 그 아래 현위치 원(모바일과 같은 컴포넌트). 마커 hover 툴팁: 흰 카드(라운드 8, 헤어라인, shadow-card, px-3 py-2) "나라수산"(body-m-semibold) / "생새우소금구이 1kg 60,000원"(caption-l fg-secondary), 마커 위 8px.
- **화면 7 상세(패널 전환)**: 브랜드 행·검색·칩은 남고 시트 헤더가 **[‹ 목록]**(44, 왼쪽, 아이콘 + 텍스트) 한 줄로 바뀐다(✕는 lg에서 숨김 — 같은 `onDismiss`). 이하 화면 2의 1~9 그대로 400px에(사진 스트립 176 타일 2장 보임, 주소 접힘 기본, 버튼 줄 3등분, [길찾기]만 채운 레드 — 그래서 브랜드 행 [＋ 제보]는 상세에선 숨긴다). 지도는 선택 마커 강조만(팝오버 없음).
- **화면 8 제보(패널 전환)**: 헤더 ✕("제보 그만두기") + StepFrame(진행 세그먼트·‹·제목·본문·바닥 CTA) 그대로. 2단계는 본 지도에 핀·탭·중복 후보 fitBounds — 마진만 데스크탑 값. 검색·칩·[＋ 제보]는 숨김(모바일과 같은 규칙).
- **화면 9 내 활동(패널 전환)**: 헤더 ✕ + 프로필 행·세그먼트·탭 본문·로그아웃/탈퇴 그대로. 지도는 활성 탭 가게만(Phase 4 규칙 유지, 하트 뱃지는 하지 않는다 — 재검토 종결).
- **오버레이 480**: `ModalSheet`(로그인·사유·신고·탈퇴)는 lg에서 딤 위 중앙 `w-120` 카드(라운드 16, pb 20) — 딤 버튼은 `absolute inset-0`, 내용은 모바일 `mt-auto` / 데스크탑 `m-auto`. 리뷰 폼 `.saeu-overlay-screen`은 lg에서 `inset:0; margin:auto; width:480px; max-height:90dvh; border-radius:16px` + 딤 40%.
- **로딩 스켈레톤**: 홈은 같은 lg 배치(패널 스켈레톤 + 지도 회색). `/place/[id]`·`/gu/[name]`엔 스켈레톤 없음(404 결정).
- **확인 뷰포트**: 1440×900 · 1280×800 · 1024×768 + 회귀 390×702 · 320×480.

## 목표 화면 (1440×900)

```
┌──────────────400──────────────┬────────────────────────────────────────────────┐
│ 새우맵                [＋ 제보] │                                                │
│ (🔍 가게·동네 검색        (👤)) │                                                │
│ [전체▾][머리버터구이][라면]      │        지도 (마커: 코랄 7 · 틸 3 · 점선 1)      │
│ [볶음밥][찜한 곳]               │                                                │
│ ── 마포구 일대 12곳   가까운순▾ │            ┌ 나라수산            ┐              │
│ ● 오늘 6건 확인됐어요 │ 이번주 47│            │ 생새우소금구이 1kg… │  ← hover 툴팁 │
│ ▣ 나라수산            어제 확인 │            └─────────▽───────────┘              │
│   850m · 마포구 · 새우구이       │                    (◉)  ← 카드 hover로 커진 마커│
│ ▣ 365활새우 창우수산  3주 전 확인│                                                │
│ ▣ 수성2호…          새로 제보됨 │                                          [+]   │
│ ▣ 청춘조개포차 신촌점 5일 전 확인│                                          [−]   │
│   …(패널 내부 스크롤)           │                                          (⌖)   │
└───────────────────────────────┴────────────────────────────────────────────────┘
상세: 헤더 "‹ 목록" → 화면 2 본문        제보/내 활동: 헤더 ✕ → 패널 본문        로그인·리뷰 폼: 딤 + 중앙 480 카드
```

---

## 변경

### 1. 문서 먼저 — `docs/design.md` 화면 6~9 v2 + 정정
- 화면 6~9 블록을 위 디자인 언어로 재작성(v1 배너 제거). 공통 블록에 "데스크탑(1024~) 그릇" 문단 한 개(패널 400·지도 컨트롤·오버레이 480·호버 규칙) 추가.
- `docs/decisions.md` 2026-09-07 항목: ① 데스크탑 그릇(단일 DOM + CSS lg, 제보는 패널, 오버레이만 480 모달, 줌 컨트롤 추가, 푸터 링크 삭제, 호버 규칙) ② 진짜 404 = 로딩 경계 제거(OpenNext Node middleware 미지원 근거) + 루트 not-found ③ `/gu/[name]` = 같은 지도 화면 + SSR 목록 + 25구 화이트리스트 ④ OG(next/og, Pretendard subset woff, ASSETS 바인딩, 워커 크기 수치) ⑤ `SITE_URL` 서버 env ⑥ Lighthouse 예산 수치·근거.
- `CLAUDE.md` UI 완성 기준: "플로우는 중앙 모달 480px" → "제보는 패널, 로그인·리뷰·확인 시트는 중앙 모달 480"; 확인 뷰포트에 데스크탑 3종 추가. `docs/roadmap.md` Phase 5 "(proxy)" 정정. `docs/spec.md` 4.6은 그대로(proxy 언급 없음).
- 플랜은 `docs/plans/phase5-desktop.md`로 cp.

### 2. 레이아웃 기반 — `lib/layout.ts` · `components/ui/use-media-query.ts` · `app/globals.css` · `bottom-sheet.tsx`
- `lib/layout.ts`: `DESKTOP_MEDIA_QUERY = "(min-width: 1024px)"`(= Tailwind `--breakpoint-lg` 64rem), `isDesktopViewport()`.
- `use-media-query.ts`: `useSyncExternalStore`(matchMedia change 구독, 서버 스냅샷 false).
- globals.css `@variant lg` 블록: `.saeu-sheet { position: static; transform: none; height: auto; flex: 1 1 0; min-height: 0; border-radius: 0; box-shadow: none; transition: none }`, `.saeu-sheet__header { height: auto }`, `.saeu-sheet__body { height: auto; flex: 1 1 0; min-height: 0 }`, `.saeu-overlay-screen { … 480 중앙 }`, `.saeu-marker--hovered`.
- `bottom-sheet.tsx`: 핸들 버튼 `lg:hidden`; `onHeaderPointerDown`/`onBodyPointerDown`에서 `isDesktopViewport()`면 return(드래그 없음); 상세 모드에 데스크탑 전용 [‹ 목록] 버튼(`hidden lg:flex`, aria-label "목록으로") + ✕ `lg:hidden`(상세만); 목록 헤더 `lg:border-b` 유지; aside 래퍼 `lg:hidden`.
- `map-screen.tsx`: 루트 `lg:flex`; 지도 래퍼 `lg:static lg:order-last lg:min-w-0 lg:flex-1 lg:relative`; **패널 래퍼 신설** `contents lg:flex lg:h-full lg:w-100 lg:shrink-0 lg:flex-col lg:border-r lg:border-line-hairline lg:bg-bg`가 topStack + PlaceSheet를 감싼다(모바일은 `display: contents`라 기존 absolute/fixed 그대로). topStack `lg:static lg:pointer-events-auto`; 브랜드 행(`isDesktop &&`): h1 워드마크(`sr-only lg:not-sr-only`) + `mode === "list"`일 때 [＋ 제보](Button brand pill). FabRow는 `!isDesktop &&`(+ 래퍼 `lg:hidden`).
- `fab-row.tsx` → `LocateButton` 분리(`components/map-screen/locate-button.tsx`), FabRow가 그것을 쓴다. `components/map/map-controls.tsx`(신규, 데스크탑 전용): [+][−] + LocateButton, `absolute right-5 bottom-5`. `MapHandle.zoomBy(delta)`.
- `app/(home)/loading.tsx`: lg 배치 스켈레톤.

### 3. 패널 전환 · 오버레이 · 지도 기하 — `use-map-screen.ts` · `modal-sheet.tsx` · `review-form.tsx`
- `visibleStripCenterY`·초기 팬·`submitSearch`·`showReportPair`: `isDesktopViewport()`면 지도 컨테이너 중심/대칭 마진(24·40)으로. 그 외 로직 변화 없음 — 제보·내 활동·상세는 모드만 같고 그릇이 CSS로 바뀐다.
- `ModalSheet`: 딤 버튼 `absolute inset-0`, 내용 `relative mt-auto w-full rounded-t-20 … lg:m-auto lg:w-120 lg:rounded-16 lg:pb-5`. 리뷰 폼 dialog: `lg:backdrop:bg-common-100/40` + CSS 블록.
- `place-sheet.tsx`: 라벨·헤더 전달만(변경 최소). `PlaceCard`: `hover:bg-bg-dim`(hover 미디어에서만 적용) + `onHoverChange`.

### 4. 호버 동기화 — `map-view.tsx` · `marker-icons.ts` · `place-card.tsx` · `use-map-screen.ts`
- 훅: `hoveredId` + `setHoveredId`. 카드 `onPointerEnter/Leave`(mouse만). `MapView` props `hoveredId` → `PlaceMarker hovered` → 아이콘 키에 hovered 포함(캐시), zIndex 250.
- `MapView` 내부 상태 `tooltip: {place, x, y} | null`: Marker `onMouseover`(projection offset 계산)·`onMouseout`, 지도 `dragstart`·`idle`에 닫힘. `MarkerTooltip` 컴포넌트를 Container 형제(`relative` 래퍼) 안 `absolute pointer-events-none`으로. 텍스트는 React가 그린다(innerHTML 아님 — 규칙 6·마커 XSS 가드 유지).
- 테스트 Marker 목에 `onMouseover/onMouseout` → `onMouseEnter/onMouseLeave` 전달, `icon.content`로 hovered 클래스 확인.

### 5. 라우트 — `app/(home)/` · `app/place/[id]` · `app/gu/[name]` · `app/not-found.tsx` · `app/sitemap.ts` · `app/robots.ts` · `lib/seo.ts` · `lib/gu.ts` · `lib/data.ts` · `lib/env.ts`
- `git mv app/page.tsx app/(home)/page.tsx`, `app/loading.tsx → app/(home)/loading.tsx`. `app/place/[id]/loading.tsx` 삭제. `app/place/[id]/page.tsx`: `generateMetadata`(lib/seo) + 주석 정정(404 실측).
- `app/gu/[name]/page.tsx`: `decodeURIComponent` → `isSeoulGu` 아니면 `notFound()`; `getPlaces({gu}, now)` + `getGuCenter(name)` → `<MapScreen initialGu={{ name, placeIds, center }} …>`; `generateMetadata`. `not-found.tsx`("이 구는 아직 없어요"? → 서울 25구 밖은 "찾을 수 없는 지역이에요" + [지도로 돌아가기]).
- 훅: `initialGu` → 뷰포트 전엔 `inView = 그 구 가게`·`status = "ready"`; 첫 idle에 `fitBounds`(0곳이면 `focus(center, 13)`). `MapScreenProps.initialGu`.
- `lib/gu.ts`: `SEOUL_GU`(25), `isSeoulGu`, `guCenter(name)`(경계 링 평균, 동적 import). `lib/data.ts`: `getGuCenter` 래퍼(규칙 1). `lib/seo.ts`: `placeMeta`, `guMeta`, `SITE_NAME`, `siteUrl()`. `lib/env.ts` server `SITE_URL`(url, optional).
- `app/layout.tsx`: `metadataBase`, `title.template`, `openGraph` 기본. `app/not-found.tsx`. `app/sitemap.ts`(/ + places + 25 gu, lastModified), `app/robots.ts`.

### 6. OG — `app/opengraph-image.tsx` · `app/place/[id]/opengraph-image.tsx` · `app/gu/[name]/opengraph-image.tsx` · `components/og/share-card.tsx` · `lib/og/font.ts` · `public/fonts/og/`
- `share-card.tsx`: satori용 JSX(flex만, 인라인 스타일 — 토큰 값은 hex 그대로 주석으로 출처 표시; Tailwind 클래스는 satori에 안 먹는다) — 루트/핀/구 3변형을 props로.
- `lib/og/font.ts`: ASSETS 바인딩 → fs 폴백, 모듈 캐시. Bold·Regular subset.woff를 `node_modules/pretendard/dist/web/static/woff-subset/`에서 `public/fonts/og/`로 복사(라이선스 SIL OFL, 헤더 주석).
- `opennextjs-cloudflare build` 후 gzip 총량 확인 → 결과에 기록.

### 7. CI — `.github/workflows/ci.yml` · `lighthouserc.json`
- 스모크 확장: `/place/nope` → **HTTP 404**, `/gu/%EB%A7%88%ED%8F%AC%EA%B5%AC` 200 + "마포구", `/gu/nope` 404, `/sitemap.xml` 200 + `/gu/`, `/place/p018/opengraph-image` 200 + `image/png`, `/opengraph-image` 200.
- Lighthouse 스텝(같은 wrangler dev): `npx @lhci/cli@0.15.1 autorun --config=lighthouserc.json`, 결과 `.lighthouseci/` 아티팩트(`actions/upload-artifact` SHA 핀). preview 잡에 `SITE_URL` env.

### 8. 보정 + 감사 + PR
- Playwright 1440/1280/1024 + 390×702·320×480 회귀, workerd `pnpm preview` 라우트 한 바퀴, LHCI 로컬 실측으로 예산 확정.
- gap-sweeper(roadmap Phase 5 + spec 4.6 + design 화면 6~9 v2 + 공통 블록 데스크탑 문단) → 미구현 0. security-reviewer(신규 서버 입력: `[name]` 디코딩·화이트리스트, OG 라우트 파라미터, sitemap URL 조합, 메타 문자열).
- roadmap 체크 + 플랜 "## 결과" + push·PR → 프리뷰 URL.

## 변경 파일

| 영역 | 파일 |
|---|---|
| 문서 | `docs/design.md` `docs/decisions.md` `docs/roadmap.md` `CLAUDE.md` `docs/plans/phase5-desktop.md` |
| 레이아웃 | `lib/layout.ts`(신규) `components/ui/use-media-query.ts`(신규) `app/globals.css` `components/ui/bottom-sheet.tsx` `components/ui/modal-sheet.tsx` `components/review/review-form.tsx` `components/map-screen/{map-screen,place-sheet,fab-row,place-card}.tsx` `components/map-screen/locate-button.tsx`(신규) `components/map/map-controls.tsx`(신규) `components/map/map-view.tsx` `components/map/marker-icons.ts` `components/map-screen/use-map-screen.ts` |
| 라우트 | `app/(home)/{page,loading}.tsx`(이동) `app/place/[id]/{page,not-found}.tsx` `app/place/[id]/loading.tsx`(삭제) `app/gu/[name]/{page,not-found,opengraph-image}.tsx`(신규) `app/{not-found,sitemap,robots,opengraph-image}.tsx`(신규) `app/place/[id]/opengraph-image.tsx`(신규) `app/layout.tsx` |
| lib | `lib/seo.ts`(신규) `lib/og/font.ts`(신규) `lib/gu.ts` `lib/data.ts` `lib/env.ts` `lib/types.ts`(없음 — `initialGu`는 컴포넌트 props 타입) `components/og/share-card.tsx`(신규) `public/fonts/og/*.woff`(신규 2) |
| CI | `.github/workflows/ci.yml` `lighthouserc.json`(신규) |
| 테스트 | `components/ui/__tests__/{bottom-sheet,modal-sheet}.test.tsx` `components/map-screen/__tests__/{map-screen,place-card}.test.tsx` `components/map/__tests__/marker-icons.test.ts` `lib/__tests__/{gu,data,seo,layout}.test.ts` |

## 검증

1. 단위마다 `pnpm typecheck && pnpm lint && pnpm test 2>&1 | grep -E 'FAIL|✗|error' | head -40`.
2. `pnpm dev` + Playwright MCP **1440×900 / 1280×800 / 1024×768**: 패널 400 + 지도, 브랜드 행·검색·칩 두 줄·헤더·카드 4장 이상, 카드 hover → 마커 확대, 마커 hover → 툴팁, 카드 클릭 → 패널 상세 + 마커 선택 + 지도 이동(중심 = 지도 컬럼 중앙), [‹ 목록] → 목록(스크롤 복원), [＋ 제보] → 패널 제보 1~4·2단계 핀 탭·중복 후보 → 등록 → 상세, 프로필 → 로그인 480 모달 → 내 활동 패널, 상세 [리뷰 남기기] → 리뷰 폼 480 모달, 줌 ±·현위치. **회귀 390×702 · 320×480**: 시트 드래그·FAB·검색 pill 그대로, 브랜드 행·줌 컨트롤 없음.
3. `pnpm preview`(workerd :8787): `curl -o /dev/null -w '%{http_code}'`로 `/` 200 · `/place/p018` 200(상호) · `/place/nope` **404** · `/gu/마포구` 200(상호 SSR) · `/gu/nope` 404 · `/sitemap.xml` · `/robots.txt` · `/opengraph-image`·`/place/p018/opengraph-image`·`/gu/마포구/opengraph-image` `image/png`(파일로 받아 눈으로 확인). `curl /place/p018 | grep og:title`. 빌드 로그의 워커 gzip 총량 기록.
4. LHCI 로컬 1회(`npx @lhci/cli@0.15.1 autorun` against :8787) → LCP 수치로 예산 확정.
5. gap-sweeper·security-reviewer 각 1회, "표 40줄 이내".
6. **push + PR**: 플랜 승인을 push 승인으로 본다(완료 조건이 프리뷰 URL). 브랜치 `feat/phase5-desktop`(origin/main 742746a에서 이미 생성). PR → preview 잡 → https://preview-saeu-map.saeu-map.workers.dev 에서 3·2를 다시 확인 후 URL 보고. 머지는 사용자.

## 커밋 단위 (한 턴 = 한 커밋)

1. `docs`: design 화면 6~9 v2 + 공통 블록 데스크탑 문단 + decisions 6항목 + CLAUDE.md·roadmap 정정 + 플랜 cp
2. `feat(layout)`: lib/layout·useMediaQuery·시트 lg CSS·패널 래퍼·브랜드 행·LocateButton 분리·MapControls(zoomBy)·홈 스켈레톤 + 테스트
3. `feat(desktop)`: 상세 [‹ 목록] 헤더·지도 기하 lg 분기·ModalSheet/리뷰 폼 480 + 테스트
4. `feat(hover)`: hoveredId·마커 hovered 아이콘·툴팁 + 테스트
5. `feat(routes)`: (home) 그룹·404·루트 not-found·/gu/[name]·initialGu SSR 목록·lib/seo·metadata·sitemap·robots·SITE_URL + 테스트
6. `feat(og)`: share-card·폰트 로더·OG 라우트 3종 + 워커 크기 확인
7. `ci`: 스모크 URL 확장 + Lighthouse(lighthouserc·아티팩트·SITE_URL)
8. `fix`/`docs`: Playwright·workerd·LHCI 실측 보정 + gap-sweeper·security-reviewer 반영 + roadmap 체크 + 플랜 결과 → push·PR

## 범위 밖 (기록)
- 다크 모드(Semantic 두 번째 벌)·태블릿(768~1023) 전용 배치 — 없음(1023까지 유동 모바일, 1024부터 패널).
- OG 카드에 가게 사진·새우 로고 — 에셋 대기(decisions 커스텀 에셋 목록).
- `/test` 라우트·도메인·서치어드바이저 등록 — Phase 7. ISR/캐시(revalidate)·R2 incremental cache — Phase 6(decisions 2026-09-01 비용 방어 정책 재확인 시점은 Phase 6 백엔드 교체).
- 키보드 단축키·포커스 링 정리 — 백로그.

## 결과 (2026-09-07)

**완료.** PR [#9](https://github.com/seomsoo/saeu-map/pull/9), 브랜치 `feat/phase5-desktop`.

| 항목 | 결과 |
| --- | --- |
| 갭 스윕 | **미구현 0건** / 부분 1건(같은 날 수정 5292fbd) · 모호 1건(같은 날 확정 — 제보 CTA 색) · 범위 밖 2건(서치어드바이저·테스트 결과 카드 = Phase 7) |
| 테스트 | 377 → **407개** (28 파일) |
| 보안 리뷰 | 1차(03f54ce) SITE_URL 런타임 도달·http(s)만·프리뷰 robots disallow·persist-credentials 4건 + OG CPU 10ms 1건(aac0f74) 반영, 2차(구 슬러그 라우트 diff) 취약점 0·낮음 1 반영(4e9f2ce) |
| Lighthouse(로컬 workerd 3회 중앙값) | `/` LCP 8.1~8.7s · `/place/p018` 4.2s(첫 사진 priority 전 8.0s) → 예산 LCP error 12s + performance warn 0.5 |
| 워커 크기 | handler.mjs gzip **1.62MB**(Free 상한 3MB, 예상 2.0~2.3MB보다 작음 — 폰트는 번들 밖 `public/fonts/og/`) |
| OG 카드 | 75장(가게 49 + 구 25 + 루트 1) 빌드 시 생성, workerd 정적 서빙 ~5ms, 모르는 id·슬러그 404 |
| 확인 뷰포트 | Playwright 1440×900 · 1280×800 · 1024×768 · 1023(경계) + 390×702 · 320×480, workerd(:8787) 스모크 한 바퀴(CI와 같은 절차) |

**계획에서 바뀐 것**
- **OG 카드는 요청 시 렌더가 아니라 빌드 시 생성.** security-reviewer가 Workers Free의 요청당 CPU 10ms에 satori+resvg가 걸린다고 잡았다. `generateStaticParams` + `dynamicParams=false`, `open-next.config.ts`에 `staticAssetsIncrementalCache`, `preview/upload/deploy`가 캐시를 채우고 CI 스모크는 `populateCache local`을 따로 부른다. 대가로 카드의 상대 시간("어제 확인")을 뺐다. 구 카드는 한글 세그먼트 프리렌더 키와 퍼센트 인코딩 요청 경로가 어긋나 정적 서빙에서 404라 `app/og/gu/[slug]`(로마자 25개)로 굽고 `guMeta`가 `openGraph.images`로 가리킨다. (decisions 2026-09-07)
- **Lighthouse 예산은 초안(LCP error 4s/warn 2.5s)이 아니라 실측 뒤 error 12s + perf warn 0.5.** 4× CPU 스로틀에서 셸 부트업이 LCP를 지배해 web.dev "good"은 백로그(런칭 전 실기기 4s 초과 시). 같은 실측이 상세 첫 사진 `priority` 개선 1건을 잡았다.
- **`SITE_URL`은 빌드 env만이 아니라 워커 vars/`--var`로도** 줘야 런타임(metadataBase·sitemap)에 닿는다 — security-reviewer 1차.
- vitest.setup의 matchMedia 스텁이 죽어 있던 것을 고쳤고(하네스 발화 검증 사례), `/gu/[name]` 진입 시 검색어를 구 이름으로 보정했다 — 둘 다 decisions 2026-09-07.

**갭 스윕이 잡은 것**
1. 부분: 사진 신고 시트가 데스크탑에서 뷰어 폭 전체 바텀시트였다 — 공통 블록 오버레이 목록(로그인·리뷰 폼·사유·**사진 신고**·탈퇴)대로 lg에서 딤 40% + 중앙 480(5292fbd).
2. 모호: 제보 1단계 [새로 등록하기]가 채운 레드(모든 단계 `variant="brand"`)인데 화면 3 "단계마다 CTA 하나가 채운 레드"와 이번 v2 화면 8 "2단계만 채운 레드"가 충돌 — **화면 3대로 확정**(사용자), 화면 8·공통 블록 문장 정정 + decisions 기록. 코드 변경 없음.

**남은 것**: Phase 7(서치어드바이저·`/test`·도메인), Phase 6(ISR/R2 캐시), 백로그(LCP 셸 개선 — 청크 분할·폰트 preload, 키보드 단축키·포커스 링, 다크 모드·태블릿 전용 배치 없음 유지).

