# Phase 3 — 제보 플로우 (spec 4.3 · design 화면 3)

## Context

roadmap Phase 3: 바텀시트 안 4단계 제보. 지금 [＋ 제보] FAB·빈 상태의 [제보]는 토스트 "제보는 준비 중이에요"(`components/map-screen/map-screen.tsx` `REPORT_NOTICE`)로 막혀 있고, 제보로 생긴 가게가 지도에 뜨는 경로가 없다(`patchPlace`는 교체만 한다). 목표: 가게명 → 위치(핀) → 메뉴 한 줄 → 선택 항목 → 완료 5장면을 **같은 바텀시트** 안에서 돌리고, 제출하면 `lib/data.ts`가 목 `places`에 추가해 마커·목록·상세(신규 배너)에 바로 보이게 한다. 중복 가게는 1단계(상호 자동완성)와 2단계(`same_place` 이식: 150m + 상호 유사도 0.85)에서 기존 상세로 돌린다.

roadmap 규칙대로 **design 화면 3(v1 초안)을 v2 언어로 먼저 재작성**하고 그 문서를 기준으로 구현한다. 화면 8(데스크탑 480 모달)·리뷰 유도의 로그인·Turnstile/속도 제한은 Phase 4~6이라 범위 밖.

**주요 의존성(추가 없음)**: Next 16.3.3 · TS 6.0.3 · Tailwind 4 · zod 4.5.4 · react-naver-maps 0.2.2(`Marker draggable/onDragend`, `NavermapsProvider submodules`) · @types/navermaps 3.9.2(`naver.maps.Service.geocode`, context7 tutorial-Geocoder 확인) · vitest 4. react-hook-form은 깔려 있지만 미사용이라 쓰지 않는다(필드 6개에 컨트롤드 state + zod `safeParse`면 충분, 기존 `photo-report-sheet` 패턴).

---

## 결정

| 항목 | 결정 | 출처 |
| --- | --- | --- |
| 구(gu) 출처 | **서울 25구 경계 데이터로 점-폴리곤 판정**. 저장은 사용자가 확정한 핀 좌표뿐. 도로명·지번은 `null` → 상세 정보 블록에 "주소를 알려주세요" 입구(준비 중, Phase 6 수정 제안) | 사용자 선택 |
| 주소 검색 | 네이버 지오코더(`submodules=geocoder`)는 **핀 이동 보조만**. 결과는 열린 제안 목록 동안만 컴포넌트 상태에 있고 선택·닫기·언마운트에 버린다. Place에 쓰지 않는다(규칙 2) | 규칙 2 |
| 서울 밖 핀 | 경계 판정이 null이면 2단계에서 "서울 안의 위치만 제보할 수 있어요"로 막는다(시드의 김포 1곳은 그대로) | 권고 |
| 4단계 사진 | **파일 선택 + 미리보기**(최대 `MAX_PLACE_PHOTOS`, 이미지만 zod). 목 제출은 파일을 버린다(저장소 Phase 6) | 사용자 선택 |
| 채운 레드 | **단계마다 하단 CTA 하나**가 그 화면의 유일한 채운 레드(제보 중엔 FAB 줄이 숨는다). 중복 의심 패널의 [이 가게예요][다른 가게예요]는 둘 다 아웃라인 | 권고 (토스 퍼널 문법) |
| 4단계 CTA | v1의 "큰 [건너뛰고 등록] + 작은 [입력하고 등록]" → **버튼 하나**. 아무것도 안 넣었으면 "건너뛰고 등록", 하나라도 넣으면 "등록하기". 두 제출 버튼 중 큰 쪽이 입력을 버리는 함정을 없앤다 | 권고 (spec 4.3-4 문구 정정) |
| 뒤로가기 | 플로우는 히스토리 **엔트리 하나**(`{saeuReport:true}`, URL 그대로). 브라우저 back·패널 ← = 이전 단계(popstate에서 한 단계 내리고 다시 push), 1단계에서 back·헤더 ✕ = 취소(확인 없음). 완료 시 엔트리를 `replaceState(null)`로 평범하게 만들고, 기존/신규 상세로 넘어갈 땐 `openDetail(id, "report")`가 **replace**해서 back 한 번에 목록 | 권고 |
| 중복 의심 | "다른 가게예요"로 등록되면 `Place.duplicateSuspectOf: id`(관리자 큐 표시용, UI 미표시) | spec 4.3-2 |
| 단위 칩 | [1kg][500g][한판][반판][마리][단위 없음]. 마리는 수 입력이 딸린다(`count`, `"10마리"`). 大中小(`size`, 목 2/150)·`serving`은 크롤 전용으로 두고 칩에 안 올린다 | 권고 |
| 가격 | 필수(양의 정수, 원). spec "메뉴명·가격·단위 한 줄(필수)" 그대로 | spec |
| 카테고리 | 1줄 = 구이(`raw:false`) → `grill`, "새우회도 팔아요" 토글 줄 = `raw:true` → `raw` 추가 | spec 4.3-3 |
| 지도 위 두 층 | 제보 중엔 검색 블록·칩 행을 숨긴다(지도는 핀 확정 전용, 우리 DB 검색과 주소 검색이 겹쳐 보이지 않게) | 권고 |
| 완료 공유 | 기존 상세의 공유(navigator.share → 링크 복사)를 `lib/share.ts`로 추출해 재사용. 카톡 전용 버튼·OG는 Phase 5 | roadmap |
| 리뷰 유도 | 완료 화면 링크 "리뷰도 남겨볼래요?" → "준비 중이에요"(로그인 Phase 4) | roadmap |
| 지도 에러 상태 | 2단계가 지도를 쓰므로 지도 에러면 제보 입구가 토스트 "지도를 불러오지 못해 제보할 수 없어요" | 4상태 |

