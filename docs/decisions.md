# 결정 로그 (decisions)

형식: 날짜 / 결정 / 맥락 / 근거 / 재검토 조건. 스펙과 달라진 것, 보류한 것만 적는다.

## 2026-08-31 — 지도 SDK: 카카오 → 네이버(NCP 신규 Maps)
- **맥락**: 카카오맵 무료 쿼터가 "계정당 첫 번째 활성화 앱 한정" 정책으로 확인됨. 개발자 계정에 카카오맵 사용 중인 기존 앱이 있어 새우맵은 두 번째 앱 → 무료 쿼터 없이 비즈월렛(유료) 필요.
- **결정**: 네이버 클라우드 신규 'Maps' 상품의 Web Dynamic Map 사용. 지오코딩도 VWorld 대신 네이버 Geocoding으로 통일.
- **근거**: 신규 Maps는 월 600만 건 무료 + 초과 0.1원/건 (구 AI NAVER API의 무료 종료와 별개 — 2025-06-23 NCP 공지 확인). 우리 예상 규모(월 수십만 로드)의 10배 여유. 11/30까지 NCP 크레딧 20만원이 초과분 방어. 데이터·플레이스 링크·길찾기·검색 API(API HUB)가 네이버 생태계라 콘솔 통일.
- **운영 조건**: NCP 콘솔에 월 사용량 알림 400만 건 설정(차단 아님). React 래퍼가 얇으므로(react-naver-maps) SDK 사용 시 context7로 공식 문서 확인.
- **재검토 조건**: 네이버 Maps 무료 정책 변경 시, 또는 월 로드 400만 건 접근 시.
- **유지**: 카카오 로그인·카톡 공유는 지도 SDK와 무관하므로 카카오 유지.

## 2026-09-01 — TypeScript 6.0.3 (7.0 대신)
- **맥락**: TS 7.0.2가 최신이지만 typescript-eslint 8.69.0이 TS 7.0을 아직 미지원 (>=7.1 추적 중).
- **결정**: TypeScript 6.0.3 사용. Next.js 16.3.3과 호환 확인됨.
- **재검토 조건**: typescript-eslint이 TS 7.x 지원 시 업그레이드.

## 2026-09-01 — Vercel 비용 방어 정책
- **맥락**: DAU 2천 서비스가 월 $86 청구된 실사례 분석 (Threads @kindainvestor). 원인은 트래픽이 아니라 **ISR 남용**: `revalidate: 60` × 동적 URL 9,649개 → 재생성마다 Function Duration + ISR Writes 이중 과금. 부가 요인: next.config `headers()`의 Cache-Control이 페이지 `revalidate`를 덮어써 s-maxage=60 고정(두 번 배포하고 발견), 크롤러 트래픽, Observability 과금.
- **우리 방어선 (Phase 5~6에서 지킬 것)**:
  1. **페이지 캐시는 on-demand 우선**: 쓰기(제보·다녀왔다면·리뷰)가 우리 앱을 거치므로 `revalidateTag`/`revalidatePath`로 변경 시에만 재생성. 주기 revalidate는 보조로 3600s 이상. **`revalidate: 60` 같은 분 단위 금지** — 우리 데이터는 분 단위 신선도가 필요 없다.
  2. **next.config `headers()`에 페이지 경로 Cache-Control 금지** — 페이지 revalidate를 무력화한다. 폰트·정적 자산(`/fonts/*` 등)만 허용.
  3. URL 규모 자각: /place/[id] 452 + /gu/[name] 25 ≈ 477개 (그 사례의 1/20). on-demand면 재생성은 실제 데이터 변경 횟수에 비례.
  4. Observability Plus 켜지 않는다.
  5. **Hobby 플랜 유지** — 한도 초과 시 과금이 아니라 정지라 요금 폭탄이 구조적으로 불가능. Pro 전환 시 Spend Management 지출 상한을 반드시 같이 설정.
  6. 폰트는 dynamic subset (아래 결정).
- **재검토 조건**: Pro 전환 시, 또는 Phase 5 SSR 페이지 추가 시 이 목록 재확인.

