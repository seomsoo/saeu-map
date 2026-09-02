# CLAUDE.md — 새우맵

## 명령어
- dev: `pnpm dev` (:3000, 평상시)
- build: `pnpm build`
- test: `pnpm test` (vitest)
- lint: `pnpm lint` (eslint flat config)
- typecheck: `pnpm typecheck` (tsc --noEmit)
- 전체 검증: `pnpm typecheck && pnpm lint && pnpm test`
- 배포 전 확인: `pnpm preview` (:8787, 실제 Workers 런타임) / 배포: main 머지 → GH Actions `deploy` 잡 자동, PR → `preview` 잡이 https://preview-saeu-map.saeu-map.workers.dev 갱신 (Cloudflare Workers — decisions.md 2026-09-01). 수동은 `pnpm run deploy`.
- dev 전용 상태 토글: `/?mock=error` → 라우트 에러 화면(app/error.tsx). production에선 무시.

서울 새우구이 지도. 모바일 퍼스트 웹. 상세 스펙은 docs/를 먼저 읽어라:
- docs/spec.md — 통합 기획서 (모든 제품 결정과 이유)
- docs/design.md — 화면별 레이아웃·스타일 스펙 + 디자인 토큰 표
- docs/decisions.md — 결정 로그 (여기 없는 결정은 미정이다. 임의로 정하지 말고 물어라)

## 지금 단계
UI 먼저, 백엔드 나중. 모든 데이터는 lib/mock/의 JSON을 lib/data.ts 함수로 읽는다.
Supabase는 아직 없다. Supabase 코드를 지금 쓰지 마라.

## 라이브러리·버전
- 버전 특정 문법이나 사용법이 불확실하면(Next.js, Tailwind, 네이버 지도 SDK, Supabase 등) 기억에 의존하지 말고 **context7으로 최신 문서를 확인한 뒤** 작성하라. 특히 마이너 라이브러리일수록.
- 버전 정책: 최신 안정 버전. 단 메이저 릴리스 직후면 한 마이너 기다린다. 플랜에 주요 의존성 버전을 명시하라.
- 새 패키지 추가는 플랜에 명시하고 최근 릴리스·주간 다운로드를 확인한 뒤에만.
- next/image 최적화는 끈다(unoptimized). 사진은 업로드 시 리사이즈본을 만들므로 플랫폼 이미지 최적화(과금 대상)를 쓰지 않는다. 배포는 Cloudflare Workers(`pnpm deploy`) — decisions.md 2026-09-01.

## 절대 규칙 (위반 = 작업 실패. 순차적으로 린트·훅으로 승격해 기계적으로 막는다 — 위반 패턴 발견 시 규칙 추가를 제안하라)
1. 컴포넌트에서 데이터 직접 접근 금지. 모든 읽기/쓰기는 lib/data.ts 함수 경유. (나중에 이 파일만 Supabase로 교체한다)
2. 네이버·카카오 API 응답을 상태·파일·DB에 저장하는 코드 금지. 지도 SDK 표시용 라이브 호출만.
3. 외부 이미지 도메인(pstatic.net, kakaocdn 등) 사용 금지. 이미지는 우리 스토리지(목 단계: /public)만.
4. localStorage/sessionStorage 사용 금지. 상태는 메모리, 지속은 (나중에) 서버.
5. 시크릿을 코드에 박지 마라. .env만.
6. dangerouslySetInnerHTML 금지 (리뷰·코멘트는 유저 입력이다).
7. service_role 등 서버 전용 키는 클라이언트 번들에 절대 못 들어간다. NEXT_PUBLIC_ 접두사는 허용 목록(네이버 지도 Client ID, Supabase anon 키, 카카오 JS 키(공유용))만 — 목록 밖 추가는 리뷰에서 잡는다.