**구 경계 출처**: `southkorea/seoul-maps`의 통계청(KOSTAT) 2013 시군구 `seoul_municipalities_geo_simple.json`(HTTP 200, 57KB 확인). 스크립트가 받아서 Douglas-Peucker로 더 줄여 `lib/gu-boundaries.json`(목표 ≤30KB)로 굽고 출처·라이선스를 파일 머리와 decisions에 적는다. 라이선스가 불명확하면 최근접역 스크립트와 같은 OSM Overpass `admin_level=6`(ODbL)으로 대체 — 스크립트의 fetch 함수만 다르다.

---

## 디자인 언어 — 화면 3 v2 (화면 2 v2 규칙을 그대로 잇는다)

- **퍼널 문법**: 단계마다 제목(`text-title-m-bold`) + 낮춘 캡션(`text-body-m-regular text-fg-secondary`) → 입력 → 하단 sticky CTA(48, 전폭, `pb-safe-bottom`). 진행은 헤더 아래 **4칸 세그먼트**(높이 2, 지난 칸 `bg-brand`, 남은 칸 `bg-line-hairline`) — 숫자 "1/4" 대신 칸으로 읽힌다.
- 시트 헤더는 상세와 같다(핸들 + ✕ 44px). ← 는 패널 첫 줄(44px 히트, `ci--chevron-left`) — 헤더는 pointerdown 즉시 캡처하므로 버튼을 헤더 밖에 둔다.
- 아이콘은 액션에만(←, ✕, 돋보기, ＋ 타일, 사진 제거 ✕, 공유). 정보 앞 장식 아이콘 없음.
- 위계는 회색 계층: 매치 행 상호 `text-body-l-semibold fg` / 메타 `caption-l-regular fg-tertiary`. 강조는 숫자만(거리 "40m", 가격 tabular).
- 입력은 `h-12 rounded-8 bg-bg-sunken` 한 종류(검색바와 같은 톤), 오류는 필드 아래 `text-caption-l-regular text-brand-fg` 한 줄.
- 빈 상태 한 줄 + 인라인 액션("찾는 가게가 없나요?" 캡션 + CTA). em dash·가운데 점으로 문장을 잇지 않는다.
- 여백 리듬: 제목↔캡션 4, 캡션↔입력 20, 필드 사이 12, 그룹 사이 28, CTA 위 24.

