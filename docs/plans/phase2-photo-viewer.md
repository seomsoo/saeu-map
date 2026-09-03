# 화면 2 사진 확대 뷰어 + 신고 + 날짜 연도 표기

## Context

화면 2(가게 상세) 리디자인을 마친 뒤 사용자가 실제 화면을 보고 낸 후속 요구 4가지:

1. **사진이 작다.** 지금 112px 정사각이라 음식 사진이 잘 안 보인다.
2. **여러 장일 때 어떻게 되는지 확인이 안 된다.** 목 데이터가 최대 3장(p018)뿐이고, 스트립은 `overflow-x-auto` 자유 스크롤이라 슬라이드가 아니다. **장수 상한은 스펙에 없다.**
3. **사진을 탭하면 전체 화면으로 확대되어야 한다.** 지금 `<li>`에 클릭 핸들러가 아예 없다.
4. **익명 업로드라 이상한 사진이 올라올 수 있으니** 확대 화면에 신고가 있어야 하고, **올린 날짜**도 보여야 한다.

추가로, 리뷰 날짜가 `"9.3"`이라 어색하다는 지적 — **절대 날짜는 연도까지** 쓴다(`2026.09.03`).

지금 데이터에는 사진 업로드 날짜를 담을 자리가 없다(`photoUrls: string[]`). 라이트박스는 문서 화면 1~9 어디에도 없고, `components/ui/`에 dialog/modal도 없다. 사진 업로드·신고는 둘 다 Phase 6이지만 **뷰어는 읽기 기능이라 지금 만들 수 있고, 신고는 사용자 결정으로 목 저장까지 실제 동작시킨다.**

**목표**: 사진이 제대로 보이고, 탭하면 전체 화면에서 넘겨 보며, 언제 올라온 것인지 알고, 이상하면 그 자리에서 신고할 수 있는 상세 화면.

브랜치 `feat/phase2-redesign`. 새 패키지 없음.

---

## 확정된 결정 (사용자 선택)

| 항목 | 결정 |
| --- | --- |
| 스트립 사진 | **176×128 (`w-44 h-32`, ≈4:3)**. 높이 128은 요약 높이 예산 상한 — 현재 여유 32px 중 16 소모 |
| 사진 상한 | **10장**. 다 차면 ＋ 타일 자리에 같은 크기 안내 타일 |
| 뷰어 날짜 | **절대 + 연도 `2026.09.03`** (`formatKstDate`) |
| 신고 | **사유 선택 시트까지 실동작**. 사유 4개, 목 저장(400ms + 10% 실패) |

사용자에게 4:3 = 170×128로 안내했으나, 임의값 금지 규칙상 토큰 유틸로 떨어지는 가장 가까운 값이 `w-44`(176px, 11:8)다. 시각적 차이는 6px.

**뒤집는 결정 2건** (decisions.md 기록 필수):
- `design.md:119`·`spec.md`의 "신고 = 준비 중 토스트" → **사진 신고만 실동작**(가게 신고·리뷰 신고는 그대로 토스트)
- `design.md:99,102`의 "사진 112 정사각 / 요약 높이 예산" → 176×128, 여유 32→16px
- `design.md:113,151`의 짧은 날짜 `"8.27"` → `"2026.08.27"`

---

## 설계

### 데이터 — `photoUrls: string[]` → `photos: Photo[]`

이름을 유지하면 필드가 거짓말이 되고, 참조처가 7곳뿐이라 개명이 더 싸다.