## 스타일 (docs/design.md 공통 블록·토큰 표가 원본 — 2026-09-02 버틸까 디자인 언어 채택)
- 라이트 모드 우선. 색은 전부 CSS 변수 토큰으로 — Figma 변수와 1:1(Primitive 램프 + Semantic 역할). 다크는 Semantic만 두 번째 벌.
- 임의값 금지: `text-[13px]`·`#hex`·`rounded-[8px]` 대신 토큰 유틸(`text-body-m-medium`, `bg-bg-sunken`, `rounded-8`)만. 텍스트는 스타일 12종만 (globals.css가 기본 팔레트·라운드·그림자·텍스트 스케일을 지워 둠).
- 브랜드 레드 #F04A28: **채운 레드 버튼은 화면당 한 곳**. 활성 칩·라벨은 틴트(red-10 배경 + red-600 글자), 클러스터 마커는 레드 원. 카테고리 색점: 소금구이(구이) #F0885C / 생새우회(회) #14957B (마커 링·카드 색점만). 화면 라벨은 "소금구이"·"생새우회".
- Pretendard self-host, 자간 -2%·행간 140%. 가격·거리·단위는 tabular numbers.
- 라운드 6/8/12/20/pill. 헤어라인 보더. 그림자는 지도 위에 뜨는 요소·시트 상단에만 옅게(float/upper/fab/marker). 칩은 pill 아웃라인 기본, 활성만 틴트.
- 지도 위에는 검색 블록·칩 행 두 층만. 로고·카운터·이벤트·주 버튼은 지도 위에 두지 않는다(시트로).
- 아이콘 coolicons(Iconify ci). 없으면 근접 대체하고 docs/decisions.md의 "커스텀 에셋 필요" 목록에 적어라.
- 금지: 크림+세리프, 카드 색 띠, 이모지 헤더, 그라데이션 배경, 보라색.
- 애매한 디자인 판단은 버틸까 디자인 언어(docs/design.md 공통 블록) → 캐치테이블·테이블링(2026 한국 앱) 순으로 따른다.

## 컨벤션 (애매할 때의 기본값 출처)
- 코드 구조·패턴 판단이 애매하면 bulletproof-react 컨벤션을 따르되 1인·소규모에 맞게 단순화한다.
- 커밋은 Conventional Commits (feat/fix/chore/docs/refactor).
- 브랜치는 trunk-based: main + 수 시간짜리 짧은 브랜치. 오래 사는 브랜치 금지.
- 테스트는 Testing Library 원칙: 구현이 아니라 동작을, 사용자가 보는 방식(getByRole)으로.
- 시간: 저장은 UTC ISO, "이번 주"·"○일 전" 계산과 표시는 Asia/Seoul 고정.

## UI 완성 기준 (화면마다)
- 4상태: 로딩 스켈레톤 / 빈 상태 / 에러 / 정상 — 공용 컴포넌트 재사용.
- 쓰기는 상태 변화까지: "다녀왔다면"은 낙관적 업데이트 + 실패 롤백 (목 함수에 delay 400ms, 10% 실패).
- URL: /place/[id], /gu/[name], /test. 공유 링크로 해당 핀이 열려야 한다.
- 반응형: 320~1023px 유동 모바일 레이아웃(기준 뷰포트 390, 확인은 320/390/430), 1024px부터 좌측 패널 400px + 지도, 플로우는 중앙 모달 480px.

## 코드 최소주의 (코드 쓰기 전 사다리 — 위에서부터 내려가다 걸리는 칸에서 멈춘다)
1. 이게 꼭 있어야 하나? docs/spec.md에 없는 기능은 미정이다. 만들지 말고 물어라.
2. 이 리포에 이미 있나? 공용 컴포넌트·lib/data.ts 함수·기존 훅을 먼저 grep한다.
3. 웹 표준이나 Next.js 내장으로 되나?
4. 이미 깔린 의존성으로 되나? 새 패키지는 마지막 수단 (라이브러리·버전 규칙 적용).
5. 한 줄로 되나? 추상화는 세 번째 호출자가 생겼을 때 만든다. 요청 안 한 옵션·플래그·설정 금지.
6. 그제서야 최소 구현.

