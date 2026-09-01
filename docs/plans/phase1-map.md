# Phase 1 — 지도 메인 (spec 4.1 · design 화면 1)

## Context

Phase 0에서 네이버 지도에 목 핀 50개가 뜨는 페이지와 개발 하네스가 완성됐다. Phase 1은 그 위에 **지도 메인 화면 전체**(design 화면 1의 1~9)를 올리고, 첫 PR과 함께 **자동 배포 배선**(main→deploy / PR→프리뷰)을 발화 검증하는 단계다. 완료 조건은 roadmap Phase 1: "design 화면 1의 1~9 전부 존재, 320/390/430 확인, 스모크 통과, 갭 스윕 미구현 0건".

### 플랜 모드에서 사용자와 확정한 결정 (docs에 없던 것 — 실행 시 decisions.md에 기록)
1. **위치 폴백**: 첫 로드 시 조용히 위치 요청. 허용 → 내 위치 기준 거리 표시·정렬. 거부/실패 → 카드에 '구'만(거리 숨김), "가까운순"은 **지도 중심 기준**.
2. **목 날짜 상대 이동**: lib/data.ts(목 레이어) 안에서만 JSON 기준일 2026-08-29를 오늘(Asia/Seoul)로 맞춰 `places.lastCheckedAt/createdAt`, `checkins.at`, `reviews.at` 전부를 같은 일수만큼 이동. 6개월 무활동 표본으로 2곳은 약 7개월 전으로 별도 지정.
3. **프리뷰 URL**: `wrangler versions upload --preview-alias preview` → 고정 `https://preview-saeu-map.saeu-map.workers.dev`. NCP 콘솔에 1회 등록.
4. **`needsReview: true` 가게는 숨김** (data.ts에서 제외, 검수 후 false면 자동 노출).
5. **비서울(김포시 등) 노출** — spec 1 "시드 452곳으로 열고".
6. **이벤트 카드 링크 `/test`** 유지, Phase 7까지 404 허용.

## 주요 의존성 (추가·변경)

| 패키지 | 버전 | 근거 |
|---|---|---|
| supercluster | **8.0.1 (핀)** | Mapbox제 **마커 묶음 계산기**(지도 SDK 독립 순수 함수): 좌표를 넣고 `getClusters(bbox, zoom)`을 부르면 가까운 핀은 "N개" 뭉치로, 나머진 단독으로 돌려줌. 네이버 SDK엔 내장 없음(공식 예제는 npm 없는 JS 파일 복사). 주 910만 DL, 의존성 1개, ~10KB. 9.0.0이 2026-08-10 **메이저 직후** → 정책대로 한 마이너 대기. ESM only(Next·vitest 무관). |
| @types/supercluster | 7.1.3 | 8.x와 API 동일 |
| @iconify/tailwind4 (dev) | 1.2.3 | coolicons를 **빌드 타임 CSS mask**로. 쓴 아이콘만 포함, 런타임 외부 요청 없음. 주 13만 DL. |
| @iconify-json/ci (dev) | 1.2.2 | coolicons 데이터 442개 |
| eslint-import-resolver-typescript (dev) | 4.4.5 | **boundaries 린트가 `@/` 별칭 import를 external로 오인해 현재 미발화** (리뷰에서 확인: `isUnknown: true`). 이걸로 절대 규칙 1이 처음으로 기계 강제됨. 주 4,400만 DL. |
| @vitejs/plugin-react (dev) | 6.1.1 | tsconfig `jsx: preserve` 때문에 Vite 8이 `.tsx` 테스트를 거부. 우선 vitest 설정의 JSX 오버라이드(무의존)로 시도하고, 안 되면 이 플러그인. |
| ~~@iconify/react~~ | 제거 | 미사용. 기본 동작이 api.iconify.design **런타임 fetch**라 외부 도메인 금지 취지와 충돌. |

바텀시트는 **직접 구현**(vaul 미채택: 항상 열린 비모달 시트 + Phase 2 드래그 확장·스와이프 닫기까지 제어권 필요, 1.1.2가 2024-12 이후 무업데이트).

## 파일 구조