- `lib/types.ts` — `interface Photo { id: string; url: string; uploadedAt: string }`, `Place.photos: Photo[]`. **`thumbnailUrl = photos[0]?.url ?? null` 파생은 유지** → `place-card.tsx`·`map/marker-icons.ts`·`map/map-view.tsx` 무변경.
- `lib/data.ts` — `RawPlace.photos?: { url: string; at: string }[]`. `dataset()`(:88-97)에서 `safeAssetPath(url)`이 null이면 그 장만 버리고(규칙 3), `at`은 **기존 `shiftDateOnly`**를 태운다 — `lastCheckedAt`과 같은 shift라 목 날짜가 늘 최근으로 보인다. `id`는 JSON에 넣지 말고 `` `${raw.id}-p${i + 1}` ``로 파생(Phase 6에서 DB uuid로 교체, 주석).
- `export const MAX_PLACE_PHOTOS = 10`을 `lib/data.ts`에 두고 `slice(0, MAX_PLACE_PHOTOS)` 방어. UI 상수가 아니라 도메인 규칙이다.
- `lib/mock/places.json` — p018/p019의 `photos`를 객체 배열로. **10장 꽉 찬 케이스를 한 곳 추가**(p025 등)해 안내 타일과 페이징을 눈으로 검증할 수 있게 한다.
- `public/mock/photo-1..4.svg` 신규 — 기존 `thumb-*.svg`(viewBox 80×80)는 카드·마커용으로 두고, **4:3 검증용으로 viewBox `0 0 1200 900`** 플레이스홀더를 따로 만든다. 정사각 소스로는 `object-cover` 크롭이 검증되지 않는다.

### 스트립 (`components/place-detail/photo-area.tsx`)

- `TILE` 상수 `size-28` → `w-44 h-32`, `<Image width={112} height={112}>` → `{176}/{128}`. **두 곳 다 고쳐야 한다**(크기가 이중으로 박혀 있다).
- 빈 상태 ＋ 타일도 같은 크기로 — 주석(:28-31)의 "사진 유무로 행 높이가 안 바뀐다" 불변식 유지.
- 사진 `<li>`를 `<button>`으로 감싸 탭 → 뷰어. `aria-label`은 `"사진 3장 중 1번째 크게 보기"` 식.
- `data-pan-x`(:57)·`touch-pan-x`는 그대로 — 시트 가로 제스처 양보 규약(`bottom-sheet.tsx:259`).
- 10장이면 ＋ 타일 대신 같은 176×128 안내 타일(`bg-bg-sunken`, "10장까지", 버튼 아님) — 행 높이·스크롤 길이가 유지된다.
- 스냅은 넣지 않는다. 스냅은 한 장씩 전폭일 때의 문법이고, 여러 장이 동시에 보이는 스트립에서는 어색하다.

### 뷰어 (`components/place-detail/photo-viewer.tsx` 신규)

- **`createPortal(document.body)` + 네이티브 `<dialog>` + `showModal()`**. `.saeu-sheet`가 `transform: translateY()`(globals.css:307)라 시트 안의 `position: fixed`는 시트 기준으로 잡힌다 → body 포털이 필수. top layer가 z 경쟁(시트 z-20, 드롭다운 z-30, 토스트 z-10)을 통째로 없애고 포커스 트랩·`inert`·Escape·포커스 복원이 공짜다.
  - 대가: **`vitest.setup.ts`에 `showModal`/`close` 스텁 추가**(jsdom 30에 없음 — 기존 `stub()` 헬퍼로 4줄) + UA 스타일 리셋(`m-0 max-w-none max-h-none size-full`).
