# Phase 4 — 신규 패널 · 내 활동 · 로그인 분기 (spec 4.4 · design 화면 4·5)

## Context

roadmap Phase 4. 지금 상태: 찜은 `lib/data.ts`의 모듈 Set 하나(사용자 구분 없음), [새로 들어온 집] 칩은 카드 목록 필터일 뿐, [리뷰 남기기]·완료 화면 "리뷰도 남겨볼래요?"는 토스트 "준비 중이에요", 로그인·세션·내 활동은 없다. 리뷰는 읽기 전용(`Review`에 id·작성자 없음). 테스트 319개.

목표: **익명 ↔ 카카오(목) 토글로 모든 분기가 보이는 상태.** ① [새로 들어온 집] 칩 = 심판대 패널(맞아요/달라요, 검증 전/확인됨, 빈 상태) ② 찜을 사용자 단위로 + 내 활동 패널(찜/내 리뷰/내 제보, 로그아웃·탈퇴) ③ 로그인 시트(목 카카오) + 리뷰 진입 게이트 ④ 리뷰 작성 폼(별점 필수·후기 선택·사진 1장) + 본인 수정·삭제 + 3개 미만 평균 숨김(이미 있음, 검증만).

roadmap 규칙대로 **design 화면 4·5(v1 초안)를 v2 언어로 먼저 재작성**하고 그 문서를 기준으로 구현한다. Supabase 없음 — 세션·리뷰·찜 전부 `lib/data.ts` 메모리 목(새로고침 = 초기화, 규칙 4). 데스크탑(화면 9)·SSR 메타·Turnstile·속도 제한은 Phase 5~6.

**주요 의존성(추가 없음)**: Next 16.3.3 · React 19.2 · TS 6.0.3 · Tailwind 4.3 · zod 4.5 · vitest 4.1. 네이티브 `<dialog>`(사진 뷰어에서 이미 씀)로 로그인 시트·리뷰 폼을 띄운다.

---

## 결정 (사용자 답 3 + 권고)