```
app/
  page.tsx                 # 수정: async 서버 컴포넌트. await connection() → 요청 시 렌더. now(ISO)·places·stats·eventCard → <MapScreen>
  loading.tsx / error.tsx  # 신규: 라우트 로딩 스켈레톤 / 에러(retry) — ui 공용 컴포넌트 재사용
  globals.css              # 수정: 토큰 추가, @plugin "@iconify/tailwind4", 마커 CSS 클래스
lib/
  types.ts                 # 수정: SortKey/TabKey/ChipKey/EventCard/SeasonStats/LatLng/ViewportLiteral 추가
  data.ts                  # 수정: 전부 async · 목 날짜 이동 · needsReview 제외 · isNew=createdAt 7일 파생 · getSeasonStats/getEventCard/getBookmarkedPlaceIds
  time.ts                  # 신규: Asia/Seoul 고정 — kstDate, startOfWeekKst(월), relativeCheckLabel, isInactive6m, daysDiff (Intl, 라이브러리 없음)
  geo.ts                   # 신규: haversineKm, formatDistance(850m/1.2km), SEOUL_CENTER, inBounds(literal)
  places.ts                # 신규: filterPlaces, sortPlaces(3종+타이브레이커), primaryMenu, unitChipLabel, markerCategory — naver 전역 미사용
  cluster.ts               # 신규: supercluster 래퍼(extent 256·radius 60·maxZoom 16) → {cluster|place}[] — naver 전역 미사용
  mock/places.json         # 수정: 2곳 lastCheckedAt ~7개월 전
  mock/event-card.json     # 신규: {title, href:"/test", startsAt, endsAt}
  __tests__/               # time·geo·places·cluster·data (data.test는 async로 재작성)
components/
  ui/bottom-sheet.tsx      # 스냅 collapsed/half(40%)/full, 핸들·헤더 드래그(pointer events), 내부 리스트 스크롤
  ui/chip.tsx              # cva: outline 기본 / 활성 잉크 채움 / mini(곁들임·단위)
  ui/skeleton.tsx · empty-state.tsx · error-state.tsx · error-boundary.tsx
  map/naver-map-provider.tsx   # 유지
  map/map-view.tsx         # 신규(map-with-markers.tsx 삭제): Container(fallback=스켈레톤) + NaverMap + 마커/클러스터 + onIdle→viewport literal + ref
  map/marker-icons.ts      # HtmlIcon 객체 캐시(key: category|new|inactive|selected|count) — 이름 등 문자열 절대 미삽입
  map-screen/map-screen.tsx · use-map-screen.ts
  map-screen/top-bar.tsx(1) · search-bar.tsx(2) · season-counter.tsx(3) · event-card.tsx(4)
  map-screen/filter-tabs.tsx(5) · filter-chips.tsx(6) · place-sheet.tsx(8) · sort-menu.tsx(8) · place-card.tsx(9)
vitest.config.ts           # 수정: JSX 오버라이드(또는 plugin-react), setupFiles(jest-dom/vitest + jsdom 스텁)
eslint.config.mjs          # 수정: import/resolver typescript · boundaries에 mock 요소 추가(lib/mock은 lib/data.ts만 import)
.github/workflows/ci.yml   # 수정: preview·deploy 잡
docs/plans/phase1-map.md · docs/decisions.md · docs/roadmap.md · docs/plans/phase0-scaffold.md(iconify 변경 주석) · CLAUDE.md(배포 줄)
```

## 설계 요점

### 렌더 모델 (리뷰에서 잡은 핵심 리스크)
- **page.tsx는 요청 시 렌더**(`await connection()`): 현재는 정적 프리렌더라 목 날짜 이동·"이번 주"·"○일 전"이 **배포 시각에 고정**된다. 목 단계에선 동적 렌더가 맞고, Phase 5~6 캐시(on-demand ISR)는 decisions.md 원칙대로 그때 설계. decisions.md에 기록.
- **`now`는 서버가 ISO로 내려주고 클라이언트는 `new Date()`를 렌더 중 호출하지 않는다** (Workers UTC vs 클라이언트 KST 하이드레이션 불일치 + react-hooks 7 purity 룰). 모든 상대 라벨·6개월 판정·시즌 카운터는 `now` 인자.