---

## 목표 화면 (390 기준, 시트 안 패널)

```
[1] full                         [2] half(270)                    [2b] 중복 의심
┌─ ── ✕ ────────────┐            ┌─ ── ✕ ────────────┐            ┌─ ── ✕ ────────────┐
│ ▮▯▯▯              │            │ ▮▮▯▯              │            │ ▮▮▯▯              │
│ ‹  가게 이름을     │            │ ‹  핀을 가게 위치로│            │ ‹  150m 안에 비슷한│
│    검색해주세요    │            │    옮겨주세요      │            │    가게가 있어요   │
│ [🔍 예: 나라수산 ] │            │ [🔍 도로명 주소로 ]│            │  청춘조개포차 신촌점│
│ 나라수산   이미있어요│           │  (결과 ≤5행)       │            │  서대문구 · 새우구이 40m│
│ 마포구 · 새우구이   │            │ [ 여기가 맞아요  ] │            │ [이 가게예요][다른 가게예요]│
│ 찾는 가게가 없나요? │            └───────────────────┘            └───────────────────┘
│ [ 새로 등록하기  ] │            (지도: 끌 수 있는 레드 핀)         (지도: 핀 + 기존 마커 fitBounds)
└───────────────────┘

[3] full                         [4] full                         [완료] full
│ ▮▮▮▯              │            │ ▮▮▮▮              │            │ 등록됐어요!        │
│ ‹  메뉴와 가격을   │            │ ‹  더 알려주실 게  │            │ 지도에 바로 보여요  │
│    알려주세요      │            │    있나요?         │            │ 7일간 '새로 제보됨' │
│ 대표 메뉴 한 줄이면 돼요│        │ 모두 선택 사항이에요│            │ 표시가 붙어요       │
│ 메뉴명 [예: 왕새우 소금구이]│    │ 사진  [＋][▣][▣] 2/10│          │ ┌ 나라새우 · 마포구 ┐│
│ 가격   [        ] 원│            │ 사이드 (머리버터구이)(라면)(볶음밥)│ │ 새우구이 · 1kg 35,000 [공유]│
│ 단위 (1kg)(500g)(한판)(반판)(마리)(없음)│ 영업시간 [예: 새벽 2시까지, 월 휴무]│ └────────────────┘│
│ 새우회도 팔아요  [○ ]│           │ [ 건너뛰고 등록 / 등록하기 ]│    │ [ 내 핀 보러가기 ] │
│ [      다음      ] │            └───────────────────┘            │ 리뷰도 남겨볼래요? │
└───────────────────┘                                             └───────────────────┘
```

---

## 변경

### 1. 문서 먼저 — `docs/design.md` 화면 3 v2 재작성 (137~152행)

"(v1 초안 — 착수 시 v2로 재작성)" 꼬리를 떼고 위 디자인 언어·5장면·변형(중복 의심, 서울 밖, 지오코더 4상태, 제출 실패, 사진 미리보기)을 화면 2 v2 문체로 다시 쓴다. `docs/decisions.md`에 `## 2026-09-04 — 제보 플로우(화면 3) v2` 항목: 위 결정 표 전부 + "커스텀 에셋 필요 목록"에 **제보 핀**(CSS 임시). 플랜은 `cp`로 `docs/plans/phase3-report.md`.

### 2. `lib/duplicates.ts` — collect.py `same_place` 이식 (`~/saewoo-map/collect.py:406-422`)

