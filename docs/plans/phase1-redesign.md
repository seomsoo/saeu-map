# Phase 1 리디자인 — 버틸까 디자인 언어 이식 (design 화면 1)

## Context

Phase 1(지도 메인)은 기능·테스트·갭 스윕까지 끝났지만 시각 디자인이 약했다. 지도 위에 상단바·검색·카운터·이벤트·탭·칩 6개가 따로 떠 있어 산만하고("AI티"), 카드·시트·마커가 밋밋했다.
다른 프로젝트 **버틸까**(butilkka-fe, 디자이너와 협업한 상권 지도 앱)의 Figma 디자인을 새우맵에 맞춰 이식한다. 같은 "지도 + 상단 검색 + 필터 칩 + 상시 바텀시트" 구조라 그릇을 그대로 쓸 수 있다. **기능·상태 로직(use-map-screen, lib/*)은 유지, 표현 계층만 교체.** 데스크탑은 Phase 5.

참고 소스: Figma "버틸까" `MYU1gTAVOqauq9fUgAz53G` — 지도 홈 `596:23173`, 구 상세 `176:1140`, 검색 `176:1965`, Components `156:1204`, Type `156:1175` (Figma Desktop MCP `127.0.0.1:3845`로 읽음). 코드 `~/Desktop/butilkka-fe/src/app/index.css`(@theme), FilterChip/SearchInput/Tabs/RankingSheet/DistrictRankRow/LocationMarker/MyLocation.

### 사용자 확정 결정 (실행 시 decisions.md 기록)
1. 활성 칩 = **새우 레드 틴트**. 액센트 규칙 완화: "채운 레드 버튼은 화면당 한 곳, 틴트·마커는 허용".
2. 정렬 = 시트 안 **세그먼트 컨트롤** (써보고 이상하면 드롭다운 회귀).
3. 시즌 카운터 → **시트 헤더 부제**, 제목에 **보고 있는 지역** ("마포구 일대 12곳" / "서울 전체 421곳").
4. 마커: 멀리 = 레드 원 + 가게 수, 가까이 = 원 안에 사진, 사진 없으면 플레이스홀더(새우 아이콘 에셋 대기).
5. 지도 위엔 검색 블록 + 칩 행 **두 층만**. "새우맵" 워드마크 제거(sr-only), [+ 제보]·현위치는 시트 위 FAB 줄, 이벤트 카드는 시트 안.
6. **토큰은 버틸까 방식**(Figma 변수 1:1 미러링, Primitive + Semantic 컬렉션, 텍스트 스타일 = 유틸 1개, 임의값 금지). 값은 새우맵 것.

## 변경 파일

| 영역 | 파일 | 변경 |
|---|---|---|
| 토큰 | `app/globals.css` | `@theme static` — Primitive(red/coral/teal/gray 램프, text-* 스타일, radius-*, shadow-*, spacing-safe-*) + Semantic(bg/fg/line/brand/toast). body 자간 -0.02em·행간 1.4. `press`·shimmer 유틸. `.saeu-marker/.saeu-cluster/.saeu-sheet` 재작성 |
| 프리미티브 | `components/ui/chip.tsx` | pill 아웃라인 / 활성 틴트 / subtle 미니칩 |
| | `components/ui/segmented.tsx` (신규) | 트랙 + 세그먼트, role=group + aria-pressed |
| | `skeleton.tsx` `empty-state.tsx` `error-state.tsx` | 토큰 유틸로 교체 |
| 화면 | `components/map-screen/map-screen.tsx` | 검색 블록 + 칩 행만 지도 위. sr-only h1. 나머지는 시트로 |
| | `top-bar.tsx` | 삭제 |
| | `search-bar.tsx` `filter-tabs.tsx` `filter-chips.tsx` `event-card.tsx` `season-counter.tsx` | 버틸까 스펙으로 재스타일 |
| | `fab-row.tsx` (신규) | 현위치(36px 흰 원) + [＋ 제보](레드 pill) — 시트 위에 얹힘 |
| | `place-sheet.tsx` `place-card.tsx` | 헤더 제목·부제, 이벤트 카드 → 세그먼트 → 리스트 |
| | `sort-menu.tsx` | 삭제 (세그먼트로 대체) |
| | `use-map-screen.ts` | `areaLabel`, `locateMe()` |
| 시트 | `components/ui/bottom-sheet.tsx` | 헤더 98px, `SHEET_COLLAPSED_PX = 98`, FAB 슬롯 |
| 마커 | `components/map/marker-icons.ts` `map-view.tsx` | 36px 썸네일/플레이스홀더 핀, 44px 레드 클러스터, URL 화이트리스트 |
| 데이터 | `lib/types.ts` `lib/data.ts` `lib/mock/places.json` `public/mock/thumb-*.svg` | `Place.thumbnailUrl` + 샘플 2곳 |
| lib | `lib/places.ts` | `areaLabel(visible, total)` |
| 로딩 | `app/loading.tsx` | 새 구조 스켈레톤 |
| 테스트 | `map-screen.test.tsx` `bottom-sheet.test.tsx` `places.test.ts` `marker-icons.test.ts`(신규) | 갱신·추가 |
| 문서 | `docs/decisions.md` `docs/design.md` `CLAUDE.md` `docs/roadmap.md` | 결정 기록, 토큰 표 단일 출처, 스타일 규칙 갱신, 옛 파일명 정정 |

## 검증
- `pnpm typecheck && pnpm lint && pnpm test`
- Playwright MCP 스크린샷 390(초기·시트 3단·칩 활성·카드 선택·줌인 썸네일·검색 빈·에러·로딩) + 320·430 초기 → `.playwright-mcp/redesign-*.png`. Figma 스크린샷과 나란히 비교
- 320 상단 스택 ≤ 220px, hit-44, 컴포넌트의 `bg-brand`는 [제보] 1곳
- 임의값(`text-[`, `rounded-[`, `#hex`, `shadow-[`) grep 0건, 옛 토큰명 잔재 0건
- design 화면 1의 1~9 항목이 새 배치에서도 전부 존재

## 결과 (2026-09-02 완료)
- `pnpm typecheck && pnpm lint && pnpm test` 통과 — 테스트 112개(기존 98 + areaLabel 5 + marker-icons 8 + 내 위치 1). 컴포넌트·app에 임의값(`text-[`·`rounded-[`·`#hex`·`shadow-[`) 0건, 옛 토큰명 잔재 0건, `bg-brand`는 [제보] 1곳.
- 생성 CSS에 토큰 유틸 전부 존재 확인(`text-body-m-medium`, `pt-safe-top-or-3`, `rounded-max`, `shadow-upper`, `h-6.5`, `z-1` …). `@theme static` + `--color-*: initial` 조합이 Tailwind 4.3에서 의도대로 동작.
- Playwright 스크린샷 `.playwright-mcp/redesign-*.png`: 390 초기·줌인 썸네일 마커·마커 선택·시트 full/collapsed·칩 활성·에러, 320·430 초기. 상단 스택 실측 122px(예산 220), 320에서 칩 행 가로 스크롤 동작, 320×568에선 half=collapsed(98px)로 제목·부제·FAB까지 보임. 썸네일 마커는 성동구 줌인(p018·p019)에서 img로 렌더, 신규는 점선 링, 선택은 확대+잉크 링.
- 계획과 달라진 것: 지도 래퍼에 `z-0`(스태킹 컨텍스트) 추가 — SDK 컨트롤이 시트 위로 새지 않게 하는 방어. 스크린샷 하단의 "N" 배지는 Next.js 개발 도구(NEXTJS-PORTAL)라 프로덕션엔 없음. `OutlineButton` 프리미티브를 추가해 빈/에러 상태 버튼을 통일.
- 2차 피드백 반영: 카테고리 탭 3개 → [전체 ▾] 드롭다운 칩(`components/ui/dropdown-chip.tsx`, `category-dropdown.tsx`), 라벨 소금구이·생새우회, `--shadow-card` 토큰 추가.
- 3차 피드백 반영: 사이드 필터 칩 3개(머리버터구이·라면·볶음밥) 추가로 칩 5개(spec 상한). `EmptyKind "filter"` + [필터 해제], `assertNever` exhaustive switch, 용어 "곁들임"→"사이드"(spec·design·코드).
- 남은 것: 새우 마커 플레이스홀더 아이콘 에셋(decisions 목록). 정렬 세그먼트 사용감 재검토. Figma Desktop MCP 등록(`claude mcp add --transport http figma-desktop http://127.0.0.1:3845/mcp`)은 다음 화면 작업 전에.