### 데이터 계층 (lib/) — 컴포넌트는 data.ts 함수만
- 함수 전부 `Promise` (Supabase 교체 시 시그니처 불변).
- 목 날짜 이동은 date-only `"2026-08-25"`(KST 달력일)를 **UTC ISO**로 변환해 내보냄 → `Place.lastCheckedAt`이 컨벤션("저장은 UTC ISO")과 일치. `isNew`는 정적 플래그 대신 이동된 `createdAt` 기준 7일 이내로 파생(spec 5). `// 목 전용 — Supabase 교체 시 삭제`.
- `getSeasonStats(now)`: 이번 주(월 00:00 KST~) 확인 **가게 수**(distinct placeId) · 오늘 **건수** · 최다 확인 가게(동률 → 최근 확인이 늦은 쪽). checkins 이벤트에서 계산(spec 6).
- `getEventCard(now)`: 기간 내면 카드, 아니면 null.
- `getBookmarkedPlaceIds()`: 빈 메모리 Set (Phase 4에서 토글).
- `places.ts`: 탭=다중 태그(all/grill/raw) · 칩 AND · 검색=상호·구·지번 동(공백 제거·소문자). 정렬 타이브레이커: distance(km↑→name) / recent(lastCheckedAt↓→name) / checks(checkCount↓→lastCheckedAt↓→name) — 42/50이 checkCount 0이라 필수. **대표메뉴** = 가격 있는 첫 메뉴 → 없으면 첫 메뉴 → 메뉴 없으면 줄 숨김, 이름 한 줄 말줄임. **단위 칩** = `unit_raw`+접미(kg→"1kg", g→"500g", pan→"한판", count→"15마리", size→"소"), `none`은 칩 없음. isNew 카드는 오른쪽 슬롯에 "새로 제보됨" 라벨(확인 텍스트 대신 — design 샘플 순서 그대로).

### 마커 (색점·클러스터링·신규 점선·6개월 투명도)
- `Marker` + `HtmlIcon`. **아이콘 객체는 키별 캐시**(react-naver-maps가 `===` 비교로 매 렌더 `setIcon` → DOM 재생성 방지), 마커는 `React.memo` + 안정 콜백(onClick 변경 시 재구독됨). 이름은 `title` prop으로만(HtmlIcon content는 innerHTML — 목에 `&amp;` 포함 이름 존재).
- 스타일: globals.css 일반 CSS 클래스(토큰). grill 우선 코랄 / raw 틸 · isNew 점선 · 6개월 무활동 opacity .4 · 선택 1.5배+흰 링+zIndex.
- 클러스터: 필터 결과(선택된 가게는 제외해 항상 단독 표시)로 인덱스 memo → `idle`마다 `Math.floor(zoom)`·bounds literal로 계산. 카운트 원(뉴트럴 서피스+헤어라인+잉크). 탭 → `morph(center, expansionZoom)`.
- `getBounds()`는 `Bounds` 유니온 → LatLngBounds로 좁힌 뒤 **plain literal**로 상태 저장(lib는 naver 전역 무관·테스트 가능). `exactOptionalPropertyTypes` 때문에 `zIndex`·`FitBoundsOptions`는 조건부 스프레드.