- `normalizeName(s)`: `/[\s\-.()&'·,]/g` 제거 + 소문자 (`norm_name`).
- `similarityRatio(a, b)`: difflib `SequenceMatcher.ratio()` 동등 구현 — 최장 공통 부분문자열(동률이면 a·b에서 가장 앞) 재귀 → `2M/(|a|+|b|)`. 이름은 짧아 autojunk(≥200) 무관. 기대값은 파이썬으로 뽑아 패리티 테스트.
- `samePlace(a, b)`: `haversineKm(a,b) > 0.15 → false`, 아니면 `na ⊂ nb || nb ⊂ na || ratio ≥ 0.85` (`lib/geo.ts haversineKm` 재사용).
- `findDuplicate(candidate, places)`: samePlace 중 가장 가까운 것 | null. `matchesName(place, query)`: 1단계 자동완성(normalizeName 포함 매칭, ratio 내림차순 ≤5).

### 3. 데이터 — `lib/data.ts` `submitReport` + 구 판정 + 주소 null

- **타입** (`lib/types.ts`): `addressRoad: string | null`(null = 미확인), `duplicateSuspectOf?: string`. 파생: `lib/places.ts matchesQuery` `?? ""`, `components/place-detail/info-rows.tsx` LocationGroup — 도로명이 null이면 주소 대신 "주소를 알려주세요" 입구(영업시간 빈 상태와 같은 문법, `comingSoon`), `use-place-detail.ts` 복사 가드, `lib/__tests__/fixtures.ts`.
- **구 경계**: `scripts/fetch_gu_boundaries.py`(stdlib만, 최근접역 스크립트 관례) → `lib/gu-boundaries.json`. `lib/gu.ts`: `guOfPoint(point): Promise<string|null>`(JSON 동적 import + ray-casting `pointInRing`, 구멍 없는 폴리곤/멀티폴리곤). data.ts가 `getGuOfPoint(point)`로 노출(규칙 1 — 2단계 확정 시 서울 밖 검사에 쓴다).
- **스키마**(export, 단계별 UI 검증도 같은 걸 쓴다): `reportMenuSchema {name 1~30, price int ≥100, unit "kg"|"g"|"pan"|"count"|"none", unitRaw ≤10|null, raw}`, `reportInputSchema {name 1~40, lat 33~39, lng 124~132, menus 1~2, sides, hoursNote ≤80, photos File[] ≤MAX_PLACE_PHOTOS(image/*), duplicateOf id|null}`.
- `submitReport(input, now)`: parse → `guOfPoint` null이면 reject → `simulateWrite()` → Place 생성 `{id "r001"…(모듈 카운터), source "report", specialist false, needsReview false, naverPlaceUrl null, nearestStation null(Phase 6 서버 파생), photos [] (목은 버림), thumbnailUrl null, addressRoad/Jibun null, tags 파생, menus(`raw` 원문 = 이름), hoursNote "" → null, createdAt = lastCheckedAt = now ISO, checkCount 0, isNew true, duplicateSuspectOf}` → `data.places = [...data.places, place]` → return. `now` 처리 주석은 `checkIn`과 같다.

### 4. 시트 — `components/ui/bottom-sheet.tsx` `SheetMode` "report"

`SheetMode = "list" | "detail" | "report"`. 기하·헤더(핸들 44 + ✕)는 detail과 같은 분기(`const panel = mode !== "list"`), 스냅 `["half","full"]`, **`resolveRelease`의 dismiss는 detail만**(제보는 아래로 튕겨도 half에 머문다 — 입력 유실 방지). `app/globals.css` 369~379행 셀렉터를 `[data-mode="detail"], [data-mode="report"]`로. `components/map-screen/place-sheet.tsx`: `report?: ReactNode` 추가, `mode !== "list"`일 때 목록 `hidden`, `dismissLabel`은 모드별("상세 닫기"/"제보 그만두기"). `map-screen.tsx`: `s.mode === "list"`일 때만 aside(FAB)·상단 두 층.

### 5. 지도 — 제보 핀 + 지오코더 (`components/map/*`)