## 2026-09-01 — 호스팅: Vercel Hobby 유지, Cloudflare 이전은 트리거 기반
- **맥락**: Vercel 요금 폭탄 실사례 조사 — Cara $96k(1주 유저 65만, 함수 5,600만/일), DDoS $23k, 크롤러 8.4TB $1.5k, 봇 95% 트래픽 과금 등. 공통점: 전부 **Pro 이상 + Spend Management 미설정**. Hobby는 초과 시 과금이 아니라 정지라 폭탄 불가능.
- **결정**: PMF 확인까지 Vercel Hobby 유지. 단 이전 비용을 싸게 유지하는 패턴 준수 — Vercel 전용 기능 미사용, 사진 외부 스토리지(R2 예정), on-demand ISR (전부 OpenNext 호환 패턴).
- **Cloudflare(Workers + OpenNext) 트레이드오프**: 장점 = egress 무료(대역폭 폭탄 원천 차단), 요청당 과금($5/월에 1,000만 req), WAF·봇 방어가 본업, 스펙의 R2·Turnstile과 궁합. 단점 = OpenNext 어댑터 레이어(Next 신버전 시차·런타임 갭 디버깅), ISR 캐시 직접 구성(KV/R2/DO), 프리뷰 DX 열세.
- **이전 트리거** (하나라도 해당 시 재검토): ① Pro 전환 필요 시점(Hobby 정지 경험 또는 상업화) ② 봇·크롤러 트래픽 유의미 ③ 사진 트래픽 본격화(R2 이전과 동시 진행이 자연스러움).
- **Pro로 가게 되면**: 전환 당일 Spend Management 상한 설정이 선행 조건 (기본값이 무상한 — 사례들의 공통 원인).

## 2026-09-01 — git 워크플로: 모든 변경 PR 경유, push는 승인 필수
- **맥락**: Phase 0 동안 커밋 12개가 전부 main 직push, PR 0개 — Codex PR 리뷰 설정이 발동 불가능한 모순. 사용자 지적으로 규칙화.
- **결정**: 커밋은 로컬 자유(세이브 포인트) / push·PR·머지는 사용자 승인 필수 / 모든 변경 짧은 브랜치→PR (main은 branch protection으로 기계 차단, CI `check` 통과 필수) / 코드 PR은 Codex 리뷰 경유, 문서만 PR은 셀프 머지 OK.

## 2026-09-01 — 자동 배포: GitHub Actions, 배선은 Phase 1 첫 PR 때
- **맥락**: 자동 배포 타이밍 논의. 배포를 1회만 해본 시점의 배선은 하네스 선완성("미리 완성하지 않는다" 위반).
- **결정**: 방식만 확정 — 기존 ci.yml 확장: main push → check 잡 통과 후 `opennextjs-cloudflare deploy` / PR → `opennextjs-cloudflare upload`(프리뷰 버전). 배선은 Phase 1 첫 PR과 함께. 그때까지 `pnpm deploy` 수동.
- **배선 결과 (Phase 1, 2026-09-01)**: PR → `pnpm run upload --preview-alias preview` (opennextjs-cloudflare upload가 미지 인자를 wrangler `versions upload`로 전달함을 `--dry-run`으로 확인) → 고정 URL `https://preview-saeu-map.saeu-map.workers.dev`, PR에 코멘트. main push → `pnpm run deploy`. 시크릿 미등록 시 잡 실패 대신 스텝 스킵(+notice). CI에선 `pnpm deploy`가 pnpm 내장 명령과 겹치므로 항상 `pnpm run`.
- **프리뷰 URL을 고정 별칭 하나로 한 이유**: NCP Maps는 등록된 Web 서비스 URL에서만 인증되고 와일드카드가 없다. PR별 URL이면 매번 콘솔 등록이 필요 → 별칭 `preview` 하나만 등록. 동시 PR이면 마지막 업로드가 덮어씀(1인 개발이라 수용). **확인(2026-09-01)**: 프로덕션 URL 등록만으로 `preview-saeu-map.saeu-map.workers.dev`에서도 인증 통과 — NCP의 "서브 도메인은 대표 도메인만 입력" 규칙이 `*.saeu-map.workers.dev`를 커버한다. 추가 등록 불필요.
- **Workers Builds(대시보드 git 연동) 배제 이유**: CI(테스트·gitleaks)를 우회하고 배포됨.
- **필요 시크릿** (배선 시점에 사용자가 등록): `CLOUDFLARE_API_TOKEN`("Edit Cloudflare Workers" 템플릿) + `CLOUDFLARE_ACCOUNT_ID` → GitHub repo secrets, `NEXT_PUBLIC_NCP_CLIENT_ID` → repo variable. **등록 완료(2026-09-01)**. 토큰은 공백 없이 넣고 저장 전 `curl -H "Authorization: Bearer $T" https://api.cloudflare.com/client/v4/user/tokens/verify`로 `active` 확인할 것 — 공백 섞인 값은 6111 에러로 프리뷰 잡이 실패한다.