### 상호작용 · 시트
- 마커 탭 → 선택 + 카드로 스크롤·하이라이트. 카드 탭 → 선택 + 지도 이동(가시 영역=상단 스택~시트 사이 중앙에 오도록 오프셋). 상세 시트는 Phase 2.
- 프로그램적 이동(`panTo`/`fitBounds`) 다음 `idle`은 **정렬 기준점(지도 중심) 갱신 생략** — 탭한 카드가 손가락 밑에서 이동하는 것 방지. "지도 내 N곳" 집합은 매 idle 갱신.
- 검색: 입력 즉시 필터(150ms 디바운스, IME `isComposing` 가드), Enter → 결과 `fitBounds`(top/bottom 여백). 비우기 ×.
- 4상태: 첫 idle 전 **스켈레톤**(Container fallback + 리스트 스켈레톤; `idle` 미발화 대비 `onInit` 폴백) / **빈**: 지도 내 0곳·검색 0곳 "이 동네엔 아직 없어요 · 제보해주세요 [+ 제보]", 찜 칩 "아직 찜한 곳이 없어요" / **에러**: 지도 스크립트 실패(`useNavermaps`의 `use(promise)` → ErrorBoundary) + NCP 인증 실패(SDK의 `window.navermap_authFailure` 콜백 → 같은 에러 상태; 스크립트는 정상 로드되므로 ErrorBoundary로는 안 잡힘) + 라우트 `error.tsx` / **정상**.
  - 검증용 트리거: 에러 = Playwright로 SDK 스크립트 요청 차단 + dev 전용 `?mock=error`(page.tsx, production 무시) → error.tsx. 빈 = 검색 "없는동네".
- 시즌 카운터 세그먼트 3개(spec) 한 줄, 320px에선 말줄임. 이벤트 카드 닫기 = 메모리만(규칙 4, 새로고침 시 재노출).
- [+ 제보]: 레드 유지, 탭 시 2초 인라인 메시지 "제보는 준비 중이에요"(Phase 3 연결). 전역 토스트는 Phase 2에 도입.
- **320px 예산**: 상단 스택(1~6) ≤ 220px 목표(카운터 24px·이벤트 32px·탭/칩 각 36px), 칩 가로 스크롤. 뷰포트 높이 < 640px이면 시트 기본 스냅 collapsed(헤더만). 스크린샷으로 확인.
- 접근성: 탭·칩 `button aria-pressed`, 정렬 `aria-haspopup="listbox"` + `role=listbox/option`, 터치 44px.

### 스타일
- 토큰 추가: `--color-ink-tertiary`, `--color-chip-active`, `--color-sheet-shadow`, `--color-marker-ring`, `--radius-chip`. 하드코딩 색 0(기존 map-with-markers 리터럴 제거).
- 숫자 `tabular-nums`. 액센트는 [+ 제보] 한 곳. 카테고리색은 마커·카드 색점(6px)만.
- 아이콘(설치 후 실존 확인): `ci--search-magnifying-glass`, `ci--close-md`, `ci--add-plus`, `ci--chevron-down`, `ci--chevron-right`, `ci--check`, `ci--navigation`. 없으면 근접 대체 + decisions.md 커스텀 목록.

### 하네스 보강 (리뷰 발견 → 이번 PR에 포함)
- eslint: `import/resolver: typescript` 설정으로 boundaries 발화 + `lib/mock/*`은 `lib/data.ts`(및 lib/mock 내부)만 import 가능. **발화 검증**: 일부러 위반 파일을 만들어 에러 나는지 확인 후 삭제.
- vitest: `.tsx` 테스트 실행 가능하게 + `setupFiles`(jest-dom/vitest, `scrollIntoView`·`geolocation`·`ResizeObserver`·`matchMedia`·`setPointerCapture` 스텁). `react-naver-maps`는 모듈 전체 `vi.mock`.

### 자동 배포 (ci.yml)
```
check (기존, dummy ID 빌드) ─▶ preview (pull_request) : vars ID로 재빌드 → upload --preview-alias preview → PR 코멘트 URL
                            └▶ deploy  (push main)    : vars ID로 빌드 → pnpm run deploy (concurrency: production)
```
- 시크릿 부재 시 **스텝 스킵**(job `if:`는 secrets 접근 불가 → 첫 스텝이 `GITHUB_OUTPUT`으로 게이트) + 안내 로그. `permissions: pull-requests: write`, 액션은 SHA 고정.
- `pnpm deploy`는 pnpm 내장 명령과 충돌 → CI는 `pnpm run deploy/upload`. `opennextjs-cloudflare upload [args..]`가 `--preview-alias`를 넘기는지 실행 시 확인, 안 되면 `build` + `wrangler versions upload` 분리. decisions.md 2026-09-01 자동 배포 항목의 명령을 실제 채택 명령으로 갱신.
- **사용자 선행 작업**: GitHub secrets `CLOUDFLARE_API_TOKEN`("Edit Cloudflare Workers" 템플릿) · `CLOUDFLARE_ACCOUNT_ID`(`6be006db…`, wrangler whoami로 확인됨) / repo variable `NEXT_PUBLIC_NCP_CLIENT_ID` / NCP 콘솔 Web 서비스 URL에 `https://preview-saeu-map.saeu-map.workers.dev` 추가(가이드 "서브 도메인은 대표 도메인만 입력" 규칙상 이미 커버될 수도 — 프리뷰 열어 확인).

