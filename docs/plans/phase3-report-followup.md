# Phase 3 보완 — 제보 2·3단계 4건 (탭으로 핀 이동 · 핀 자리 기존 가게 · 전국 허용 · 마리 입력 위치)

## Context

Phase 3 제보 플로우(`feat/phase3-report`, 11 커밋)를 눌러 본 뒤 나온 4가지 지적을 고친다. 전부 2단계(위치)·3단계(메뉴) 안의 일이고 데이터 계층은 구 판정 범위만 넓어진다.

1. **핀을 끌기보다 지도를 탭하면 핀이 오게** — 44px 핀을 손가락으로 집어 끄는 것보다 "여기" 탭이 쉽다. 드래그는 미세 조정용으로 남긴다.
2. **핀을 놓은 자리에 이미 등록된 가게가 있을 때** — 지금은 상호가 비슷할 때(150m + 유사도)만 묻는다. 이름을 다르게 적고 핀을 기존 가게 위에 놓으면 그대로 중복이 생긴다. 아무 처리도 없다.
3. **서울 밖 차단 해제** — "서울 안의 위치만 제보할 수 있어요"를 풀고 전국을 받는다. 구 라벨은 크롤러와 같은 `김포시(경기)` 형식.
4. **[마리] 칩을 고르면 "몇 마리" 입력이 칩 행 맨 오른쪽(스크롤 밖)에 생겨 안 보인다** — 입력을 칩 행 아래로 내리고, 칩 행은 스크롤 대신 줄바꿈해 숨는 칩을 없앤다.

의존성 추가 없음. 확인한 API: react-naver-maps 0.2.2 `NaverMap`의 `onClick`·`onTap`(`naver.maps.PointerEvent`, `e.coord`), 이미 쓰는 `Marker onClick`. 전국 경계 데이터: `southkorea/southkorea-maps` `kostat/2013/json/skorea_municipalities_geo_simple.json`(Apache-2.0, 251개 시군구, 8,444점, 370KB — 좌표 5자리 반올림·속성 정리 후 약 180KB). 원본 해상도(`skorea_municipalities_geo.json`)는 55MB라 전국을 서울처럼 20m로 담을 수 없다.

---

## 결정

| 항목 | 결정 | 근거 |
| --- | --- | --- |
| 핀 이동 | **지도 탭 = 핀 이동**(2단계에서만), 드래그는 유지. 지도는 움직이지 않는다(탭한 자리가 곧 보이는 자리). 캡션 "지도를 탭하거나 핀을 끌어 맞춰주세요" | 사용자 지적 1 |
| 핀 자리의 기존 가게 | [여기가 맞아요] 때 **상호 무관 30m 근접 검사**를 더한다(상호 유사 150m 검사가 먼저, 없으면 30m 안 가장 가까운 가게). 같은 중복 의심 패널을 쓰되 제목만 "핀 자리에 이미 등록된 가게가 있어요". [다른 가게예요]면 역시 `duplicateSuspectOf`(관리자 큐). 30m = 같은 건물·옆 점포 거리 — 수산시장처럼 붙어 있는 다른 점포는 "다른 가게예요"로 통과 | 사용자 지적 2 |
| 2단계 마커 탭 | 2단계에서 **기존 마커를 탭하면 그 가게로 중복 의심 패널**이 바로 열린다(핀은 그대로). 이미 있는 마커가 보이면 그걸 누르는 게 자연스럽다. 1·3·4단계는 지금처럼 무반응 | 사용자 지적 2 |
| 전국 허용 | 구 판정 데이터를 **서울 25구(원본 해상도, 20m) + 전국 시군구 단순화본(서울 제외 226개)**으로 합친다. 라벨: 서울은 "마포구", 그 밖은 `"{시군구}({시도 약칭})"`("김포시(경기)", "해운대구(부산)", "창원시 진해구(경남)") — 시드의 김포 표기와 같고, 동구·남구·북구·중구·서구·강서구·고성군 같은 중복 이름이 구별된다. 시도 약칭은 KOSTAT 코드 앞 두 자리(11 서울·21 부산·22 대구·23 인천·24 광주·25 대전·26 울산·29 세종·31 경기·32 강원·33 충북·34 충남·35 전북·36 전남·37 경북·38 경남·39 제주). 한국 밖(바다)만 "한국 안의 위치만 제보할 수 있어요" | 사용자 지적 3 |
| 전국 정밀도 | 서울 밖 경계는 단순화본이라 시군구 **경계 근처 수백 m는 옆 시군구로 갈 수 있다**. 라벨은 "어느 동네냐"용이고 Phase 6 관리자가 고칠 수 있어 받아들인다(55MB 원본을 클라이언트에 실을 수 없다) | 권고 |
| 비용 | API 호출 증가 없음(전부 클라이언트 연산). 경계 JSON은 **두 파일**: 서울 `lib/gu-boundaries.json`(60KB, 지금 그대로)을 먼저 보고, 서울 밖일 때만 `lib/gu-boundaries-korea.json`(약 180KB, gzip 60KB)을 동적 import. 둘 다 2단계 확정 때 한 번, 이후 캐시 | 사용자 질문 |
| 몇 마리 입력 | [마리]를 고르면 **칩 행 아래에** `TextField`(라벨 "몇 마리", 접미 "마리", 숫자 키패드, 폭 128)가 펼쳐지고 바로 포커스. 오류 "몇 마리인지 알려주세요"는 그 입력 아래 | 사용자 지적 4 |
| 단위 칩 행 | 가로 스크롤 → **줄바꿈**(320·390에서 2줄). 마지막 칩이 잘려 숨는 것이 문제의 원인이라 스크롤을 버린다 | 사용자 지적 4 |