## 2026-09-01 — 호스팅 변경: Cloudflare Workers 선(先)채택 (당일 "Vercel Hobby 유지" 결정 뒤집음)
- **맥락**: 스파이크 결과 OpenNext 어댑터가 Next 16.3.3을 정확히 지원, 자동 마이그레이션·로컬 workerd 렌더·배포까지 당일 완료. 이전 비용이 최저점(페이지 1개, ISR·이미지 없음)이고, 사용자의 Vercel 계정은 다른 프로젝트들과 Hobby 무료 한도(계정 단위 100GB)를 공유 중이었음.
- **결정**: 처음부터 Cloudflare Workers(OpenNext)로 배포. Vercel은 쓰지 않는다. 프로덕션: https://saeu-map.saeu-map.workers.dev (Phase 7에서 새우맵.kr 연결 예정).
- **요금 안전**: Workers Free는 한도 초과 시 과금이 아니라 에러(하루 10만 요청). Cloudflare 폭탄 사례는 R2 Infrequent Access 오해($9~10)가 대부분 — **R2는 Standard 등급만 쓴다**.
- **운영 수칙**: ① Next 업그레이드 전 @opennextjs/cloudflare 호환(peerDeps) 확인 ② 배포 전 `pnpm preview`(workerd, :8787)로 런타임 확인 ③ ISR 도입 시(Phase 5~6) R2 incremental cache 바인딩 설정 필요 (지금은 미설정 — 정적이라 무관)
- **재검토 조건**: OpenNext가 Next 메이저를 4주 이상 못 쫓아오거나, 런타임 갭 디버깅이 반복될 때.

## 2026-09-01 — Pretendard dynamic subset 전환 (단일 2MB woff2 폐기)
- **맥락**: PretendardVariable.woff2 단일 파일 2MB를 전 방문자가 다운로드하는 구조였음. DAU 2천 가정 시 폰트만 월 60~120GB 전송 → Hobby 무료 한도(100GB) 위협.
- **결정**: pretendard 패키지의 dynamic subset(unicode-range 92분할)으로 전환. 화면에 쓰인 글자 범위의 조각만 다운로드 — 방문당 ~100KB, 약 95% 절감. `/fonts/*`는 immutable 캐시 헤더.
- **트레이드오프**: next/font 최적화(preload) 포기. FOUT은 font-display: swap + 시스템 폴백으로 수용.
- TanStack Query — 서버 컴포넌트 구조라 클라이언트 fetch 없음. 재검토: 지도 뷰포트 단위 로딩 도입 시.
- 가격 뱃지·가격 지수 — kg 단위 표본 20곳 미만. 재검토: 시즌 중 표본 충족 시.
- 다크 모드(야장모드) — 라이트 우선, 토큰 두 벌만 준비. 재검토: 런칭 후.
- 무인 장시간 루프(/goal 야간 실행 등) — 정지 조건·비용 상한 설계 후. 재검토: 11월.