- **body 스크롤 잠금 코드는 넣지 않는다** — `map-screen.tsx:66`의 루트가 이미 `h-dvh overflow-hidden`이다.
- 좌우 넘김은 **CSS scroll-snap**(`snap-x snap-mandatory overflow-x-auto overscroll-contain`, 슬라이드 `w-full snap-center`). `bottom-sheet`가 겪은 pointer-capture 리타겟·non-passive touchmove 함정은 전부 "세로 시트 vs 가로 스트립" 경합에서 나온 것인데, 포털된 단독 표면에는 그 경합이 없다 → JS 제스처를 쓸 이유가 없다.
- 인덱스는 `onScroll`에서 `Math.round(scrollLeft / clientWidth)` (**jsdom `clientWidth === 0` 0나눗셈 가드 필수**). 초기 위치는 layout effect에서 `scrollLeft` 대입(`scrollIntoView`는 setup에서 no-op 스텁이라 못 쓴다).
- 레이아웃: 상단 `✕` + `"2 / 7"` 카운터 / 가운데 `object-contain` 사진 / 하단 `2026.09.03` + `[신고]`. 상하단은 safe-area 유틸(`pt-safe-top-or-3`, `pb-safe-bottom-or-3`).
- 토큰 2개 신설(`app/globals.css` + **design.md 토큰 표 행 추가**): `--color-bg-immersive: var(--color-common-100)`, `--color-fg-on-immersive`(흰색). 딤·몰입 표면 Semantic 자리가 지금 비어 있다.
- `components/place-detail/` 전용에 둔다. 호출자가 하나뿐이라 사다리 5번에 걸리지만, props를 `{ photos: Photo[]; index; onClose; onReport }`로 일반화해 두면 리뷰 사진이 붙을 때 `git mv`로 끝난다. **리뷰 사진 연결은 이번 범위 밖.**

### 뒤로가기

**push하되 URL은 그대로**: `history.pushState({ saeuDetail: true, saeuPhoto: true }, "", location.pathname)`. URL을 바꾸면 `use-map-screen.ts`의 `PLACE_PATH` 정규식이 안 맞아 popstate 재동기화가 깨지고, 사진 인덱스는 아직 공유 자원이 아니다.

- 상태는 `use-place-detail.ts`(로컬) + 작은 `useHistoryOverlay(open, onClose)`. `use-map-screen`까지 끌어올리면 3단 prop drilling이 된다.
- **필수 가드**: 뷰어를 닫을 때 pathname이 그대로라 `use-map-screen.ts:296`의 popstate가 `openDetail(id, "history")`를 다시 부르고 `setSnap("half")`가 실행된다 → **전체로 펼친 시트가 요약으로 튄다.** `openDetail`을 `detailId === id`면 no-op으로 만드는 멱등 가드가 이 설계의 전제다.
- 대안(히스토리를 안 건드림)은 뒤로가기가 뷰어와 상세를 한 번에 닫아 시트 위치·스크롤을 잃는다. 안드로이드 주 제스처를 버리는 셈이라 비추천.

### 신고

같은 dialog 안의 하단 패널(중첩 dialog 불필요 — top layer 하나면 충분).

- 사유 **4개, 44px 전체폭 행, 탭 즉시 접수**: `부적절한 사진` / `다른 가게 사진` / `광고·도배` / `기타`. 칩 격자 + 제출 버튼 대신 이 문법을 쓰면 "선택했지만 아직 제출 안 함" 상태가 사라진다(네이버·인스타 신고 시트의 실제 문법).
- `lib/data.ts`에 추가: `export type PhotoReportReason = "inappropriate" | "wrong_place" | "spam" | "other"`, `export async function reportPhoto(input: { placeId: string; photoId: string; reason: PhotoReportReason }): Promise<void>` — 기존 `placeIdSchema` 재사용 + `z.enum`, `await simulateWrite()`(400ms + 10% 실패), 상태 변이 없음(`reports`는 Phase 6 테이블).
- 결과 토스트: **성공은 뷰어를 닫고 기존 `onNotice`("신고를 접수했어요"), 실패는 dialog 안에 `Toast`를 한 번 더 렌더**("신고를 접수하지 못했어요", 재시도 = 다시 탭). 기존 토스트는 z-10이라 top layer에 무조건 가리고, 실패 시에는 뷰어를 닫으면 안 되므로 이 조합만 성립한다. `Toast`는 순수 표시 컴포넌트라 재사용이고 타이머만 로컬 5줄. **타이머 호출자가 셋이 되면 `lib/use-notice.ts`로 승격**한다.

### 날짜 연도 표기