- `naver-map-provider.tsx`: `submodules={["geocoder"]}`.
- `map-view.tsx`: props `pin?: LatLng | null`, `onPinChange?: (p: LatLng) => void` → `ReportPin`: `<Marker position={pin} draggable icon={getReportPinIcon(navermaps)} title="제보 위치" zIndex={400} onDragend={(e) => onPinChange({lat: e.coord.y, lng: e.coord.x})} />`. `MapHandle`에 `geocode(query): Promise<AddressHit[]>`(`naver.maps.Service.geocode({query, coordinate: "lng,lat", count: 5})` → `{roadAddress, jibunAddress, lat:+y, lng:+x}` ≤5, `Status.OK` 아니면 reject) — 시트는 `NavermapsProvider` 밖이라 `useNavermaps`(Suspense)를 못 쓰고, 핸들 경유가 테스트 페이크도 쉽다.
- `marker-icons.ts` `getReportPinIcon`: HtmlIcon `.saeu-report-pin`(머리 28px 레드 원 + 흰 점, 줄기 14, 앵커 바닥 중앙, 44px 히트), CSS는 globals.css 마커 블록 옆.

### 6. 플로우 상태 — `components/map-screen/use-map-screen.ts`

- `report: ReportFlowState | null` (`{step: 1|2|3|4|"done", name, pin, duplicate: {place, decided}, menu, extras, created}`는 `components/report/use-report-flow.ts`가 갖고, 맵 훅은 열림/단계/핀만 안다). `mode = detailPlace ? "detail" : report ? "report" : "list"`.
- `openReport()`(FAB·빈 상태 `handleReport`): 지도 에러면 토스트. `listSnapRef` 저장, `setSnap("full")`, `pushState({saeuReport:true}, "", "/")`. `lib/history-state.ts`에 `saeuReport?: true` + `isReportHistoryState`.
- 단계 전환 시 스냅: 2단계 `"half"`, 그 외 `"full"`. 2단계 진입: `userLocation ?? requestPosition()(1회) ?? viewport.center ?? SEOUL_CENTER`를 핀 시작점으로 `morph(start, 17)` 뒤 보이는 띠 중심으로 `panTo(screenY: visibleStripCenterY("half","report"))`(openDetail과 같은 경로). 중복 의심 시 `fitBounds([pin, candidate])`.
- popstate 재장전: `if (report) { step>1 && step!=="done" ? (이전 단계 + pushState 재장전) : closeReport("history"); return }` 그 다음 기존 상세 로직. `closeReport(source: "ui"|"history"|"handoff")` — ui는 `isReportHistoryState`면 `history.back()`, handoff는 히스토리 손대지 않음(뒤이어 `openDetail(id, "report")`가 replace).
- `openDetail` source에 `"report"` 추가: 항상 `replaceState`. `selectFromMarker`는 report 중 무시. `addPlace(place)`: `setPlaces(prev => [...prev, place])`(마커·목록에 즉시).

### 7. 패널 — `components/report/` (새 디렉터리)