## 2026-09-01 — Phase 1 지도 메인: 스펙에 없던 UI 결정 6건
- **위치 폴백**: 첫 로드 시 조용히 `geolocation` 요청. 허용 → 내 위치 기준 거리 표시·"가까운순" 정렬, 서울 근교면 지도도 이동(줌 14). 거부·실패·미지원 → 카드에 **구만** 표시(거리 숨김), "가까운순"은 **지도 중심 기준**. 근거: 지도 중심 거리를 "거리"로 보여주면 사용자 위치와 무관한 숫자라 오해를 부른다.
- **목 날짜 상대 이동**: lib/data.ts(목 레이어)에서 JSON의 최신 체크인 날짜가 오늘(KST)이 되도록 모든 날짜를 같은 일수만큼 이동. date-only 값은 KST 달력일로 읽어 UTC ISO로 출력(컨벤션 일치). `isNew`는 정적 플래그 대신 `createdAt` 7일 이내로 파생(spec 5). 6개월 무활동 표본 2곳(p004 철수네포장마차, p115 프로간장새우 옥수)은 1월로 고정. Supabase 교체 시 이 블록 삭제.
- **`needsReview: true` 숨김**: 새우 메뉴 파싱 실패로 검수 대기인 가게는 노출하지 않는다(목 1곳 p108). 검수 후 false면 자동 노출.
- **비서울 노출**: 시드의 서울 밖 가게(김포 등 31곳)도 지도에 보인다 — spec 1 "시드 452곳으로 열고". `/gu/[name]`(Phase 5)는 서울 25개 구만.
- **이벤트 카드 링크 `/test`**: 라우트는 Phase 7. 그때까지 404 허용(설정값이라 갈아끼움). 닫기는 메모리 상태만(규칙 4) — 새로고침 시 재노출, 지속은 서버 단계에서.
- **카드 탭 후 정렬 고정**: 카드 탭으로 지도를 옮긴 직후의 `idle`에서는 "지도 중심" 정렬 기준점을 갱신하지 않는다(탭한 카드가 손가락 밑에서 이동하는 것 방지). 사용자가 직접 드래그하면 다시 갱신.
- **재검토 조건**: 위치 폴백은 사용자 피드백 시, 목 관련은 Phase 6 교체 시 자동 소멸.

## 2026-09-01 — 메인 페이지는 요청 시 렌더 (`await connection()`)
- **맥락**: `app/page.tsx`가 요청 시 API를 안 써서 빌드 시 정적 프리렌더됐다. 그러면 목 날짜 이동·"이번 주"·"○일 전"이 **배포 시각에 고정**되고, `loading.tsx`도 안 보인다. 리뷰(플랜 단계)에서 발견.
- **결정**: `connection()`으로 요청 시 렌더. `now`(ISO)는 서버가 만들어 클라이언트에 props로 내려주고, 클라이언트는 렌더 중 `new Date()`를 부르지 않는다(Workers UTC vs 브라우저 KST 하이드레이션 불일치 + react-hooks 7 purity 룰).
- **spec 6 "핀 목록 캐시 필수"와의 관계**: 목 50곳·정적 JSON이라 지금은 비용 0. Phase 5~6에서 on-demand 재검증(위 Vercel 비용 방어 정책 1번 원칙 그대로)으로 설계할 때 이 결정을 캐시 전략으로 대체한다.

## 2026-09-01 — 패키지 결정 (Phase 1)
- **supercluster 8.0.1 핀**: 마커 클러스터링. 9.0.0이 2026-08-10 출시된 메이저 직후 → 정책대로 한 마이너 대기. `lib/cluster.ts` 래퍼로 감싸 naver 전역 없이 테스트. extent 256(네이버 타일 256px)·radius 60·maxZoom 16.
- **@iconify/react 제거 → @iconify/tailwind4 + @iconify-json/ci**: 기존 것은 미사용이었고 기본 동작이 api.iconify.design 런타임 fetch라 "외부 도메인 금지" 취지와 충돌. 새 방식은 빌드 타임 CSS mask, 쓴 아이콘만 포함. 사용법 `<span class="icon-[ci--search-magnifying-glass]" />`. (docs/plans/phase0-scaffold.md의 @iconify/react 표기는 이 결정으로 대체)
- **eslint-import-resolver-typescript 추가 (하네스 결함 수정)**: boundaries 린트가 `@/` 별칭 import를 external로 오인해 **Phase 0 내내 한 번도 발화하지 않았다**(절대 규칙 1이 기계 강제되지 않고 있었음). 리졸버 추가 + v7 문법(요소=폴더, `lib/data.ts`는 `boundaries/files` 카테고리) + `lib/mock`은 data.ts만 import 가능. 위반 파일을 일부러 만들어 에러 발화를 확인한 뒤 완료 처리 — "하네스는 발화 검증이 완료 조건" 규칙의 사례.
- **바텀시트 직접 구현** (vaul 미채택): 항상 열린 비모달 + Phase 2 드래그 확장·스와이프 닫기까지 제어 필요, vaul 1.1.2는 2024-12 이후 무업데이트. 스냅 위치는 CSS 변수(SSR 첫 렌더부터 정확), JS는 드래그 놓을 때 판정만. 뷰포트 높이 ≤639px이면 half=collapsed.
- **vitest**: tsconfig `jsx: preserve` 때문에 Vite 8이 tsx 테스트를 거부 → vitest 설정에 `oxc.jsx.runtime = automatic` (plugin-react 불필요). `globals: false`라 RTL cleanup을 setup에서 직접 등록.

