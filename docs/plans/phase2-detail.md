# Phase 2 — 상세 화면 (spec 4.2 · design 화면 2)

## Context

Phase 1(지도 메인 + 리디자인)이 main에 머지된 뒤(#3) 다음 항목. roadmap 절차대로 **design.md [화면 2]를 v2 언어로 먼저 재작성**(Figma 버틸까 구 상세 `176:1140`·Components `156:1204` 문법을 Figma Desktop MCP로 읽음) → 사용자 확인 → 이 플랜 → 구현. 완료 조건은 roadmap Phase 2 항목 + gap-sweeper 미구현 0건.

착수 시점 코드 상태: 상세 시트·`/place/[id]`·mutation·토스트 컴포넌트·채운 주 버튼·별점·절대 날짜 포맷터가 전부 없다. `BottomSheet`는 3단(collapsed/half/full)이고 닫기 상태가 없다. `Place`에 영업시간 필드가 없다. 목 리뷰는 p162 2건뿐. 카드·마커 탭은 `selectedId`만 바꾼다.

### 확정 결정 (docs/decisions.md 2026-09-02 "Phase 2 상세")
- 채운 레드 = [다녀왔다면] 레드 pill 한 곳(상세 열린 동안 FAB 숨김). 길찾기 잉크 채움, 공유·찜 아웃라인. 상단 사진 = 카드·마커와 같은 `thumbnailUrl`. 평점은 리뷰 3개 이상일 때만.
- 얕은 `/place/[id]` 지금(공유 링크). SSR 메타·OG·진짜 404는 Phase 5.
- 영업시간 = `Place.hoursNote` 메모 문자열. "영업 중" 판정 없음.
- 요약 = 같은 본문을 50dvh(최소 300px)로 열어 위에서 잘림. 시트 `mode` 전환, `SheetSnap` 3종 유지, 닫기는 `resolveRelease` 콜백.
- 빈 사진 = 입력 행(56px). 닫기 ×는 상호 행 오른쪽. 확인 후 pill은 틴트 "확인했어요".
- 목 데이터는 컴포넌트가 `lib/data.ts`를 클라이언트에서 직접 호출. `now` 필수 인자.
- 미구현 입구 8곳은 토스트 "준비 중이에요".
- 완료 조건의 목업 = 블록 항목 전수 대조 + 버틸까 Figma 문법 비교.

## 아키텍처

### 시트 detail 모드 (`components/ui/bottom-sheet.tsx`)
- 새 prop: `mode?: "list" | "detail"`(기본 list), `header?`(detail에선 무시 — 핸들만, 헤어라인·px-5 래퍼 없음), `handleLabel?`, `onDismiss?`.
- 순수 함수(모두 trailing `mode = "list"` → 기존 테스트 무수정): `sheetSnaps(mode)`, `sheetVisiblePx(snap, vh, mode)`(detail half = `max(round(vh×0.5), 300)`, ≤639 collapse 없음), `nextSnapOnTap`/`neighborSnap`/`nearestSnap`, **`resolveRelease({mode, snap, visible, velocity, viewportHeight})`** → `{kind:"snap", snap} | {kind:"dismiss"}`. detail은 half에서 아래 플링 또는 `halfPx − SHEET_DISMISS_PX(100)` 아래에 놓으면 dismiss.
- 본문 드래그(detail만 바인딩): `touch-action`은 `.saeu-sheet__body`에. half = `overflow-y: hidden; touch-action: none`. full = `touch-action: pan-y` + 네이티브 `touchmove` `{ passive: false }`(pointerdown 시 `scrollTop <= 0`이고 첫 이동이 아래면 `preventDefault`, 위면 `abandoned`). 움직인 본문 드래그 뒤 click은 `onClickCapture`로 억제. detail+half 진입 시 `scrollTo(0,0)`, 상세 본문 `key={placeId}`.
- CSS: `.saeu-sheet[data-mode="detail"] { --sheet-half: max(50dvh, 300px); --sheet-header-h: 26px; }` + body 두 규칙.

### 상태·URL (`components/map-screen/use-map-screen.ts`, `map-screen.tsx`)
- `detailId` 추가. 카드·마커 탭 모두 상세 열기 + 지도 가시 영역 중앙으로 이동. `closeDetail()`은 목록 snap 복원. 목록 본문은 `hidden`으로 유지.
- `places`·`bookmarkedIds`는 클라이언트 state(`patchPlace`)로 승격 — 다녀왔다면·찜 결과가 카드·칩 필터에 반영.
- URL: 열기 = 이벤트 핸들러에서 `history.pushState(null, "", "/place/{id}")`, 닫기 = push했으면 `history.back()`, 직접 진입이면 `replaceState("/")`. `popstate` → pathname 파싱으로 열기/닫기. `useParams` 사용 금지(`/` 트리 보고). 마운트 effect에서 history 호출 금지.
- `app/place/[id]/page.tsx`: `params: Promise<{ id: string }>` 명시(생성형 `PageProps`는 CI typecheck가 빌드 전이라 금지), `connection()` → 로더 + `getPlaceById` → 즉시 `notFound()` / `getPlaceDetail` → `<MapScreen initialPlaceId initialDetail>`. 없는 id는 스트리밍 때문에 200 + not-found UI + noindex.

### 데이터 (`lib/data.ts`)
- `checkIn(placeId, now)`: zod 검증 → `delay(400)` → `Math.random() < 0.1`이면 throw → 캐시 dataset의 place를 새 객체로 교체(`checkCount+1`, `lastCheckedAt=now`) + checkins 추가 → `Place` 반환.
- `toggleBookmark(placeId)`: 메모리 Set 토글 → 목록 반환. `getPlaceDetail(id, now)`: `{ place, reviews }`.
- 타입: `Place.hoursNote: string | null`, `Review.photoUrl?: string`.
- `lib/reviews.ts` `ratingSummary`(3개 미만 average null), `lib/time.ts` `formatKstDate`/`formatKstShortDate`, `lib/naver-links.ts`(딥링크·웹 폴백·호스트 화이트리스트), `lib/map-screen-data.ts` `loadMapScreenData(now)`.

### 상세 컴포넌트 (`components/place-detail/`)
`place-detail.tsx`(1~10 컴포지션 + 신규 배너 + 4상태) / `photo-area` / `place-header` / `check-line` / `action-row` / `menu-list` / `sides-row` / `review-section` / `footer-links` / `new-place-banner` / `place-detail-skeleton` / `use-place-detail.ts`(리뷰 로드·낙관적 다녀왔다면·찜·복사·공유·길찾기). 공용: `ui/button.tsx`(cva ink/brand/outline), `ui/toast.tsx`, `ui/rating-stars.tsx`, `ui/section-band.tsx`.

## 변경 파일

| 영역 | 파일 | 변경 |
|---|---|---|
| 문서 | `docs/design.md` `docs/decisions.md` `docs/spec.md` `docs/roadmap.md` | 화면 2 v2, 결정 기록, 4.2-5·4.6 정정, Phase 2·5 문구 |
| lib | `lib/types.ts` `lib/data.ts` `lib/reviews.ts` `lib/time.ts` `lib/naver-links.ts` `lib/map-screen-data.ts` `lib/mock/places.json` `lib/mock/reviews.json` | 위 데이터 절 |
| 라우트 | `app/page.tsx` `app/place/[id]/page.tsx` `app/place/[id]/loading.tsx` `app/not-found.tsx` | 로더 공유, 얕은 라우트, 상세 스켈레톤, not-found |
| UI | `components/ui/bottom-sheet.tsx` `app/globals.css` `components/ui/button.tsx` `toast.tsx` `rating-stars.tsx` `section-band.tsx` | detail 모드, 프리미티브 |
| 상세 | `components/place-detail/*` | 1~10 |
| 화면 1 | `components/map-screen/use-map-screen.ts` `map-screen.tsx` `place-sheet.tsx` | 열기/닫기/URL/FAB/목록 유지 |
| 하네스 | `.claude/agents/security-reviewer.md` `.github/workflows/ci.yml` | 에이전트(발화 검증), 스모크 `/place/p018`·`/place/nope` |
| 테스트 | `lib/__tests__/{reviews,naver-links,time,data}.test.ts` `components/place-detail/__tests__/place-detail.test.tsx` `components/map-screen/__tests__/map-screen.test.tsx` `components/ui/__tests__/bottom-sheet.test.tsx` | 게이트·URL·날짜·checkIn 성공/실패, 1~10 순서·낙관/롤백·찜·복사·배너·빈/에러, 열기/닫기/URL, detail 스냅·dismiss |

## 구현 순서 (커밋 단위)
1. docs — design 화면 2 v2 + 이 플랜 + decisions/spec/roadmap
2. lib — 타입·목 데이터·mutation·reviews·time·naver-links + 테스트
3. ui — Button·Toast·RatingStars·SectionBand + BottomSheet detail 모드 + CSS + 테스트
4. place-detail — 컴포넌트 1~10 + 훅 + 테스트
5. route — map-screen 배선 + `/place/[id]`·loading·not-found + 테스트 + ci 스모크
6. harness — security-reviewer 에이전트 + 발화 검증
7. 검증 — Playwright 스크린샷·gap-sweeper·정정·결과 기록

## 검증
- `pnpm typecheck && pnpm lint && pnpm test`
- 임의값 grep 0건, 컴포넌트의 `bg-brand` = FAB [제보] + [다녀왔다면](동시 노출 없음), 옛 용어 0건
- Playwright 390: 카드 탭 → 요약 / 드래그 → 전체 / 스와이프 → 닫힘 / `/place/p019`(신규 배너·사진) / `/place/p018`(리뷰 3건 별점) / `/place/p162`(별점 숨김) / 다녀왔다면 성공·실패(`Math.random=()=>0`) / 찜 → "찜한 곳" 칩 / 복사·공유 토스트 / `/place/nope` not-found + noindex / 320·430 → `.playwright-mcp/detail-*.png`, 버틸까 176:1140과 문법 비교
- `pnpm preview`: `/place/p018` 200, `/place/nope` 상태 코드 기록
- gap-sweeper 0건, security-reviewer 실행 결과 기록

## 결과 (2026-09-03)
- 커밋 7개(docs → lib → ui → detail → route → fix → test). 검증: typecheck 0, lint 0, vitest 12파일 165/165.
- Playwright 390·320·430: `.playwright-mcp/detail-00~16` 20장. 요약 높이 844에서 422px, 568에서 300px. 상세 열림 시 `.bg-brand` 1곳. URL 동기화·popstate·FAB 숨김·다녀왔다면 낙관/롤백·찜 칩·복사/공유 토스트·not-found + noindex 확인.
- `pnpm preview`(workerd): `/` 200, `/place/p018` 200, `/place/nope` 200 + not-found 카피 + noindex (decisions 2026-09-02에 기록).
- security-reviewer: 높음 0·중간 0·낮음 4·정보 5. 낮음 4 전부 반영(id 화이트리스트, 공유 URL 인코딩, `safeAssetPath` 공용화, 길찾기 타이머 정리, 찜 실패 토스트). "noindex 메타 누락" 지적은 오판(Next가 자동 주입, 실측 확인).
- 발견한 버그: 본문 pointerdown에서 바로 `setPointerCapture`하면 click이 캡처 요소로 리타겟돼 상세 버튼 전부 무반응. jsdom은 캡처를 스텁해 165개 테스트가 다 통과했고 Playwright에서만 드러남. 드래그 임계값 뒤 캡처로 수정. 포인터 제스처 변경은 Playwright 클릭 확인 필수.
- 하네스: `.claude/agents/security-reviewer.md`는 만든 세션에서 로드되지 않아 general-purpose에 정의 파일을 읽혀 대행. 2026-09-03 새 세션에서 `subagent_type: security-reviewer`가 목록에 뜨는 것 확인.
- 후속 후보(리뷰어 정보 항목): 다녀왔다면 더블클릭·응답 중 언마운트 테스트.
- gap-sweeper(2026-09-03, "표 40줄 이내"로 요구 → 결과 약 2,600자): 체크 78항목 중 구현 73·부분 5·미구현 0. 부분 5건 처리:
  1. 공유 링크 직접 진입 시 지도가 서울 전체(줌 12) 그대로라 핀이 안 보임 → 그 핀·줌 14에서 시작 + 지도 뜨면 가시 영역 중앙으로 `panTo`(위치 권한보다 핀 우선), 테스트 1개 추가 (decisions 2026-09-03).
  2. 사진 없음 입력 행 59px → `h-14`로 56px (320/390/430 실측 56).
  3. "사진 있는 가게는 1~5 보이고 6 걸침"은 실측(p018, 390×844) 1~4 + 5 걸침(버튼 줄 y=860) → design 문구를 실측대로 정정. 행 여백 축소는 디자인 결정이라 하지 않음.
  4. 메뉴 없음 상태: 코드·단위 테스트 있음. 목에서 메뉴 0인 곳은 p108뿐인데 `needsReview`(새우 메뉴 파싱 실패)로 데이터셋에서 숨겨져 화면 재현 불가 — 목 단계 한정.
  5. 리뷰 로딩·에러 상태: 코드·단위 테스트 있음. 목 읽기(`getPlaceDetail`)는 지연·실패하지 않아 화면 재현 불가 — Supabase 연결(Phase 6) 때 실기 확인.
  스펙 외 구현(기록): 주소·링크 복사 실패 토스트, 찜 실패 토스트, 지번 없으면 줄 숨김, 리뷰 개수는 ready일 때만 표시, 없는 id에 noindex.
- 최종 검증(2026-09-03): typecheck 0, lint 0, vitest 12파일 166/166.
- Codex 리뷰(PR #4) P2 2건 반영: 상세가 열린 채 다른 마커 탭 → 히스토리 엔트리 교체(닫기 한 번에 목록), 상세 열린 동안 선택 핀은 필터와 무관하게 유지. 테스트 2개 추가(168개).