---

## 변경

### 1. 지도 탭으로 핀 이동 (`components/map/map-view.tsx`, `use-map-screen.ts`, `map-screen.tsx`)

- `MapViewProps`에 `onMapTap?: ((point: LatLng) => void) | undefined`. `NaverMap`에 `onClick`·`onTap` 둘 다 같은 핸들러(`toLatLng(navermaps, e.coord)`) — 모바일은 `tap`, 데스크탑은 `click`. 둘이 연달아 오면 같은 좌표라 두 번 setState해도 무해.
- `use-map-screen.ts` `moveReportPin(point, source)`의 source에 `"tap"` 추가(지도 이동 없음 — `"search"`만 focus). `map-screen.tsx`: `onMapTap={s.reportStep === 2 ? (p) => { s.moveReportPin(p, "tap"); } : undefined}`.
- 2단계 캡션: "지도를 탭하거나 핀을 끌어 맞춰주세요" (`step-location.tsx`, design 3-2).

### 2. 핀 자리 기존 가게 + 2단계 마커 탭 (`components/report/step-location.tsx`, `lib/duplicates.ts`, `use-map-screen.ts`, `report-panel.tsx`)

- `lib/duplicates.ts`: `PIN_OVERLAP_KM = 0.03`, `findOverlapping(point, places): Place | null`(30m 안 가장 가까운 가게, 상호 무관). `findDuplicate`는 그대로.
- `step-location.tsx` `confirm`: `findDuplicate(...) ?? findOverlapping(pin, places)`. 후보 상태를 `{ place, reason: "name" | "overlap" }`으로 들고 제목만 분기("150m 안에 비슷한 가게가 있어요" / "핀 자리에 이미 등록된 가게가 있어요"). 이미 "다른 가게예요"라고 답한 후보는 두 검사 모두에서 건너뛴다(`isDuplicateDismissed`).
- 마커 탭: `use-map-screen.ts` `selectFromMarker`에서 `reportStepRef.current === 2`면 `openDetail` 대신 `reportMarkerTapRef`/state로 패널에 알린다 — 훅에 `reportCandidateId: string | null` state + `setReportCandidate` 노출. `ReportPanel` prop `tappedPlaceId`를 `StepLocation`이 받아 그 가게로 후보 패널을 연다(사유 `"overlap"` 제목). 패널의 ‹로 닫으면 `onClearTapped`로 state를 비운다. 다른 단계에선 지금처럼 무시.
- 후보 패널이 열릴 때 `onShowCandidate`(fitBounds)는 지금대로.

### 3. 전국 (`scripts/fetch_gu_boundaries.py`, `lib/gu-boundaries.json`, `lib/gu.ts`, `lib/data.ts`, `step-location.tsx`)

- 스크립트: 서울(원본 해상도, DP 20m — 지금 그대로 `lib/gu-boundaries.json`)에 더해 전국 단순화본을 받아 code 앞자리 `11`(서울)을 뺀 226개를 **별도 파일 `lib/gu-boundaries-korea.json`**으로 굽는다. 라벨 규칙: `PROVINCE_BY_CODE_PREFIX` 표로 `"{name}({시도})"`, `name`이 `X시Y구`(예: 창원시진해구)면 `"X시 Y구"`로 띄어쓴다. `districts[].name`은 최종 라벨, 각 파일 머리에 출처(둘 다 Apache-2.0). idempotent 유지, `--source-seoul`/`--source-korea` 옵션.
- `lib/gu.ts`: 서울 파일을 먼저 판정하고, 없을 때만 전국 파일을 동적 import(각각 한 번 캐시). 주석·문서 문자열을 "시군구"로.
- `lib/data.ts`: `submitReport`의 에러 메시지 `"outside korea"`, `getGuOfPoint` 주석. `reportInputSchema`의 lat 33~39·lng 124~132는 그대로(한국 범위).
- `step-location.tsx`: `OUTSIDE_SEOUL_ERROR` → `OUTSIDE_KOREA_ERROR = "한국 안의 위치만 제보할 수 있어요"`.
- 문서: design 화면 3 변형 (b)·"저장되는 것"·spec 4.3-2·decisions(전국 허용·라벨 규칙·정밀도 차이·30m·탭 이동·마커 탭·마리 입력). CLAUDE.md의 "서울 새우구이 지도"는 제품 정체성이라 그대로.