- `review-section.tsx:8,71` — `formatKstShortDate` → **`formatKstDate`**(`lib/time.ts:69`, 이미 `"2026.09.03"`을 낸다. 새로 만들 것 없음).
- `formatKstShortDate`(`lib/time.ts:75-79`)는 이 교체 후 **사용처가 테스트뿐** → 함수와 `lib/__tests__/time.test.ts`의 해당 단언을 함께 삭제.
- 뷰어 날짜도 같은 포매터.

### 4상태 (UI 완성 기준)

- **뷰어**: 로딩 = 슬라이드별 `onLoad` 전까지 어두운 자리(사진 목록은 이미 메모리에 있어 별도 로딩 없음) / 에러 = `onError` 슬라이드에 "사진을 불러오지 못했어요" / 빈 = `photos.length === 0`이면 열리지 않음(빈 스트립에는 탭 대상이 없다) / 정상.
- **신고 시트**: 정상 4행 / 로딩 = 누른 행 disabled + "접수 중" / 에러 = 뷰어 내부 토스트 + 시트 유지 / 빈 상태 없음(사유는 정적).
- **스트립**: 10장 안내 타일.

---

## 변경 파일

| 파일 | 무엇을 |
| --- | --- |
| `lib/types.ts` | `Photo` 신설, `Place.photos`, `thumbnailUrl` 주석 정정 |
| `lib/data.ts` | `RawPhoto` 변환 + shift, `MAX_PLACE_PHOTOS`, `reportPhoto` |
| `lib/mock/places.json` | p018·p019 객체 배열화 + 10장 케이스 1곳 |
| `public/mock/photo-1..4.svg` | 4:3 플레이스홀더 신규 |
| `lib/time.ts`, `lib/__tests__/time.test.ts` | `formatKstShortDate` 삭제 |
| `components/place-detail/photo-area.tsx` | 176×128, 탭 → 뷰어, 10장 안내 타일 |
| `components/place-detail/photo-viewer.tsx` | 신규 — dialog + scroll-snap + 카운터·날짜·신고 |
| `components/place-detail/photo-report-sheet.tsx` | 신규 — 사유 4행 |
| `components/place-detail/use-place-detail.ts` | 뷰어 열림 상태, `reportPhoto` 호출, `useHistoryOverlay` |
| `components/place-detail/place-detail.tsx` | `hasPhoto`(:59) 필드명, 뷰어 렌더 |
| `components/place-detail/review-section.tsx` | `formatKstDate` |
| `components/map-screen/use-map-screen.ts` | `openDetail` 멱등 가드 |
| `app/globals.css` | `bg-immersive`·`fg-on-immersive` 토큰 |
| `vitest.setup.ts` | `showModal`/`close` 스텁 |
| `lib/__tests__/fixtures.ts`, `data.test.ts`, `place-detail.test.tsx` | `photos` 전환 |
| `docs/design.md`·`spec.md`·`decisions.md` | 아래 문서 정정 |

---

## 문서 정정 (CLAUDE.md "문서 정정 없는 결정 변경 커밋 금지")

- `docs/decisions.md` — **2026-09-03 사진 뷰어·신고·날짜 표기** 항목: 뒤집는 결정 3건(신고 실동작 / 사진 112→176×128과 요약 여유 32→16 / 짧은 날짜 폐기), `Photo[]` 데이터 모양, 10장 상한과 근거, `<dialog>` top layer를 고른 이유, `openDetail` 멱등 가드가 뷰어 뒤로가기의 전제라는 사실.
- `docs/design.md` — `:99`(요약 높이 예산 "사진 112"), `:102`(정사각 112 스트립 → 176×128 + 탭 확대 + 10장), `:113`(리뷰 날짜 `8.27` → `2026.08.27`), `:119`(미구현 입구 목록에서 사진 신고 제외), `:151`(화면 7 "8.27 등록"), 토큰 표에 `bg-immersive`·`fg-on-immersive` 행. **화면 2 아래에 "사진 뷰어" 변형 블록 신설**(화면 번호는 새로 만들지 않고 화면 2의 변형 (e)로).
- `docs/spec.md` — `:56`(4.2 사진 항목), `:119`(신고 속도 제한 줄에 사진 신고 진입점 명시).
- `docs/plans/phase2-photo-viewer.md`로 이 플랜 복사.
- 옛 용어 grep: `photoUrls`, `"8.27"`, `formatKstShortDate`, "112".