- `report-panel.tsx`: 진행 세그먼트 + ← 줄 + 단계 스위치 + sticky CTA 슬롯. props `{places, now, mapHandle, userLocation, onStepChange, onPinChange, onOpenExisting(id), onCreated(place), onCancel, onNotice}`.
- `use-report-flow.ts`: 단계 state·검증(`reportMenuSchema.safeParse` 등)·제출(`submitReport` → `status idle|submitting|error`, 성공 시 `addPlace` + `replaceState(null)` + step "done").
- `step-name.tsx`(1): 입력 자동 포커스(ref), `matchesName` ≤5행 버튼(상호 / "구 · 카테고리" / 우측 `Chip tone="active" size="xs"` "이미 있어요") → `onOpenExisting`. 캡션 "찾는 가게가 없나요?" + CTA [새로 등록하기](이름 비면 인라인 오류).
- `step-location.tsx`(2) + `address-search.tsx`: 제목·캡션 "지도에서 핀을 끌어 맞춰주세요", 주소 검색 입력(돋보기, IME 가드는 `search-bar.tsx`와 같은 방식) → 4상태(로딩 `Skeleton` 2행 / "검색 결과가 없어요" / "주소를 찾지 못했어요" / 결과 ≤5행 버튼: 도로명 `body-m-medium`, 지번 `caption-l-regular fg-tertiary`; 탭 → `onPinChange` + 목록 비움). CTA [여기가 맞아요] → `getGuOfPoint` null이면 오류 줄, 아니면 `findDuplicate` → 의심이면 **같은 단계의 서브 패널**(후보 상호·구·카테고리·거리 + [이 가게예요]→`onOpenExisting` / [다른 가게예요]→`duplicateOf` 기록 후 3단계). 이미 결정한 후보는 다시 묻지 않는다.
- `step-menu.tsx`(3): 구이 줄(메뉴명 · 가격 `inputMode="numeric"` 접미 "원" · 단위 `ChipButton` 6개, 마리면 수 입력) + `Switch` "새우회도 팔아요" → 회 줄(같은 3필드, placeholder "예: 생새우회"). CTA [다음].
- `step-extras.tsx`(4) + `photo-picker.tsx`: `<input type="file" accept="image/*" multiple hidden>` + 타일 행([＋ 사진 추가] 88px 타일은 `photo-area.tsx` 빈 타일 스타일, 미리보기는 `next/image`(unoptimized) + 제거 ✕ 24px, "n/10" 캡션, `URL.createObjectURL`은 제거·언마운트에 revoke). 사이드 `ChipButton` 3개(`SIDE_LABELS`), 영업시간 입력. CTA 라벨 "건너뛰고 등록"/"등록하기", 제출 중 "등록 중…"(disabled, aria-busy), 실패 시 `onNotice("등록하지 못했어요. 다시 시도해주세요")`.
- `step-done.tsx`: 제목·캡션, 요약 카드(상호 / 구 · 카테고리 / 대표 메뉴 가격, [공유] 아이콘 버튼 → `lib/share.ts`), CTA [내 핀 보러가기] → `onOpenExisting(created.id)`, 링크 "리뷰도 남겨볼래요?" → 준비 중 토스트.
- 공용 추가: `components/ui/text-field.tsx`(label + input + 오류 줄, 호출자 6개), `components/ui/switch.tsx`(`role="switch"`, 트랙 `bg-line`→`bg-brand`, 흰 썸, 44 히트). `lib/share.ts`: `use-place-detail.ts`의 공유/복사 로직 추출(둘째 호출자).

### 8. 문서 정정 (같은 작업 단위)

- `docs/spec.md` 4.3: 4번 "'건너뛰고 등록'이 제일 큰 버튼" → 버튼 하나·라벨 전환. 2번에 "주소 검색 결과는 저장하지 않는다(규칙 2), 저장은 핀 좌표·경계 판정 구" 한 줄.
- `docs/roadmap.md` Phase 3 체크박스 완료 표시(마지막 커밋).
- 옛 용어 grep: `"제보는 준비 중"`, `"입력하고 등록"` in `docs/`·`components/`.

---

## 테스트

- `lib/__tests__/duplicates.test.ts`: normalizeName / similarityRatio 파이썬 패리티(5쌍) / samePlace 4분기(150m 밖·포함·ratio≥0.85·미만) / findDuplicate 최근접 / matchesName 정렬·상한.
- `lib/__tests__/gu.test.ts`: 시청→중구, 강남역→강남구, 김포→null, 경계 근처 1점.
- `lib/__tests__/data.test.ts`: `submitReport` — 스키마 거부(빈 이름·메뉴 0·서울 밖), 성공 시 `Place` 모양(source/isNew/createdAt/tags/duplicateSuspectOf/addressRoad null)과 `getPlaces({isNew:true})` +1(다른 KST 날짜 `now`로 데이터셋 캐시 분리), 실패(Math.random 0.99→0.0 목) 시 추가 없음.
- `components/report/__tests__/report-flow.test.tsx`(`vi.mock("@/lib/data")` 부분 목): 1단계 매치 → `onOpenExisting`; 이름 없이 CTA → 오류; 2단계 확정 → 중복 의심 → 두 갈림길; 지오코더 4상태(핸들 페이크 resolve/reject/[]); 3단계 필수 검증·토글로 회 줄; 4단계 라벨 전환·사진 3장 미리보기·제출 성공→완료·실패→토스트 유지.
- `components/map-screen/__tests__/map-screen.test.tsx`: FAB → `data-mode="report"` + 1단계 제목; ✕ 닫힘; 제출 성공 후 목록·마커(페이크 `Marker` title)에 새 가게; popstate 재장전(이전 단계).
- `components/ui/__tests__/bottom-sheet.test.tsx`: report 스냅·no-dismiss(`resolveRelease` 순수 함수). `components/map/__tests__/marker-icons.test.ts`: 제보 핀 앵커.
- 상세: `info-rows` 도로명 null → "주소를 알려주세요" 입구.