## 실행 순서 (로컬 커밋 단위)
1. `chore`: 브랜치 `feat/phase1-map` · 의존성 · globals.css 토큰/아이콘 플러그인 · vitest/eslint 보강(발화 검증) · docs/plans/phase1-map.md
2. `feat(lib)`: time/geo/places/cluster + data.ts(async·날짜 이동·needsReview 제외·isNew 파생·신규 함수) + 테스트
3. `feat(ui)`: bottom-sheet · chip · skeleton/empty/error/error-boundary
4. `feat(map)`: map-view · marker-icons — map-with-markers.tsx 삭제
5. `feat(map-screen)`: 화면 1의 1~9 조립 + page.tsx(connection, now) + loading/error + 컴포넌트 테스트
6. `ci`: preview/deploy 잡 + CLAUDE.md 배포 줄
7. `docs`: decisions.md(결정 6건 + 동적 렌더 + 패키지 + 프리뷰 명령) · roadmap 체크 · phase0 플랜 주석 · 이 플랜 결과 섹션
8. 검증 → 수정 → push·PR

## 검증
1. `pnpm typecheck && pnpm lint && pnpm test` (Stop 훅 동일)
2. `pnpm dev` + Playwright MCP: 390/320/430 스크린샷, 화면 1의 1~9 존재, 콘솔 에러 0. 상호작용: 탭·칩·정렬 3종·검색(fitBounds)·이벤트 닫기·마커/클러스터 탭·카드 탭·시트 드래그·위치 허용/거부 두 경로. 4상태 각각 트리거.
3. `pnpm build` → `pnpm preview`(:8787 workerd) 동일 스모크 — 동적 렌더가 Workers에서 동작하는지.
4. **gap-sweeper**: spec 4.1 + design 화면 1 + roadmap Phase 1 전수 대조 → 미구현 0건까지 반복
5. **reviewer**: 절대 규칙 1~7 · 4상태 · Asia/Seoul · 토큰
6. push + PR(템플릿) — **이 플랜 승인을 push·PR 승인으로 갈음**(아니면 말해달라). CI `check` 초록 · `preview` 잡이 PR에 남긴 **프리뷰 URL**에서 지도·마커 확인(=배선 발화 검증). 시크릿 미등록이면 로컬 `pnpm run upload --preview-alias preview`(이 머신 wrangler OAuth 로그인됨)로 같은 URL 생성해 보고. 머지 후 `deploy` 잡 동작은 머지 승인 시점에 확인.
7. Codex PR 리뷰 발동 확인(Phase 0 미검증) — 코멘트는 사람이 선별, 자동 수정 없음.

## 범위 밖 · 메모
- 카드 탭→상세(Phase 2), 제보 플로우(3), 찜 토글·"새로 들어온 집" 칩→신규 패널 전환(4, 지금은 필터로 동작), 1024px·딥링크·OG(5), 다크 실사용(보류).
- design 샘플 5곳(나라수산 등)은 목 50곳에 없음 — Phase 2 "목업 스크린샷 비교" 때 목 추가 필요. 지금 기록만.

## 리스크
- react-naver-maps `idle` 초기 발화 여부 / `Marker.icon` controlled 반영 — 실행 초반에 확인, 폴백(onInit / key 재마운트) 준비.
- 320px 상단 스택 높이 → 지도 가시 영역 축소. 스냅 규칙·말줄임으로 흡수.
- Stop 훅 120s — 테스트 증가 시 vitest 시간 확인.

---

## 결과 (2026-09-01 완료)