---

## 테스트

**jsdom (Vitest + Testing Library)**
- `lib/__tests__/data.test.ts:130-134` 개정 — `photos` 매핑, `uploadedAt`이 shift를 탔는지, 외부 도메인 섞이면 그 장만 탈락(규칙 3), 11장이면 10장으로 잘림, `thumbnailUrl === photos[0].url`.
- `reportPhoto` — 성공, 실패(`Math.random` spy로 10% 경로 강제), zod 거부.
- 스트립 — 사진 3장 + ＋ 타일 / 10장이면 안내 타일이고 ＋ 타일 없음 / 빈 상태 문구 유지.
- 뷰어 — 사진 탭 → `getByRole("dialog")`, 하단 날짜가 `"2026.09.03"` 형식, 카운터, `✕`로 닫힘.
- 신고 — `[신고]` → 사유 4행 → 탭 시 **올바른 `photoId`로** `reportPhoto` 호출, 성공 시 `onNotice`, 실패 시 뷰어 안 토스트 + 시트 유지.
- 뒤로가기 — `history.back` spy, popstate 후 snap 유지(멱등 가드).
- 리뷰 날짜 `"2026.08.27"`.

**Playwright MCP (수동 — 리포에 자동 스위트 없음)**
- 320/390/430에서 176×128 타일 + **요약에서 길찾기 줄까지 보이는지**(여유 16px 예상). 320×568도 실측.
- 사진 탭이 **시트의 250ms 클릭 억제창**(`bottom-sheet.tsx:38 CLICK_SUPPRESS_MS`)에 먹히지 않는지 — 과거 pointer-capture 리타겟과 같은 계열이라 jsdom이 못 잡는다.
- top layer가 시트·드롭다운·토스트 위인지.
- 실제 터치 스와이프 페이징 + 카운터 갱신, 스트립 가로 스와이프가 여전히 시트를 안 움직이는지.
- 안드로이드 뒤로가기 1회 = 뷰어만 닫히고 시트 snap 유지.
- 320에서 리뷰 행 닉네임 + `2026.08.27`이 한 줄에 들어가는지.
- 390 스크린샷 4장(스트립 / 뷰어 / 신고 시트 / 10장 상태) 전달.

**마무리**: `pnpm typecheck && pnpm lint && pnpm test` → `gap-sweeper`로 재작성한 design 화면 2 + 사진 뷰어 블록 전수 대조(미구현 0건).

---

## 커밋 단위 (한 턴 = 한 커밋)

1. `refactor(review)`: 절대 날짜에 연도 — `formatKstDate` 통일, `formatKstShortDate` 삭제 + design 2곳·decisions 기록
2. `docs`: 사진 뷰어·신고·10장 상한 결정 기록 + design(99·102·119·토큰 표·변형 (e))·spec(56·119) 재작성 + 플랜 복사
3. `feat(data)`: `Photo[]` 전환 + `MAX_PLACE_PHOTOS` + `reportPhoto` + 4:3 목 에셋·10장 케이스
4. `feat(detail)`: 스트립 176×128 + 10장 안내 타일 + 탭 대상화
5. `feat(detail)`: 뷰어 — dialog + scroll-snap + 카운터·날짜·닫기 + vitest 스텁 + 토큰
6. `feat(detail)`: 신고 사유 시트 + 목 저장 + 성공/실패 처리
7. `fix(sheet)`: 뷰어 뒤로가기 마커 + `openDetail` 멱등 가드