사다리보다 우선하는 예외 4개:
- **디자인 시스템이 네이티브를 이긴다.** 토큰·공용 컴포넌트·coolicons가 있으면 그걸 쓴다. "브라우저 기본이 더 간단하다"는 이유로 임의값이나 네이티브 위젯으로 내려가지 마라.
- **"UI 완성 기준"의 4상태와 낙관적 업데이트는 YAGNI 대상이 아니다.** 화면마다 전부 만든다.
- **읽기는 게으르게 하지 않는다.** 단 통독 대상은 손대는 소스 파일이다. 큰 문서(docs/*.md)는 목차와 해당 섹션부터 읽고 필요할 때 넓힌다.
- **삭제를 제안하기 전에 tests/ 포함 전체 트리를 grep한다.** 테스트만 쓰는 심볼도 쓰이는 것이다.

## 작업 방식
- 기능 시작 전 docs/plans/<기능>.md에 계획(변경 파일·검증 방법) 먼저. 승인 후 실행.
- 작업 끝날 때마다: pnpm typecheck && pnpm lint && pnpm test
- Phase 완료 선언 전 갭 스윕: gap-sweeper 에이전트로 spec·design 항목을 전수 대조. 미구현 0건이 완료 조건 (roadmap의 "갭 스윕 0건"이 이것).
- 결정이 바뀌면(호스팅·SDK·버전 등) 한 작업 단위로: decisions.md 기록 + 옛 용어를 docs/·CLAUDE.md·AGENTS.md에서 grep해 잔재 정정. 문서 정정 없는 결정 변경 커밋 금지.
- git 워크플로: 커밋은 로컬에서 작업 단위마다 작게(세이브 포인트, 자유). **push·PR 생성·머지는 사용자 승인 시에만 — 임의 push 금지.** 모든 변경은 짧은 브랜치 → PR 경유(main은 branch protection으로 직push 차단). 코드 PR은 Codex 리뷰 → 사람이 코멘트 선별 → 머지. 문서만 PR은 CI 통과 후 셀프 머지 OK. 자기 리뷰는 PR 템플릿 체크리스트로.
- Codex PR 코멘트는 사람이 판단한다. 자동으로 수정하지 마라 — 사람이 "N번 코멘트만 고쳐, M번은 무시(이유)"로 선별 지시했을 때만 수정. 같은 종류 지적이 2회 오면 고치는 대신 규칙(CLAUDE.md·린트) 승격을 제안하라.
- 같은 실수 2회 → 이 파일이나 린트 규칙에 승격해서 기록. (auto memory가 스스로 남긴 것도 /memory로 주기 검토)
- 하네스 요소(훅·CI·에이전트 설정)는 파일 생성이 아니라 **발화 검증이 완료 조건**: 실제 입력을 넣어 동작을 확인한 뒤에만 완료 표시. Claude Code 자체 설정 문법도 "기억 말고 문서 확인" 규칙의 적용 대상이다. (2026-09-01 훅 스키마 오작성 — 세션 내내 조용히 죽어 있었음)

## 토큰 (2026-09-03 실측: 압축 없이 컨텍스트 62만까지 자라 재읽기가 소모의 절반 — 세션 리밋으로 중단)
- 자동 압축 창은 200K(`/autocompact 200k`, 사용자 설정). 컨텍스트가 150K를 넘으면 커밋 직후 `/compact`를 먼저 제안한다. `/context`로 점유를 확인한다.
- 한 턴 = 플랜의 커밋 단위 하나. "구현 끝까지 한 번에"로 받지 않고 단위마다 끊어 보고한다.
- 서브에이전트 기본은 gap-sweeper·security-reviewer·reviewer뿐. 플랜 모드의 Explore·Plan 에이전트는 손댈 파일을 모를 때만 띄운다. 에이전트에는 "표 40줄 이내"로 결과를 요구하고 원문 로그(TaskOutput 전체)를 컨텍스트로 가져오지 않는다.
- 읽기: 손대는 소스는 통독(코드 최소주의 예외), docs/*.md는 grep·섹션 범위로. 같은 파일을 두 번 cat하지 않는다.
- 출력: 테스트·lint·빌드는 실패 줄만(`2>&1 | grep -E 'FAIL|✗|error' | head -40`). 기존 파일 수정은 Edit, 전체 재작성 Write 금지. 플랜 파일→docs/plans는 cp로 옮긴다. Figma·Playwright JSON은 필요한 필드만 추려 출력한다.