**검증**
- `pnpm typecheck && pnpm lint && pnpm test` 통과 — 테스트 98개(lib 72 + 컴포넌트 26), bottom-sheet 플링 테스트는 Date 가짜 타이머로 결정적(3회 연속 통과).
- Playwright 실측(dev :3000 + workerd 프리뷰 :8787): 390/320/430 스크린샷, 화면 1의 1~9 존재, 탭·칩·정렬 3종·검색(fitBounds)·이벤트 닫기·마커/카드/클러스터 탭·시트 드래그/탭, 4상태(로딩·빈·에러×2·정상), 위치 허용/거부 두 경로. 콘솔 에러 0.
- 갭 스윕(gap-sweeper): 78항목 — 구현 76 / 부분 1 / 미구현 0 / 모호 1. 부분(위치가 SDK보다 먼저 오면 줌 12) → `initialZoom` 가드로 같은 날 수정. 모호("스모크 통과" 정의) → decisions.md에 정의 + CI 스모크 스텝 추가.
- 리뷰어(reviewer): 지적 6건(비결정적 테스트·NCP 인증 실패 미처리·초기 중심 가드·정렬 기준점 플래그·낮은 뷰포트 스냅·단위 칩 "소자") + 체크리스트 3건(터치 타겟·CI 게이트·북마크 전역 주석) 전부 반영.

**계획과 달라진 것**
- `@vitejs/plugin-react` 불필요 — vitest `oxc.jsx.runtime = automatic`으로 해결. `globals: false`라 RTL cleanup은 setup에서 직접 등록.
- boundaries 린트는 v7 문법(요소=폴더, `partialMatch:false`, `lib/data.ts`는 `boundaries/files` 카테고리)으로 재작성. 위반 파일 2개로 발화 검증 후 삭제.
- NCP 인증 실패는 ErrorBoundary가 아니라 SDK의 `window.navermap_authFailure` 콜백으로 잡는다(스크립트는 정상 로드되므로).
- 바텀시트: 스냅 높이는 CSS 변수, 본문 높이는 `flex-1` 없이 CSS가 정함(처음엔 92dvh까지 늘어나 선택 카드 스크롤이 화면 밖으로 갔음). 핸들 탭은 포인터 캡처 때문에 click이 래퍼로 가서 pointerup에서 처리.
- 이벤트 카드 링크는 `prefetch={false}` — `/test` 404가 매 로드 콘솔 에러로 남아서.
- 인증 실패 시 지도를 언마운트하지 않는다: 언마운트하면 SDK `map.destroy()`가 내부 예외를 던져 라우트 에러로 번졌다(:8788 미등록 도메인에서 재현). 에러 상태는 지도 위에 덮는다. 이 상태에선 SDK 내부 예외가 콘솔에 남지만(네임스페이스가 비워진 뒤 마커 정리) 화면·동작에는 영향 없음 — 정상 도메인에선 발생하지 않는다.
- 파비콘 임시 에셋(`app/icon.svg` 색점) 추가 — 404 콘솔 에러 제거. 커스텀 에셋 목록에 기록.
- CI `check`에 workerd 스모크 스텝 추가(빌드 후 `wrangler dev` 기동 → `/` 200 + "새우맵").

**남은 것 (사용자 작업 → 그 다음 PR 재실행으로 발화 검증)**
- GitHub repo secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` / repo variable `NEXT_PUBLIC_NCP_CLIENT_ID` 등록 → `preview` 잡이 PR에 프리뷰 URL 코멘트, 머지 시 `deploy` 잡 동작.
- ~~NCP 콘솔 Web 서비스 URL에 프리뷰 URL 추가~~ → 불필요 확인: 로컬에서 `pnpm run upload --preview-alias preview`로 올린 https://preview-saeu-map.saeu-map.workers.dev 에서 지도·마커 정상 렌더(2026-09-01). 인증 실패가 나더라도 이제 에러 상태로 처리됨.
- PR #2 CI: `check` 통과(스모크 "smoke ok: 64680 bytes"), `preview` 잡은 게이트에서 시크릿 미등록 notice 후 스텝 스킵(설계대로 발화), `deploy`는 main push가 아니라 skipping.
- Codex PR 리뷰 발동 확인은 PR 생성 시점에.