| 항목 | 결정 | 출처 |
|---|---|---|
| 신규 패널 입구·범위 | **[새로 들어온 집] 칩**이 입구(spec 4.4 "지도 위 버튼"은 v2 두 층 규칙과 충돌 → 정정). 켜면 시트가 패널로 바뀌고 **뷰포트와 무관하게 7일 이내 전부를 최신순**(createdAt↓). 지도엔 신규 마커만(필터가 이미 그렇게 한다). 정렬 트리거는 숨김(고정 최신순) | 사용자 선택 |
| 맞아요 | = 다녀왔어요(`checkIn`, +1, 핀당 하루 1회, `checkedIds` 공유). 낙관 → 행이 "확인됨" + 버튼 틴트 [✓ 확인했어요], 실패 시 원복 + 토스트 | spec 4.4 |
| 정보가 달라요 | **사유 시트 + 목 저장**: [위치가 달라요] [메뉴·가격이 달라요] [문 닫았어요] [기타] — 탭이 곧 제출(사진 신고 문법), 토스트 "알려주셔서 고마워요". `flagPlace()` 목 쓰기, 관리자 큐는 Phase 6 | 사용자 선택 |
| 검증 전/확인됨 | `checkCount ≥ 1` → "확인됨"(체크 아이콘 + fg-secondary), 아니면 "검증 전"(fg-tertiary). 틸 라벨 안 씀(카테고리색은 마커·색점만) | spec 4.4 |
| 내 활동 그릇 | **시트 모드 `me`**(제보처럼 헤더 = 핸들 + ✕, 전체 스냅으로 열림, 스와이프로 안 닫힘, 히스토리 엔트리 하나). 열린 동안 지도 마커 = 활성 탭의 가게(찜/리뷰한 곳/내 제보). 찜 카드 탭 → 상세(뒤로 한 번에 내 활동) | 사용자 선택 |
| 내 활동 입구 | **검색 바 오른쪽 끝 프로필 버튼**(익명 = `ci--user` 24, 로그인 = 28px 틴트 원 + 닉네임 첫 글자). 검색어가 있으면 지우기 ✕가 그 자리 | 사용자 선택 |
| 익명의 내 활동 | 프로필 버튼 → 로그인 시트(캡션 "로그인하면 찜·리뷰·제보가 기기가 바뀌어도 남아요"). 찜 자체는 익명 가능(칩 필터·하트) | spec 5 |
| 로그인 시트 | `<dialog>` 바텀 모달(딤 + 라운드 20 상단): 제목 "카카오로 로그인" / 이유별 캡션 / **[카카오로 시작하기]**(카카오 옐로 #FEE500 채움 — 사실 표기, 새 Primitive `kakao-500`) / "나중에 할게요" 텍스트. 목: 400ms·10% 실패(시트 안 오류 한 줄). 성공하면 **쓰려던 곳으로 복귀**(리뷰 폼 열림 / 내 활동 열림) | spec 5 |
| 세션 목 | `Session {userId, provider:"anonymous"\|"kakao", nickname}`. 익명이 기본(모듈 메모리, 탭 단위). 카카오 로그인 시 익명의 찜·제보·확인을 승계(linkIdentity 흉내), 로그아웃은 **새 익명**. 목 카카오 유저 = "새우헌터"(목 리뷰 2건의 작성자) | spec 5 |
| 리뷰 폼 그릇 | **전체 화면 `<dialog>`**(사진 뷰어처럼 top layer, 히스토리 엔트리 하나 — 뒤로가기 한 번에 폼만 닫힘). 헤더 ✕ + "리뷰 남기기", 가게명 캡션, 별 5개 44px(필수), 후기 textarea(선택, 500자), 사진 1장(`PhotoPicker max=1`, 목은 버림), 바닥 CTA [등록하기](이 표면의 유일한 채운 레드). 키보드는 `--vvh`/`--kb`(이미 :root에 있음) | 권고 |
| 리뷰 데이터 | `Review`에 `id`·`authorId`·`editedAt?` 추가, 삭제는 소프트(`deletedAt`, 목록·평균 제외). 등록 시 확인일 갱신(+checkin, spec 5). 본인 수정 → "수정됨" 캡션, 삭제 → 낙관 제거 + 실패 원복 | spec 5 |
| 본인 리뷰 UI | 상세 8번·내 활동 [내 리뷰] 행 오른쪽에 옅은 [수정] [삭제](12 fg-tertiary, EditButton 문법). 삭제는 **행 안 인라인 확인** "삭제할까요? [삭제] [취소]" | 권고 |
| 익명 찜 3개째 넛지 | 토스트 "로그인하면 찜이 기기가 바뀌어도 남아요" 세션당 1회. 벽 아님 | spec 5 |
| 닉네임 | 내 활동 프로필 행 [수정] → 인라인 TextField(2~12자) + [저장]. `updateNickname()` | spec 5 "수정 가능" |
| 탈퇴 | 모달 시트 확인 "탈퇴하면 리뷰·찜 등 내 기록이 모두 삭제돼요" → [탈퇴하기](brand-fg 텍스트 아웃라인) [취소]. 목: 내 리뷰·찜 삭제, 제보는 남기되 작성자 해제 → 새 익명 | spec 5 |
| 내 제보 | `Place.reporterId?`(제보 시 세션 id) → `getMyReports()`. 카드는 화면 1 카드 그대로 | spec 5 |
| 완료 화면 "리뷰도 남겨볼래요?" | 상세로 넘어간 뒤(엔트리 교체) 리뷰 게이트 → 폼. `reviewIntentId`로 상세에 전달 | roadmap |

---

## 디자인 언어 — 화면 4·5 v2 (화면 2·3 규칙을 잇는다; 전문은 design.md에 쓴다)

- **화면 4 신규 패널** = 화면 1 시트의 **헤더 교체 + 행 교체**. 헤더 제목 "새로 들어온 집 3곳"(20 semibold, tabular) / 캡션 "아직 검증 전이에요. 다녀오셨다면 확인해주세요"(12 fg-tertiary, 시즌 카운터 자리). 행(썸네일 64 + 텍스트, 헤어라인): 상호(16 semibold) + 오른쪽 "2026.08.27 등록"(12 fg-tertiary tabular) / "관악구 · 새우구이"(12 fg-secondary) / 대표 메뉴 "왕새우소금구이 한판 45,000원"(14, 가격 tabular) / **상태 + 액션 줄**: 왼쪽 "검증 전"(12 fg-tertiary) 또는 "✓ 확인됨"(12 fg-secondary), 오른쪽 [✓ 맞아요](outline md 40) [달라요](outline md, fg-secondary). 행 본문(썸네일·텍스트)이 버튼이고 액션은 형제 요소(중첩 버튼 없음). 확인 뒤 [✓ 확인했어요] 틴트. 빈 상태: "이번 주 새 제보가 없어요" / "제보하면 여기 떠요" + [＋ 제보](아웃라인). 채운 레드는 FAB [＋ 제보] 하나 그대로.
- **화면 5 내 활동**(시트 `me`): 헤더 = 핸들 + ✕. 본문: **프로필 행**(40px 틴트 원 + 첫 글자 / 닉네임 16 semibold + "카카오로 로그인됨" 12 fg-tertiary / 오른쪽 옅은 [수정]) → 16 아래 **세그먼트** [찜] [내 리뷰] [내 제보](가라앉은 트랙 + 흰 활성 세그먼트, 공통 블록 규칙 — 새 `Segmented`) → 탭 본문(4상태) → 맨 아래 "로그아웃 │ 탈퇴"(12 fg-tertiary, 세로 헤어라인, 화면 2 하단 줄 문법). 찜 카드 = 화면 1 카드 + 오른쪽 44px 하트(채움, 누르면 해제·낙관). 내 리뷰 행 = 가게명(14 semibold, 누르면 상세) + 날짜 / 별 5개 / 후기 / [수정] [삭제]. 내 제보 = 화면 1 카드. 빈 상태 한 줄씩("아직 찜한 곳이 없어요" / "아직 남긴 리뷰가 없어요" / "아직 제보한 가게가 없어요").
- **로그인 시트**: 딤 40% + 흰 시트(라운드 20, 좌우 20, pb safe). 제목 20 semibold / 캡션 14 fg-secondary / 20 아래 [카카오로 시작하기] 48 라운드 12 `bg-kakao text-fg`(심볼은 커스텀 에셋 대기 — `ci--chat` 근접 대체) / 12 아래 "나중에 할게요"(14 fg-secondary 텍스트). 실패 시 버튼 아래 12 brand-fg 한 줄.
- **리뷰 폼**(전체 화면 dialog, 흰 표면): 상단 44 헤더(왼쪽 ✕, 가운데 "리뷰 남기기"/"리뷰 수정") → 가게명(20 semibold) + "다녀온 이야기를 남겨주세요"(14 fg-secondary) → 28 아래 별 5개(각 44 히트, 채움 잉크·빔 line, 아래 캡션 "별점을 골라주세요" ↔ 고르면 "4점") → 20 아래 후기 textarea(라운드 8 bg-sunken, 최소 120, placeholder "예: 새우가 실하고 머리버터구이는 꼭", 오른쪽 아래 "0/500" 12 tabular) → 사진(＋ 타일 88, 1장) → 바닥 CTA [등록하기]/[저장하기] 48. 별점 없이 누르면 별 아래 오류 한 줄. 제출 중 "등록 중…".
- 카카오 옐로는 지하철 노선색과 같은 **사실 표기**(브랜드 가이드) — `kakao-500 #FEE500`, 글자는 잉크(fg). 이 버튼 한 곳에만.

## 목표 화면 (390)

```
[화면 4 — 칩 켬]                         [화면 5 — 내 활동]                    [로그인 시트]              [리뷰 폼]
┌─ 🔍 가게·동네 검색 ── (👤) ┐           ┌─ ── ✕ ────────────┐                ┌───────────────────┐      ┌ ✕   리뷰 남기기  ┐
│ [전체▾][머리버터구이][라면]…[새로 들어온 집✓]│ (새) 새우헌터    [수정] │             │   (딤)            │      │ 나라수산          │
│         지도: 신규 마커만              │     카카오로 로그인됨   │                │┌─────────────────┐│      │ 다녀온 이야기를…   │
│ ── 새로 들어온 집 3곳 ──              │ [ 찜 ][내 리뷰][내 제보]│                ││ 카카오로 로그인   ││      │ ☆ ☆ ☆ ☆ ☆        │
│ 아직 검증 전이에요. 다녀오셨다면…     │ ▣ 나라수산   ♥  어제 확인│                ││ 리뷰를 남기려면…  ││      │ 별점을 골라주세요   │
│ ▣ 수성2호왕새우…  2026.08.27 등록     │   850m · 마포구 · 새우구이│              ││[ 카카오로 시작하기]││      │ ┌───────────────┐ │
│   관악구 · 새우구이                   │ ▣ 365활새우… ♥  3주 전 확인│             ││   나중에 할게요   ││      │ │ 후기(선택)     │ │
│   왕새우소금구이 한판 45,000원        │ …                        │               │└─────────────────┘│      │ └────────0/500─┘ │
│   검증 전        [✓ 맞아요] [달라요]  │ 로그아웃 │ 탈퇴          │               └───────────────────┘      │ [＋ 사진]         │
│ ▣ 성수부두        2026.08.27 등록     └───────────────────┘                                              │ [   등록하기    ] │
│   ✓ 확인됨       [✓ 확인했어요][달라요]                                                                   └───────────────────┘
```

---

## 변경

### 1. 문서 먼저 — `docs/design.md` 화면 4·5 v2 + 정정
- 화면 4·5 블록을 위 언어로 재작성(꼬리 "(v1 초안…)" 제거). 화면 5에 변형: (a) 로그인 시트 (b) 리뷰 폼·수정 (c) 본인 리뷰 행 [수정][삭제]·"수정됨"·인라인 삭제 확인 (d) 탈퇴 확인 (e) 상태 — 로딩 스켈레톤(프로필·카드 3)/빈/에러/익명 진입.
- 화면 1 항목 1: 검색 바 오른쪽 프로필 슬롯. 화면 2 항목 7·8: [리뷰 남기기] 로그인 게이트, 본인 리뷰 [수정][삭제]·"수정됨". 토큰 표: `kakao-500`(Primitive, 사실 표기).
- `docs/spec.md` 4.4: "지도 위 '신규 N곳' 버튼" → "[새로 들어온 집] 칩 → 시트가 패널로(전체 최신순)"; 달라요 = 사유 시트. 4.2-7 리뷰 남기기 게이트 한 줄.
- `docs/decisions.md`: `## 2026-09-04 — Phase 4 신규 패널·내 활동·로그인(화면 4·5) v2` 결정 표 전부 + 커스텀 에셋 목록에 **카카오 심볼**. 플랜은 `cp`로 `docs/plans/phase4-activity.md`.

### 2. 데이터 — `lib/types.ts` · `lib/data.ts` · 목 JSON
- **타입**: `Review {id, placeId, authorId, rating, text, nickname, at, editedAt?, photoUrl?}`, `MyReview = Review & {placeName}`, `Place.reporterId?: string`, `Session {userId, provider: "anonymous"|"kakao", nickname: string|null}`, `PlaceFlagReason = "location"|"menu"|"closed"|"other"`.
- **목 JSON**: `reviews.json`에 `id`("rv001"…)·`authorId`(새우헌터 2건 = `"u-kakao-1"`, 나머지 `"anon-…"`) 추가. `places.json` p019 `checkCount 0 → 1`(확인됨 표본, 리뷰가 이미 있음).
- **세션(목 전용 블록)**: 모듈 `currentSession`(익명 `anon-local-…`), `getSession()`, `signInWithKakao()`(simulateWrite → `{userId:"u-kakao-1", provider:"kakao", nickname:"새우헌터"}` + 익명의 찜 Set·`reporterId`·`checkins.actor` 승계), `signOut()`(새 익명), `deleteAccount()`(내 리뷰 `deletedAt`, 찜 삭제, `reporterId` 해제 → 새 익명), `updateNickname(nickname)`(zod trim 2~12, 카카오만).
- **찜**: `Map<userId, Set<placeId>>`. `getBookmarkedPlaceIds()`·`toggleBookmark(id)`는 현재 세션 기준(시그니처 유지).
- **리뷰**: `reviewInputSchema {placeId, rating int 1~5, text trim ≤500, photo File|null}`. `submitReview(input, now)` → 카카오 아니면 reject("login required") → simulateWrite → `Review` 추가 + `place.lastCheckedAt=now`·`checkCount+1`·checkin(actor=userId) → `{review, place}`. `updateReview(id, {rating,text}, now)` → 본인만, `editedAt`. `deleteReview(id)` → 본인만, `deletedAt`. `getPlaceDetail`·`getReviews`는 삭제 제외. `getMyReviews(now): MyReview[]`(최신순), `getMyReports(now): Place[]`(reporterId = 나, 최신순).
- **달라요**: `flagPlace({placeId, reason})` — zod + simulateWrite(사진 신고와 같은 계약).
- `submitReport`: `reporterId: session.userId`.
- 테스트 `lib/__tests__/data.test.ts`: 세션 기본 익명 / 로그인 승계(찜·제보·체크인 actor) / 로그아웃 새 익명 / 탈퇴 정리 / 리뷰 등록 게이트·확인일 갱신·평균 3개 규칙 유지 / 수정 editedAt·타인 거부 / 소프트 삭제 제외 / flagPlace 검증 / 닉네임 범위.

### 3. 공용 UI — `components/ui/`
- `segmented.tsx`: `role="tablist"` + `aria-selected`, 트랙 `bg-bg-sunken rounded-8 p-0.5`, 활성 `bg-bg shadow-float rounded-6 text-fg`, 비활성 `text-fg-secondary`, 높이 36. 호출자: 내 활동 탭(공통 블록 "탭 전환은 세그먼트").
- `modal-sheet.tsx`: `<dialog>` 바텀 모달(body 포털, `showModal`, 배경 탭·Escape·`close` 이벤트 → `onClose` 하나로, 딤 `bg-common-100/40`, 시트 `rounded-t-20 bg-bg pb-safe-bottom-or-3`, 라벨 prop). 호출자 3: 로그인 시트, 달라요 사유, 탈퇴 확인.
- `search-bar.tsx`: `trailing?: ReactNode`(검색어 없을 때만 렌더, 있으면 지우기 ✕).
- `bottom-sheet.tsx`: `SheetMode`에 `"me"` 추가 — 기하·헤더·no-dismiss는 report와 같은 분기. `app/globals.css` `[data-mode="report"]` 셀렉터에 `[data-mode="me"]` 병기. `sheetSnaps`/`resolveRelease` 테스트 1건.
- `place-card.tsx`: `trailing?: ReactNode` — 카드 버튼의 형제(li 안 absolute, 세로 중앙)로 하트 44px. 내 활동 찜 탭만 쓴다.
- `photo-picker.tsx`: 변경 없음(`max=1`로 리뷰 폼이 재사용).

### 4. 세션 — `components/auth/` (새 디렉터리)
- `session-provider.tsx` + `use-session.ts`: 컨텍스트 `{session, status: "loading"|"ready", requireLogin(reason: "review"|"me"): Promise<boolean>, signOut, deleteAccount, updateNickname}`. `requireLogin`은 이미 카카오면 즉시 true, 아니면 로그인 시트를 열고 resolver를 ref에 둔다(성공 true / 닫기 false). 프로바이더가 `<LoginSheet>`를 직접 렌더한다 — PlaceSheet에 prop을 꿰지 않는다.
- `login-sheet.tsx`: ModalSheet + 이유별 카피 + [카카오로 시작하기](pending "로그인 중…") + 오류 줄 + "나중에 할게요". 히스토리: `{…현재 상태, saeuOverlay: true}` push, 열린 동안 popstate → 닫기(사진 뷰어 패턴 — `lib/history-state.ts`에 `saeuOverlay` + `isOverlayHistoryState`). 제보 모드 위에서는 열리지 않는다(완료 화면은 상세로 넘어간 뒤 게이트).
- `profile-button.tsx`: 검색 바 trailing. aria-label "내 활동".
- `map-screen.tsx`: `<SessionProvider>`로 감싸고 내부를 `MapScreenBody`로 분리(훅에서 `useSession()`을 쓰기 위해).
- 테스트 `components/auth/__tests__/session.test.tsx`: 게이트 true/false, 실패 오류 줄, 로그아웃 후 익명.

### 5. 신규 패널 — `components/map-screen/new-places-panel.tsx`
- `use-map-screen.ts`: `chips.includes("new")`면 `newPanel` 파생 = `filterPlaces(places, {tab, chips, query, bookmarked})`(뷰포트 제한 없음) → `createdAt` 내림차순. `PlaceSheet`에 `newPanel: Place[] | null` 전달 — 헤더(제목·캡션 교체, 정렬 트리거 숨김)와 본문(행 목록/빈 상태)이 바뀐다. 마커·`areaLabel`은 기존 파이프라인(필터가 신규만 남긴다).
- `new-place-row.tsx`: 위 디자인. [맞아요] → `onCheckIn(id)`(부모 `usePlaceDetail.checkIn`과 같은 낙관 로직을 훅 `useCheckIn(place, now, checked, onPatchPlace, onChecked, onNotice)`로 **추출해 둘이 공유** — 세 번째 호출자는 아니지만 같은 낙관·롤백 코드를 두 번 쓰지 않는다). [달라요] → `FlagSheet`(ModalSheet, 사유 4행, 탭 = 제출, `flagPlace`, 성공 토스트 "알려주셔서 고마워요", 실패 시 시트 안 오류 + 재탭).
- 빈 상태 `EmptyKind: "new"` 추가(`renderEmpty` switch에 컴파일 강제): "이번 주 새 제보가 없어요" / "제보하면 여기 떠요" + [＋ 제보].
- 테스트 `components/map-screen/__tests__/new-places-panel.test.tsx` + `map-screen.test.tsx`(칩 → 헤더 "새로 들어온 집 N곳", 뷰포트 밖 신규도 보임, 맞아요 낙관/원복, 달라요 시트 제출, 빈 상태).

### 6. 리뷰 — `components/review/` (새 디렉터리) + 상세 연결
- `review-form.tsx`(dialog 전체 화면, `--vvh`/`--kb` 기준 높이) + `star-rating-input.tsx`(`role="radiogroup"`, 별 5개 버튼 44, 채움 잉크) + `use-review-form.ts`(값·검증 `reviewInputSchema.safeParse`·pending·submit/update). 신규·수정 두 모드(`initial?: Review`). 히스토리 엔트리 `saeuOverlay`(사진 뷰어와 같은 방식).
- `use-place-detail.ts`: `writeReview()` = `requireLogin("review")` → alive 가드 → 폼 열기. 성공 시 리뷰 목록 맨 앞 추가 + `onPatchPlace(place)`(확인일 갱신) + 토스트 "리뷰를 남겼어요". `editReview(review)`, `deleteReview(id)`(낙관 제거 → 실패 원복 + 토스트 "리뷰를 삭제하지 못했어요"). `autoReview` prop(완료 화면 진입) 1회 소비.
- `review-section.tsx`: `session.userId === review.authorId`면 행 오른쪽 [수정] [삭제] + 인라인 확인, `editedAt`이면 날짜 옆 "수정됨"(12 fg-tertiary).
- `contribution-band.tsx` 변경 없음(onWriteReview가 게이트로 연결). `step-done.tsx` "리뷰도 남겨볼래요?" → `onOpenExisting(id, {review:true})` → `openDetailFromReport`가 `reviewIntentId` 설정.
- 테스트 `components/review/__tests__/review-form.test.tsx`(별점 없이 제출 → 오류, 500자 상한, 성공/실패, 수정 모드 프리필), `place-detail.test.tsx`(익명 → 로그인 시트, 카카오 → 폼, 본인 행 수정/삭제/수정됨, 삭제 낙관·원복).

### 7. 내 활동 — `components/activity/` (새 디렉터리) + 시트 `me` 모드
- `use-map-screen.ts`: `meOpen` 상태, `mode = detail > report > me > list`. `openMe(source)`: 익명이면 `requireLogin("me")` 뒤 열기, `listSnapRef` 저장, `setSnap("full")`, `pushState({saeuMe:true}, "", "/")`. `closeMe(source)`: ui면 `history.back()`(멱등). popstate: `meOpen && !isMeHistoryState → closeMe("history")`, `isMeHistoryState && !meOpen → openMe("history")`(상세에서 뒤로 돌아올 때). `closeDetail`은 `meOpen`이면 스냅 full. 열린 동안 상단 두 층 숨김(제보와 같음), 마커 풀 = 활성 탭 가게. `lib/history-state.ts`에 `saeuMe`.
- `activity-panel.tsx`: 프로필 행(닉네임 인라인 수정) / `Segmented` 3탭 / 탭 본문 / 하단 로그아웃·탈퇴. `use-activity.ts`: 탭별 로드(`getBookmarkedPlaceIds`+places, `getMyReviews`, `getMyReports`) 4상태 + 찜 해제 낙관 + 리뷰 수정(같은 `ReviewForm`)·삭제. 로그아웃 → `signOut` → 패널 닫힘 + 토스트 "로그아웃했어요" + 찜 state 갱신. 탈퇴 → ModalSheet 확인 → `deleteAccount` → 닫힘 + 토스트.
- `place-sheet.tsx`: `me?: ReactNode` 슬롯, 라벨·dismissLabel 모드별("내 활동", "내 활동 닫기").
- 테스트 `components/activity/__tests__/activity-panel.test.tsx`(3탭 4상태, 하트 해제 낙관, 리뷰 수정·삭제, 닉네임 수정 검증, 로그아웃, 탈퇴 확인 → 익명), `map-screen.test.tsx`(프로필 버튼 익명 → 로그인 시트 → 성공 → 패널, 카드 탭 → 상세 → back → 패널, 3개째 찜 넛지 1회).

### 8. 문서 정정 (마지막 커밋)
- `docs/roadmap.md` Phase 4 체크 + 결과 줄(갭 스윕 수치 — Phase 3 미기록분도 같이 확인). 옛 용어 grep: "준비 중이에요"가 남는 입구는 사진 업로드·영업시간·메뉴·수정 제안·가게 신고·사장님뿐인지 확인.

## 변경 파일

| 영역 | 파일 |
|---|---|
| 문서 | `docs/design.md` `docs/spec.md` `docs/decisions.md` `docs/roadmap.md` `docs/plans/phase4-activity.md` |
| lib | `lib/types.ts` `lib/data.ts` `lib/history-state.ts` `lib/mock/reviews.json` `lib/mock/places.json` `lib/__tests__/{data,fixtures}.ts` |
| ui | `components/ui/{segmented,modal-sheet}.tsx`(신규) `bottom-sheet.tsx` `app/globals.css`(`me` 모드·`kakao-500`) `components/map-screen/{search-bar,place-card}.tsx` |
| 세션 | `components/auth/{session-provider,use-session,login-sheet}.tsx`(신규) `components/map-screen/profile-button.tsx`(신규) `map-screen.tsx` |
| 신규 패널 | `components/map-screen/{new-places-panel,new-place-row,flag-sheet}.tsx`(신규) `use-map-screen.ts` `place-sheet.tsx` `components/place-detail/use-check-in.ts`(추출) |
| 리뷰 | `components/review/{review-form,star-rating-input,use-review-form}.tsx`(신규) `components/place-detail/{use-place-detail,review-section,place-detail}.tsx` `components/report/{step-done,report-panel}.tsx` |
| 내 활동 | `components/activity/{activity-panel,use-activity,my-reviews-list,profile-row}.tsx`(신규) `use-map-screen.ts` `place-sheet.tsx` `map-screen.tsx` |
| 테스트 | 위 각 절의 `__tests__` |

## 검증

1. 단위마다 `pnpm typecheck && pnpm lint && pnpm test 2>&1 | grep -E 'FAIL|✗|error' | head -40`.
2. `pnpm dev` + Playwright MCP **390×702 / 390×656 / 320×480**(실기기 등가, `setViewportSize`):
   - 칩 [새로 들어온 집] → 헤더 "새로 들어온 집 3곳" + 3행(성수부두 "확인됨"), [맞아요] → 즉시 확인됨·틴트, `Math.random=()=>0` 실패 원복 + 토스트, [달라요] → 사유 시트 → 토스트. 칩 해제 → 목록 복귀(스크롤·스냅 그대로).
   - 익명: 상세 [리뷰 남기기] → 로그인 시트 → [나중에] 닫힘 / [카카오로 시작하기] → 폼 열림 → 별점 없이 등록 → 오류 → 4점 + 후기 → 등록 → 상세 리뷰 맨 앞 + "오늘 확인" + [수정][삭제] → 수정 → "수정됨" → 삭제 인라인 확인. 뒤로가기 한 번에 폼만 닫힘.
   - 프로필 버튼(익명 → 시트, 로그인 → 패널): 찜 2곳 뒤 3개째 넛지 토스트 1회, 패널 찜 탭 하트 해제, 카드 탭 → 상세 → back → 패널, 내 리뷰 2건(새우헌터), 닉네임 수정, 로그아웃 → 익명(프로필 아이콘), 탈퇴 확인 → 내 리뷰 사라짐.
   - 완료 화면 "리뷰도 남겨볼래요?" → 상세 + 게이트.
   - 키보드(리뷰 textarea 위 CTA)는 실기기 항목 — 보고에 "미확인" 명시.
3. `pnpm preview`(workerd)에서 `/`·`/place/p018` 200 + 위 흐름 한 바퀴. 390 스크린샷(신규 패널·로그인 시트·리뷰 폼·내 활동 3탭) 전달.
4. `gap-sweeper`로 roadmap Phase 4 + spec 4.4·5(리뷰·로그인) + design 화면 4·5 v2 전수 대조 → 미구현 0 → roadmap 체크. `security-reviewer`(쓰기 경로 6개: 로그인·리뷰 등록/수정/삭제·달라요·탈퇴) 1회.
5. **push + PR 생성**: 플랜 승인을 push 승인으로 본다(완료 조건이 프리뷰 URL). 브랜치 `feat/phase4-activity`(origin/main에서 — 로컬 main은 PR #7 머지 전이라 fetch 먼저). PR → preview 잡 → https://preview-saeu-map.saeu-map.workers.dev 에서 같은 흐름 확인 후 URL 보고. 머지는 사용자.

## 커밋 단위 (한 턴 = 한 커밋)

1. `docs`: design 화면 4·5 v2 + 화면 1·2 정정 + spec 4.4 + decisions + 플랜 cp
2. `feat(data)`: Review id·작성자·소프트 삭제, 세션 목, 사용자별 찜, 리뷰 CRUD·flagPlace·내 리뷰/제보 + 목 JSON + 테스트
3. `feat(ui)`: Segmented·ModalSheet·SearchBar trailing·PlaceCard trailing·시트 `me` 모드·`kakao-500` + 테스트
4. `feat(auth)`: SessionProvider·requireLogin·LoginSheet·프로필 버튼·찜 넛지 + 테스트
5. `feat(new-panel)`: 신규 패널 헤더·행·맞아요(useCheckIn 추출)·달라요 사유 시트·빈 상태 + 테스트
6. `feat(review)`: 리뷰 폼 dialog·별점 입력·상세 게이트·본인 수정/삭제·수정됨·완료 화면 연결 + 테스트
7. `feat(activity)`: 내 활동 패널 3탭·프로필·닉네임·로그아웃·탈퇴·히스토리·마커 풀 + 테스트
8. `fix`/`docs`: Playwright·workerd 보정 + gap-sweeper·security-reviewer 반영 + roadmap 체크 → push·PR

## 범위 밖 (기록)
- 데스크탑 화면 9(패널 전환) — Phase 5. 지도의 찜 핀 하트 뱃지(design 9 v1)는 마커 풀 교체로 대신하고 Phase 5에서 재검토.
- 카카오 실제 OAuth·세션 지속·Turnstile·속도 제한·관리자 큐(달라요·수정 제안) — Phase 6.
- 리뷰 사진 저장(목은 버림)·리뷰 신고 — Phase 6.
