# 실기기 확인 2차 — 키보드·3단계·현위치 마커

## Context

`fix/device-viewport`(PR #7)를 폰에서 확인한 뒤 나온 4건. 앞 작업(뷰포트 보정)은 끝났고 커밋 `85dae14`(칩 세로 이동 + 가로 세이프에어리어)까지 **로컬에만** 있다 — 이번 것들과 함께 올린다.

**#1이 이번 배치의 본체다.** 백로그에 "iOS 키보드가 fixed 시트의 하단 CTA를 덮는다"로 적어 뒀던 게 실기기에서 확인됐는데, 실제 증상은 예상보다 나쁘다. 스크린샷 2장(사파리 IMG_3654 · 네이버 인앱 IMG_3655) 모두:

- 제보 1단계에서 가게 이름에 포커스 → **[새로 등록하기] CTA와 캡션만 남고 위쪽 전부가 빈 흰 화면**
- 정작 타이핑 중인 입력 필드·제목·진행바가 사라진다

메커니즘: 시트가 `position: fixed; bottom: 0; height: 92dvh`인데 **iOS는 키보드가 떠도 레이아웃 뷰포트를 안 줄인다.** iOS가 포커스된 입력을 보이려고 visual viewport를 아래로 스크롤(`offsetTop` ≈ 키보드 높이)하면서, 시트 위쪽에 있던 콘텐츠가 화면 위로 밀려나고 시트 바닥의 CTA만 남는다.

**`interactive-widget`으로는 못 고친다** — Chrome 108+ / Firefox 132+ 전용이고 **Safari에는 아직 없다**(WebKit 버그 259770 오픈). 폰이 iOS라 `visualViewport` 구독이 필요하다.

의도한 결과: 키보드가 떠도 입력 필드와 CTA가 같이 보인다. 그리고 Phase 4의 리뷰 작성 폼이 같은 자리를 다시 만들기 전에 시트가 이 문제를 이미 처리하고 있게 한다.

## 확정된 결정 (사용자)

- **필수 표시**: 캡션에서 한 번만 명시. 3단계는 전부 필수, 4단계는 전부 선택이라 이미 단계 단위로 갈렸다 — 필드마다 `*`는 노이즈.
- **새우회 필드**: 토글을 켜면 새우회 메뉴명에 **포커스**(`[마리]` 칩이 "몇 마리" 입력에 포커스하는 기존 방식과 같음).
- **현위치 마커**: 넣는다. **최종은 새우 모양**이지만 지금은 에셋이 없어 표준 파란 점으로 대체하고 `decisions.md`의 "커스텀 에셋 필요 목록"에 적는다.

---

## 작업 (커밋 단위 = 한 턴)

브랜치는 `fix/device-viewport` 그대로 (PR #7에 이어 붙인다).

### A. 키보드가 떠도 시트가 그 위에 앉는다 (본체)

`window.visualViewport`를 구독해 키보드가 먹은 높이를 CSS 변수로 내보내고, 시트가 레이아웃 뷰포트가 아니라 **보이는 영역** 바닥에 붙게 한다.

- 새 훅(`components/ui/use-keyboard-inset.ts`) — `visualViewport`의 `resize`·`scroll`에서
  `max(0, window.innerHeight - vv.height - vv.offsetTop)`을 계산해 `document.documentElement`에 `--kb`로 쓴다. cleanup에서 제거. `visualViewport`가 없으면(구형) 아무것도 안 한다.
- `components/ui/bottom-sheet.tsx`에서 호출 — `.saeu-sheet`를 소유한 컴포넌트가 소비자다.
- `app/globals.css` `.saeu-sheet`:
  - `bottom: var(--kb, 0px)` — 키보드 위에 앉는다
  - `--sheet-full: calc(92dvh - var(--kb, 0px))` — 위로 안 넘치게. `height`와 `transform`이 둘 다 `--sheet-full`을 쓰므로 스냅 계산이 그대로 맞는다

**iOS·안드로이드를 한 가지 방식으로 덮는다 — `interactiveWidget`은 쓰지 않는다.**
안드로이드 기본값은 `resizes-visual`이라 **iOS와 증상이 같다**(레이아웃 뷰포트·`innerHeight`·`dvh` 모두 그대로, visual viewport만 줄어듦). 그래서 `visualViewport` 구독 하나로 양쪽이 다 고쳐진다. `interactiveWidget: "resizes-content"`를 켜면 Chromium에서만 레이아웃 뷰포트가 줄어드는데, 그러면 **`h-dvh`인 지도 컨테이너까지 리사이즈돼 제보 2단계(주소 검색 + 지도)에서 타이핑할 때마다 지도가 튄다** — 안드로이드 전용 부작용을 새로 만드는 셈이라 안 켠다. Chromium 전용 기능 의존도 없어진다. (`visualViewport`는 Chrome 61+ · Safari 13+ · Firefox 91+로 사실상 전 기기)

**알아 둘 것**: `--kb > 0`이면 CSS(`dvh` 기반)와 JS(`window.innerHeight` 기반 `sheetVisiblePx`)가 갈린다. 앞서 "둘은 일치한다"고 판단해 통일을 보류했는데, 이 변경이 그 전제를 깬다. 다만 스냅 계산은 **드래그할 때만** 쓰이고 타이핑 중에는 드래그하지 않으므로 이번엔 두고 decisions에 적는다.

**iOS가 그래도 visual viewport를 스크롤하면**(입력이 이미 보이는데도) `offsetTop`을 되돌리는 보정이 더 필요할 수 있다. 먼저 위 변경만으로 실기기에서 확인하고, 남으면 그때 더한다 — 추측으로 미리 넣지 않는다.

### B. 3단계 — 필수 명시 + 새우회 필드 포커스

`components/report/step-menu.tsx` 한 파일.

- 캡션 `"대표 메뉴 한 줄이면 돼요"` → 세 필드가 다 필요하다는 걸 한 문장 더해 밝힌다. 기호로 문장을 잇지 않는다(design 규칙).
- `MenuLine`에 `nameRef` 옵션을 받고, `StepMenu`가 **토글로 방금 켠 경우에만** 새우회 메뉴명에 포커스한다. `report-panel.tsx`가 `switch (step)`으로 단계를 **언마운트**하므로 마운트 이펙트로 하면 ‹로 3단계에 다시 들어올 때마다 포커스를 뺏는다 — `onChange`에서 세운 플래그를 이펙트가 소비하고 되돌리는 방식으로.

### C. 현위치 마커

`userLocation`은 `use-map-screen.ts`에 이미 있다 — 마커만 없다.

- `app/globals.css` + `docs/design.md` 토큰 표: 현위치용 semantic 토큰 하나(표준 파란 점). 토큰 표가 원본이고 globals.css가 1:1 미러라는 규칙을 지킨다.
- `components/map/marker-icons.ts`: `getUserLocationIcon` + 캐시(기존 아이콘들과 같은 문법), 클래스는 `.saeu-locator`로 globals.css가 스타일
- `components/map/map-view.tsx`: `userLocation` prop을 받아 `<Marker>` 하나. 클릭 없음, `zIndex`는 가게 마커보다 아래, `title="내 위치"`
- `components/map-screen/map-screen.tsx`에서 `s.userLocation` 전달 (use-map-screen이 이미 반환하는지 확인 — 아니면 반환에 추가)
- `docs/spec.md` 4.1 · `docs/design.md` 화면 1에 항목 추가 (**spec에 없던 기능이라 결정 기록이 필수**)
- `docs/decisions.md` "커스텀 에셋 필요 목록"에 **"새우 모양 현위치 마커 — 그 전까지 표준 파란 점"**

---

## 손대는 파일

| 파일 | 무엇 |
|---|---|
| `components/ui/use-keyboard-inset.ts` (신규) | `visualViewport` → `--kb` |
| `components/ui/bottom-sheet.tsx` | 훅 호출 |
| `app/globals.css` | `.saeu-sheet` `bottom`·`--sheet-full`, `.saeu-locator`, 현위치 토큰 |
| `app/layout.tsx` | `interactiveWidget` (Android용) |
| `components/report/step-menu.tsx` | 캡션 + 새우회 포커스 |
| `components/map/marker-icons.ts`, `map-view.tsx` | 현위치 아이콘·마커 |
| `components/map-screen/map-screen.tsx`, `use-map-screen.ts` | `userLocation` 전달 |
| `docs/spec.md`, `docs/design.md`, `docs/decisions.md` | 결정·토큰·에셋 목록 |

## 검증

각 커밋마다 `pnpm typecheck && pnpm lint && pnpm test` (실패 줄만).

- **B·C는 Playwright로 확인 가능** — 390×702에서 토글을 켜면 새우회 메뉴명에 포커스가 가고 필드가 화면 안에 들어오는지, 현위치 마커가 `userLocation`에 그려지는지(geolocation 목으로). 테스트도 여기에 붙인다.
- **A는 데스크탑에서 검증이 안 된다.** 헤드리스 크롬엔 가상 키보드가 없다. `--kb`를 강제로 주입해(가로 세이프에어리어를 검증한 방식 그대로) 시트가 그만큼 올라오고 높이가 줄어드는지 배선만 확인하고, **진짜 완료 조건은 실기기**다: 제보 1·3단계와 2단계 주소 검색에서 키보드를 띄웠을 때 입력 필드와 CTA가 같이 보일 것.

### 안드로이드 — 이번엔 미확인, 코드는 대응한다

지금까지의 측정은 **전부 아이폰 하나에서 나왔다** — 뷰포트 656/694/702px도, 스크린샷 5장도 iOS다. 안드로이드 기기는 나중에 구해서 본다.

**코드는 양쪽을 다 덮는다**: A의 `visualViewport` 방식은 안드로이드 기본값(`resizes-visual`)에서도 iOS와 똑같이 동작한다. `viewport-fit: cover`와 `env(safe-area-inset-*)`도 안드로이드가 지원하고(제스처 바·펀치홀 컷아웃) 이미 들어가 있다. 다만 **동작 확인은 못 한 상태이므로 추정이다.**

- `CLAUDE.md` 확인 높이와 `decisions.md`에 **"안드로이드 미확인"을 명시**한다. 확인 안 한 걸 확인한 것처럼 적지 않는다
- 백로그에 남길 것: 기기가 생기면 시트 상단 y로 뷰포트를 역산해(사파리에서 쓴 방법 그대로) 확인 높이에 안드로이드 값을 추가, 키보드 동작, 제스처 바/3버튼 내비·펀치홀에서의 `env()` 값, 크롬·삼성 인터넷·카카오톡 인앱(WebView 버전에 따라 다르고 공유 링크가 실제로 열리는 경로다)

전체 끝나면 push → PR #7 갱신 → 프리뷰에서 재확인 (**push는 승인 후**).

## 이번에 안 하는 것 (백로그)

- **안드로이드 실기기 확인** (기기 확보 후) — 확인 높이 역산, 키보드, 제스처 바·펀치홀 `env()`, 크롬·삼성 인터넷·카카오톡 인앱
- Codex #1 거리 기준점 — 선재 결함, 역투영 필요
- 칩 터치 타겟 40px(`hit-44` 클리핑) — 되살리면 지도 8px 손해
- `window.innerHeight` ↔ `dvh` 소스 통일 — A가 전제를 깨므로 재검토 대상이 됐다
- roadmap Phase 3 갭 스윕 수치 (기록 없음)