## 검증

1. 단위마다 `pnpm typecheck && pnpm lint && pnpm test 2>&1 | grep -E 'FAIL|✗|error' | head -40`.
2. `pnpm dev` + Playwright MCP **320 / 390 / 430**(run_code 첫 줄 `setViewportSize`, geolocation 허용/거부 두 경로):
   - FAB → 1단계 자동 포커스, "나라" 입력 → 나라수산 "이미 있어요" → 탭 → 상세 열림, back 한 번에 목록.
   - 2단계: 시트 half에서 핀이 시트 위 띠에 보이는가, `page.mouse`로 핀 드래그 후 좌표 갱신, 주소 검색 "마포대로 1"(localhost:3000 등록 도메인) 결과 → 탭 → 핀 이동, 시드 가게 근처 같은 상호로 확정 → 중복 패널·fitBounds.
   - 3·4단계 검증 문구, 사진 2장 선택(`browser_file_upload`) 미리보기, "건너뛰고 등록"↔"등록하기", `Math.random=()=>0` 실패 토스트 후 재시도 성공 → 완료 → 내 핀 보러가기 → 신규 배너 상세 + 점선 링 마커.
   - `page.goBack()` 중간 단계 → 이전 단계로, 1단계에서 → 닫힘. 헤더 ✕ 클릭이 리타겟 없이 닫히는가(jsdom 못 잡음).
   - 키보드는 실기기 항목(iOS 고정 시트 + 키보드 점프) — 결과 보고에 "미확인"으로 명시.
3. 390 스크린샷 5장(1·2·2b·3·4·완료 중 5) 전달.
4. `gap-sweeper`로 spec 4.3 + design 화면 3 v2 전수 대조(미구현 0) → roadmap 체크.

## 커밋 단위 (한 턴 = 한 커밋)

1. `docs`: design 화면 3 v2 재작성 + decisions 항목 + `docs/plans/phase3-report.md`
2. `feat(lib)`: `duplicates.ts` same_place 이식 + 패리티 테스트
3. `feat(data)`: 구 경계 스크립트·JSON·`gu.ts` + `submitReport` + `addressRoad` null 파생(정보 블록 입구) + 테스트
4. `feat(sheet)`: `SheetMode` "report" + CSS + no-dismiss + place-sheet `report` 슬롯
5. `feat(map)`: geocoder 서브모듈 + `MapHandle.geocode` + 끌 수 있는 제보 핀 + 핀 CSS
6. `feat(report)`: 패널 뼈대(진행·←·CTA) + 1단계 가게명 + 훅 연결(FAB·히스토리 재장전·기존 상세 전환)
7. `feat(report)`: 2단계 핀·주소 검색 4상태·중복 재검사 갈림길
8. `feat(report)`: 3단계 메뉴·가격·단위·회 토글(TextField·Switch)
9. `feat(report)`: 4단계 사진 미리보기·사이드·영업시간 + 제출 + 완료 화면(`lib/share.ts`)
10. `fix`/`docs`: Playwright 후 보정 + spec·roadmap 정정 + gap-sweeper 결과