## 2026-09-01 — "스모크 통과"의 정의
- **맥락**: roadmap Phase 0·1 완료 조건의 "스모크"가 정의돼 있지 않았다(Phase 0 플랜은 "build 성공 = 통과"로 읽었고, ci.yml엔 스모크 스텝이 없었음). Phase 1 갭 스윕에서 "모호"로 보고됨.
- **결정**: 스모크 = ① CI `check` 잡에서 OpenNext 빌드 후 **workerd(`wrangler dev`)를 실제 기동해 `/`가 200 + "새우맵"을 돌려주는지** 확인(2026-09-01부터 ci.yml 스텝) + ② 배포 전 `pnpm preview`로 사람이 한 번 보는 것. 빌드 성공만으로는 런타임 갭(OpenNext 어댑터)을 못 잡는다는 게 이유.
- **재검토 조건**: Phase 5 SSR 라우트 추가 시 스모크 URL 목록(/place/[id], /gu/[name]) 확장.

## 2026-09-02 — Phase 1 UI 리디자인: 버틸까 디자인 언어·토큰 방식 채택
- **맥락**: Phase 1은 기능·테스트·갭 스윕까지 끝났지만 지도 위에 상단바·검색·카운터·이벤트·탭·칩 6개가 따로 떠 "AI가 만든 티"가 났다. 다른 프로젝트 **버틸까**(디자이너 협업, 같은 지도+검색+칩+상시 시트 구조)의 Figma 디자인을 새우맵에 맞춰 이식했다. 참고: Figma "버틸까" `MYU1gTAVOqauq9fUgAz53G` — 지도 홈 596:23173 · 구 상세 176:1140 · Components 156:1204 · Type 156:1175 (Figma Desktop MCP `127.0.0.1:3845`, 이 프로젝트엔 미등록 — 다음 화면부터 `claude mcp add --transport http figma-desktop http://127.0.0.1:3845/mcp`). 기능·상태 로직은 그대로, 표현 계층만 교체. 플랜: docs/plans/phase1-redesign.md.
- **토큰 방식(디자이너 협업 대비)**: `@theme static` + Figma 변수 컬렉션 미러링 — **Primitive**(red/coral/teal/gray 램프, 텍스트 스타일 `text-body-m-medium` 등 12종, radius-6~20·max, shadow-float/upper/marker/fab, spacing-safe-*) 위에 **Semantic**(bg/fg/line/brand/toast). 값은 새우맵 것(쿨 그레이 #191F28 계열, 새우 레드 램프) — 버틸까 색을 복사하지 않음. 기본 팔레트·라운드·그림자·텍스트 스케일은 `initial`로 지워 토큰 밖 값이 클래스로 존재하지 않게 했다. 컴포넌트는 임의값(`text-[13px]`, `#hex`, `rounded-[8px]`) 금지. 토큰 표는 docs/design.md가 단일 출처, 다크는 Semantic만 두 번째 벌.
- **규칙 변경(spec 7·CLAUDE.md 스타일)**: ① 액센트 — "채운 레드 버튼은 화면당 한 곳([+ 제보])", 틴트(활성 칩·"새로 제보됨" 라벨)와 클러스터 마커의 레드는 허용. ② 라운드 — 12px 통일 → 6(미니칩)/8(입력·컨트롤)/12(카드·트랙·토스트)/20(시트)/pill(칩·FAB). ③ 그림자 — 헤어라인 원칙은 유지하되 지도 위에 뜨는 요소(검색 블록·칩·FAB·마커)와 시트 상단(upper)에만 옅게 허용. ④ 타이포 — 자간 -0.02em·행간 1.4를 body 기본으로.
- **배치 변경(design 화면 1)**: 지도 위엔 검색 블록·칩 행 두 층만. "새우맵" 워드마크는 화면에서 제거(sr-only h1만 남겨 CI 스모크의 "새우맵" 문자열·접근성 유지). [+ 제보]·현위치는 시트 가장자리 위 FAB 줄(시트와 함께 이동, full에선 숨김). 시즌 카운터는 시트 헤더 **부제**로, 제목은 **보고 있는 지역 + N곳**("마포구 일대 12곳"/"서울 전체 421곳" — `lib/places.ts areaLabel`: 뷰포트 안 가게의 구 분포만 사용, 0곳 "이 지역" / 전체 60%↑ 또는 구 8개↑ "서울 전체" / 1구 그 구 / 그 외 최다 구+"일대". 지오코딩·외부 API 없음). 이벤트 카드는 시트 본문 첫 요소. 정렬은 드롭다운 → **세그먼트 컨트롤**. 탭(전체/구이/회)과 칩은 같은 pill로 한 줄. 시트 collapsed 88 → 98px(제목·부제까지 보이게).
- **마커**: 클러스터 = 레드 원 44px + 가게 수 / 개별 핀 = 36px 원에 썸네일 + 카테고리색 링, 썸네일 없으면 카테고리 색점 플레이스홀더(새우 아이콘 에셋 대기). 신규 점선·무활동 반투명·선택 확대+잉크 링 규칙 유지. 중간 거리 별도 상태 없음 — supercluster가 뭉침→개별로 자연 전환. `Place.thumbnailUrl`(우리 경로만 — innerHTML 삽입 전 `safeThumbnailUrl` 화이트리스트, 규칙 3의 마지막 방어선)을 선반영하고 목 2곳(p018·p019, 성동구 이웃)에 합성 SVG 샘플만 넣었다. 실제 사진은 업로드 Phase.
- **카테고리 = 드롭다운 칩 (2차 피드백)**: 탭 3개(전체/구이/회)가 토글 칩(새로 들어온 집·찜한 곳)과 같은 줄에 나란히 놓이니 성격이 달라 어색했다 → 버틸까 "기간 ▾" 칩처럼 **[전체 ▾] 드롭다운 하나**(전체/소금구이/생새우회, 선택하면 칩이 틴트로 "소금구이 ▾"). 라벨은 구이→**소금구이**, 회→**생새우회**(`TAG_LABELS` — 상세 등 다른 화면도 같은 라벨. 데이터 태그 grill/raw는 그대로). 드롭다운은 가로 스크롤 컨테이너 밖에 두어 목록이 잘리지 않게 했다. 트레이드오프: 카테고리 전환에 탭 1회 추가 — 전환 빈도가 높다고 확인되면 세그먼트로 재검토.
- **사이드 필터 칩 3개 추가 (3차 피드백)**: 토글 칩 행을 [머리버터구이] [라면] [볶음밥] [새로 들어온 집] [찜한 곳]으로 — spec 4.1 "최대 5개" 상한에 도달. 사이드가 앞(로그인 없이 바로 쓰는 필터). 문서 전 구간에서 사이드는 표시 요소로만 있었지만 `Place.sides`·`matchesChips`(AND)가 이미 있어 필터 승격 비용이 작았다. 용어는 **"곁들임" → "사이드"**로 통일(spec·design·코드 카피·aria-label). 사이드 칩이 켜진 채 0곳이면 "이 동네엔 아직 없어요 · 제보"는 오해라 `EmptyKind: "filter"` — "조건에 맞는 집이 없어요" + [필터 해제]. `matchesChips`·빈 상태 분기는 `switch` + `assertNever`로 바꿔 칩·빈 상태 종류가 늘면 컴파일 에러로 잡히게 했다. 목 49곳 분포: 라면 24 · 머리버터구이 10 · 볶음밥 5(전부 라면 동반) · 없음 22. 재검토: 칩이 6개째 필요해지면 사이드 3개를 "사이드 ▾" 다중선택 드롭다운으로 접는다.
- **추가·미채택**: 현위치 버튼은 모바일 스펙에 없었지만 추가(기존 geolocation 재사용, 명시 요청이라 서울 밖이어도 이동, 실패 시 안내만). 버틸까의 하단 탭바는 스펙에 없어 미채택.
- **재검토 조건**: 정렬 세그먼트는 써보고 어색하면 드롭다운으로 회귀. 임의값 금지는 위반 2회 시 ESLint 승격. 새우 마커 아이콘 에셋이 오면 플레이스홀더 교체. 지역 라벨 규칙(60%·8구)은 실사용 피드백 시.

## 커스텀 에셋 필요 목록
- 새우 마커 플레이스홀더 아이콘 — 36px 원 안, 썸네일 없는 가게용 (그 전까지 카테고리 색점)
- 새우 로고 (화면에선 워드마크를 뺐으므로 급하지 않음 — OG·파비콘용)
- 파비콘 (그 전까지 `app/icon.svg` 코랄 색점)
