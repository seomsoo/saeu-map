# CLAUDE.md — 새우맵

## 명령어
- dev: `pnpm dev` (:3000, 평상시)
- build: `pnpm build`
- test: `pnpm test` (vitest)
- lint: `pnpm lint` (eslint flat config)
- typecheck: `pnpm typecheck` (tsc --noEmit)
- 전체 검증: `pnpm typecheck && pnpm lint && pnpm test`
- 배포 전 확인: `pnpm preview` (:8787, 실제 Workers 런타임) / 배포: `pnpm deploy` (Cloudflare Workers — decisions.md 2026-09-01)

서울 새우구이 지도. 모바일 퍼스트 웹. 상세 스펙은 docs/를 먼저 읽어라:
- docs/spec.md — 통합 기획서 (모든 제품 결정과 이유)
- docs/design-prompts.md — 화면별 레이아웃·스타일 스펙
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

## 스타일 (docs/design-prompts.md 공통 블록이 원본)
- 라이트 모드 우선. 색은 전부 CSS 변수 토큰으로 (다크 두 벌 대비).
- 액센트 #F04A28은 화면당 한 곳. 카테고리 색점: 구이 #F0885C / 회 #14957B (마커·카드만).
- Pretendard self-host. 가격·거리·단위는 tabular numbers.
- 라운드 12px, 헤어라인 보더, 그림자 최소. 칩 아웃라인 기본.
- 아이콘 coolicons(Iconify ci). 없으면 근접 대체하고 docs/decisions.md의 "커스텀 에셋 필요" 목록에 적어라.
- 금지: 크림+세리프, 카드 색 띠, 이모지 헤더, 그라데이션 배경, 보라색.
- 애매한 디자인 판단은 캐치테이블·테이블링(2026 한국 앱)을 따른다.

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

## 작업 방식
- 기능 시작 전 docs/plans/<기능>.md에 계획(변경 파일·검증 방법) 먼저. 승인 후 실행.
- 작업 끝날 때마다: pnpm typecheck && pnpm lint && pnpm test
- Phase 완료 선언 전 갭 스윕: gap-sweeper 에이전트로 spec·design 항목을 전수 대조. 미구현 0건이 완료 조건 (roadmap의 "갭 스윕 0건"이 이것).
- 커밋은 작게. PR 전에 자기 리뷰: 모바일 뷰포트 확인했나 / 절대 규칙 1~7 지켰나 / 4상태 있나.
- Codex PR 코멘트는 사람이 판단한다. 자동으로 수정하지 마라 — 사람이 "N번 코멘트만 고쳐, M번은 무시(이유)"로 선별 지시했을 때만 수정. 같은 종류 지적이 2회 오면 고치는 대신 규칙(CLAUDE.md·린트) 승격을 제안하라.
- 같은 실수 2회 → 이 파일이나 린트 규칙에 승격해서 기록. (auto memory가 스스로 남긴 것도 /memory로 주기 검토)