### 4. 몇 마리 입력 위치 + 칩 줄바꿈 (`components/report/step-menu.tsx`, design 화면 3-3)

- 칩 행: `no-scrollbar overflow-x-auto` → `flex-wrap`. 행 안의 `<input aria-label="몇 마리">` 제거.
- `value.unit === "count"`일 때 칩 행 아래 `<TextField className="mt-3 w-32" label="몇 마리"(회 줄은 "새우회 몇 마리") suffix="마리" inputMode="numeric" maxLength={3} error={errors.count} />`, 마운트 시 포커스(ref). 단위 오류 줄은 `errors.unit`만 보여준다.

### 5. 테스트

- `lib/__tests__/duplicates.test.ts`: `findOverlapping` — 30m 안 가장 가까운 것, 30m 밖 null, 상호 무관.
- `lib/__tests__/gu.test.ts`: 김포 고촌 → "김포시(경기)", 해운대(35.1631, 129.1635) → "해운대구(부산)", 제주시(33.5, 126.53) → "제주시(제주)", 창원 진해 → "창원시 진해구(경남)", 서울시청 → "중구"(정밀 유지), 바다(36.0, 125.0)·독도 밖 → null. `data.test.ts`의 "서울 밖 좌표(김포)는 거부" → 김포는 등록되고 gu가 "김포시(경기)", 바다는 거부.
- `components/report/__tests__/report-flow.test.tsx`: 2단계 — 상호 다르고 핀이 기존 가게 20m 안이면 "핀 자리에 이미 등록된 가게가 있어요" 패널, 40m면 바로 3단계; `tappedPlaceId`로 후보 패널이 열리고 ‹로 닫힘; 3단계 — [마리] → 라벨 "몇 마리" 입력이 칩 행 아래에 나타나고 포커스, 비면 오류가 그 아래.
- `components/map-screen/__tests__/map-screen.test.tsx`: 가짜 `NaverMap`이 `onClick`을 받아 "지도" 버튼으로 노출 → 2단계에서 누르면 핀 마커가 남고 `setZoom`/`panTo`가 더 불리지 않음(탭은 지도를 안 움직인다); 1단계에선 무시. 2단계에서 마커(나라수산) 탭 → "핀 자리에 이미 등록된 가게가 있어요" + [이 가게예요]로 상세.
- `components/ui/__tests__/bottom-sheet.test.tsx`·기타는 변경 없음.

## 검증

1. `pnpm typecheck && pnpm lint && pnpm test 2>&1 | grep -E 'FAIL|✗|error' | head -40`; `python3 scripts/fetch_gu_boundaries.py` 두 번 돌려 `git diff` 없음, 파일 크기 확인(약 240KB).
2. Playwright(`pnpm dev` :3000, 390/320): 2단계에서 빈 지도 자리를 클릭 → 핀이 그 자리로(지도 이동 없음, `.saeu-report-pin` 좌표 변화) → 드래그도 여전히 됨. 기존 마커(성수부두) 클릭 → "핀 자리에 이미 등록된 가게가 있어요" 패널 → ‹ → 핀 화면. 상호를 전혀 다르게 넣고 핀을 성수부두 위에 두고 확정 → 같은 패널. 위치를 김포 고촌으로 두고 확정 → 통과, 완료 카드에 "김포시(경기)". 3단계 [마리] → 입력이 칩 아래에 보이고 포커스(320에서 스크린샷). 스크린샷 `.playwright-mcp/report-fix-*.png`.
3. 실기기 탭(터치 `tap` 이벤트)은 헤드리스 마우스로만 확인 — 보고에 명시.
4. `gap-sweeper`로 spec 4.3 + design 화면 3 재대조(변경 항목 위주).

## 커밋 단위 (한 턴 = 한 커밋)

1. `feat(data)`: 전국 시군구 경계 + 라벨 규칙 + "한국 안" 메시지 + 테스트
2. `feat(report)`: 지도 탭으로 핀 이동 + 30m 근접 검사 + 2단계 마커 탭 후보 패널 + 테스트
3. `fix(report)`: 몇 마리 입력을 칩 행 아래로 + 칩 줄바꿈 + 테스트
4. `docs`: design 화면 3·spec 4.3·decisions 정정 + Playwright 보정 + 플랜 `docs/plans/phase3-report-followup.md`
