# Phase 6 — 백엔드 교체 (Supabase · spec 5·6 · roadmap Phase 6)

## Context

roadmap Phase 6. 지금 상태: 사용자 화면(1~9·11)과 `/admin` 5탭이 전부 있고, 모든 읽기·쓰기가 `lib/data.ts` 한 파일(1,557줄, 목 JSON + 모듈 메모리)을 지난다. 컴포넌트 36곳이 `@/lib/data`를 import하고 테스트 12파일이 그 모듈을 `vi.mock`한다. 테스트 585개.

목표: **`lib/mock/`의 places·checkins·reviews JSON을 지워도 전 기능이 동작**하고, RLS 테스트가 통과하고, 폰에서 실 DB로 머니패스(제보 → 노출 → 다녀왔어요 → 확인일 갱신)가 한 바퀴 돈다. 컴포넌트는 한 줄도 Supabase를 모른다(절대 규칙 1은 그대로 — 이 Phase가 그 규칙의 배당금이다).

사용자가 덧붙인 조건 셋(2026-09-09):
1. **Supabase로 간다.**
2. **사용량이 커지면 직접 구축(셀프호스팅)으로 넘어갈 수 있어야 한다.**
3. **잘 되면 굴맵·대방어맵 시리즈의 템플릿이 될 수 있어야 한다.**
→ 아래 "이전·시리즈 원칙" 절이 이 셋을 설계로 받는다. **결정 13개는 2026-09-09~10에 사용자와 하나씩 확정했다**(맨 아래 "결정 기록"). 같은 자리에서 **시드 지역 확장**(부산·광주·목포·무안, 약 790곳)이 추가됐다.

**주요 의존성(2026-09-09 npm 확인)**: `@supabase/supabase-js` 2.116.0 · `@supabase/ssr` 0.12.7(주 733만) · `supabase` CLI 2.117.0 · `@opennextjs/cloudflare` 1.20.5 → 1.20.6 · `wrangler` 4.127 → 4.130 · `@sentry/nextjs` 10.73.0. Next 16.3.3·React 19.2·Node 22는 그대로. Docker 29.5 있음, Supabase CLI는 없음(`brew install supabase/tap/supabase`). **새 패키지는 `@supabase/supabase-js`·`@supabase/ssr`·`@sentry/nextjs` 셋**(dev: `supabase`). Turnstile은 `next/script` + `window.turnstile`로 붙인다(래퍼 패키지 `@marsidev/react-turnstile` 주 156만이 있지만 사다리 3칸 — 스크립트 한 줄과 `execute()`뿐이라 60줄이면 된다).

문서 확인(Supabase 스킬 규칙): changelog **2026-04-28 "테이블은 더 이상 Data API에 자동 노출되지 않는다(opt-in)"** — 우리에게 유리하다(뷰·RPC만 GRANT). API 키는 **publishable/secret 체계**로(anon·service_role은 2026 말 폐기 예정). `@supabase/ssr`는 토큰 갱신을 proxy(middleware)에 맡기라고 하지만 OpenNext Cloudflare가 Node proxy를 "실험적·비유지" 경고로 빌드한다(`build.js:68`, 2026-09-07 결정과 같음) → 아래 결정 2.

---

## 결정 (권고 — 사용자 답 필요한 것은 끝의 "질문" 표)

| # | 항목 | 결정 | 근거 |
|---|---|---|---|
| 1 | **호출 경로** | 컴포넌트 → `lib/data.ts`(시그니처 유지) → **Server Action**(`lib/server/actions.ts`, `"use server"`) → Supabase(사용자 세션 + RLS). **브라우저에 supabase-js를 싣지 않는다.** 서버 컴포넌트는 같은 함수를 직접 부른다 | 스팸 4겹(Turnstile 검증·속도 제한·이미지 재인코딩·디스코드 알림·secret key)이 전부 서버 일이고, 쓰기가 한 문으로만 들어와야 4겹이 강제된다. 2026-09-02 "Server Action 미채택" 근거(isolate 전역 캐시 공유·실패 주입 불가)는 목 전용이라 소멸. 대가: 클라이언트 읽기(찜·내 활동·관리자·상세 재로드)가 워커 요청 1회씩 |
| 2 | **세션** | `@supabase/ssr` 쿠키 세션. proxy 없음 — 쿠키 쓰기는 **Server Action·Route Handler에서만**. RSC는 `getClaims()`(JWKS 로컬 검증, 네트워크 없음)로 표시용 세션만 읽는다 | 읽기만 하는 방문에서 만료된 액세스 토큰은 다음 쓰기(액션)에서 갱신·저장된다. 리프레시 토큰은 길어서 실질 문제 없음. proxy를 넣으면 OpenNext 경고 경로를 탄다 |
| 3 | **익명 사용자는 첫 쓰기 때 만든다**(lazy `signInAnonymously`) | `Session.userId: string \| null`(null = 아직 아무 기록도 없는 방문자). 첫 쓰기 액션이 익명 유저를 만들고 쿠키를 심은 뒤 쓴다 | 방문만으로 `auth.users` 행·MAU(무료 5만)를 안 태운다. 익명 sign-in의 IP 제한(시간당 30)도 방문 수가 아니라 참여 수에 걸린다. spec 5 "익명 자동 생성이 기본"의 뜻(묻지 않는다)은 그대로 |
| 4 | **카카오 승계** | `signInWithOAuth({provider:'kakao'})`(PKCE) → `app/auth/callback/route.ts`가 `exchangeCodeForSession` → **서버가 옛 익명 uid의 기록을 새 uid로 병합**(`private.merge_users`, secret key) → 익명 유저 삭제. **`linkIdentity`는 쓰지 않는다** | 로그아웃 → 새 익명 → 다시 카카오 로그인(가장 흔한 재방문 경로)에서 `linkIdentity`는 "identity already linked" 실패 → 병합 경로가 어차피 필요 → 한 경로로. 콜백 요청이 옛 쿠키(익명 세션)를 들고 오므로 소유 증명이 된다. spec 5의 "linkIdentity로 기록 승계"는 **결과(승계)** 유지·수단 변경 → decisions |
| 5 | **키·환경** | 서버 전용 `SUPABASE_URL`·`SUPABASE_PUBLISHABLE_KEY`(사용자 세션 클라이언트)·`SUPABASE_SECRET_KEY`(병합·탈퇴·임포트·크론만). **`NEXT_PUBLIC_SUPABASE_*`는 없다** | 브라우저에 supabase-js가 없으니 공개 키도 번들에 갈 이유가 없다. 규칙 7 허용 목록의 "Supabase anon 키"를 **빼고** Turnstile site key·Sentry DSN을 넣는다(둘은 공개값) |
| 6 | **스키마** | 아래 "스키마" 절. 확인일·확인수·평점은 컬럼이 아니라 **뷰 집계**, 삭제는 전부 소프트, 되돌리기는 `place_edits`, 속도 제한은 `rate_events` | spec 6 "스키마 원칙" + 목 단계에서 확정된 타입(`lib/types.ts`)을 그대로 옮긴다. 시리즈용으로 이름·값에 새우 고유명이 없다 |
| 7 | **쓰기 방식** | 단일 테이블 쓰기는 PostgREST + RLS(`with check`) + 트리거(이력·속도·섀도 밴). 다중 테이블(제보=가게+사진, 관리자 병합)만 RPC | `SECURITY DEFINER` 최소화(Supabase 스킬 체크리스트). 정책이 자기 테이블을 세야 하는 속도 제한만 `private.*` 헬퍼로 |
| 8 | **속도 제한은 Postgres + 문 앞 경비** — Upstash 안 쓴다 | 각 쓰기 테이블 `AFTER INSERT` 트리거가 `rate_events(kind, actor, ip_hash, at)`에 한 줄 남기고, `with check`가 `private.rate_ok(kind)`로 센다. IP는 액션이 `x-ip-hash`(sha256(IP + 일별 salt)) 헤더로 넘기고 24시간 뒤 지운다. 여기에 **Cloudflare 속도 제한 바인딩**(무료·GA, 60초 창·IP당)을 액션 맨 앞에 보조로 — DB 세기가 먼저 서고, 바인딩은 별도 커밋으로 얹어 프리뷰에서 실제로 막히는 걸 본 뒤 완료 표시(하네스 발화 검증) | spec 5의 Upstash는 Vercel 시절 결정. 쓰기가 전부 Postgres를 지나므로 같은 트랜잭션에서 세는 게 정확하고, 벤더 하나가 준다(셀프호스팅 조건). 바인딩은 Turnstile을 사람이 풀며 도배하는 경우와 DB 앞 폭주 차단용 보험(설정 1줄·코드 10줄). 수치는 spec 5 그대로: 제보 시간당 5 · 다녀왔어요 핀당 일 1(**유니크 인덱스**) · 신고 일 10 · 리뷰 핀당 1(유니크)·일 10 · 정보 달라요 핀당 일 1 · 수정 제안 핀당 일 5 · 사진 가게당 시간 10 · **사진 월 전역 4,500장** |
| 9 | **Turnstile** | 모든 쓰기. `next/script`(`?render=explicit`) + 보이지 않는 위젯 하나(`execution:"execute"`, `appearance:"interaction-only"`)를 `SessionProvider`가 마운트, `lib/data.ts`의 클라이언트 쓰기 래퍼가 `execute()` → 토큰을 액션에 넘김 → 서버 `siteverify`. 토큰은 5분·1회용 | 규칙 1 유지: 컴포넌트는 토큰을 모른다. 서버 컴포넌트 경로(빌드·SSR)엔 쓰기가 없다 |
| 10 | **사진 = R2 + Images 바인딩**(NCP 안 거친다) | 업로드 = 액션 `FormData` → `IMAGES.info()`로 진짜 이미지인지 → `.transform({width:1200}).output({format:"image/webp"})`(재인코딩 = EXIF 제거) → R2 `saeu-photos` put → `photos` 행. **DB에는 키만 저장**(`photos.key` = `places/<id>/<uuid>.webp`), URL은 서빙 라우트가 만든다 — 저장소 이전(R2 ↔ NCP 등)은 `rclone` 복사 + `lib/server/photos.ts` 함수 2개 교체로 끝난다. 서빙은 `app/photos/[...key]/route.ts`가 R2에서 읽어 `immutable` 캐시 헤더로 → 경로가 `/photos/…`라 `safeAssetPath`(규칙 3)가 그대로 방어선. **월 업로드 전역 상한 4,500장**(`rate_ok` kind=`photo_month`, 넘으면 "이번 달 사진이 꽉 찼어요") — Images 무료 5,000장 안에서 과금이 아니라 정지로 끝난다 | 무료 한도 실측(2026-09-09, decisions): R2 10GB(≈5만 장, 우리 최대 790곳×10장≈1.6GB)·읽기 월 1,000만·쓰기 월 100만, 초과는 과금($0.015/GB·$0.36/100만)이지만 우리 상한이 금액을 묶는다. Images 5,000장/월 무료. Workers 요청 초과는 에러(과금 없음). 나가는 트래픽 무료인 저장소는 R2뿐(NCP는 크레딧 뒤 트래픽 유료, Supabase Storage는 egress 5GB). presigned 5분 URL은 액션 업로드로 대체. runbook에 **월 1회 R2·Images 사용량 확인** |
| 11 | **캐시** | `open-next.config.ts`: `withRegionalCache(r2IncrementalCache, { mode: "long-lived", bypassTagCacheOnCacheHit: true })` + `d1NextTagCache`, **queue 없음**(온디맨드만). `getPlaces`·`getSeasonStats`·`getPlaceDetail`을 `unstable_cache`(태그 `places`·`place:<id>`·`season`)로 감싸고 쓰기 액션이 `revalidateTag`. 주기 재검증 없음 | decisions 2026-09-01 비용 방어 정책(온디맨드 우선, 분 단위 금지). Supabase 무료 egress 5GB/월 — 핀 목록 ~500KB × 방문마다 읽으면 1만 방문에 바닥난다. regional cache(Cache API, 최대 30분)는 R2 읽기 한도(사진·캐시 **계정 합산** 월 1,000만)를 아낀다 — 워커가 매일 10만 한도에 붙어도 R2 초과가 월 $1~2를 넘지 않게. `cacheComponents`(`use cache`)는 렌더 모델 전환이라 범위 밖 — `unstable_cache`는 Next 16에서 그대로 지원(로컬 docs `caching-without-cache-components.md`) |
| 12 | **관리자 판정은 서버** | `app/admin/page.tsx`가 `getClaims()` → `profiles.is_admin` 조회 → 아니면 `notFound()`(**진짜 404 + 제목 없음**). RLS의 관리자 정책은 `private.is_admin()`. 목 토글 `setAdmin`·`Session.isAdmin` dev 스위치 삭제 | spec 4.5 "서버 측 is_admin 검증 + RLS. 프론트 체크는 장식" |
| 13 | **신고 3회** | 여전히 자동 숨김 없음. 3회째에 **디스코드 알림** + 관리자 표시(있는 그대로) | Turnstile·IP 제한이 서도 익명 3계정은 몇 분이면 만든다. 1인 운영은 알림 받은 자리에서 누르는 게 더 빠르다(2026-09-08 근거 유지). **사용자 확정 2026-09-10** |
| 14 | **섀도 밴** | `profiles.shadow_banned` + `BEFORE INSERT` 트리거가 `NULL` 반환(행을 조용히 버린다 — 오류 없음). 켜는 UI는 없다(design 화면 10에 없음) → 운영자가 SQL로 | 진짜 섀도 = 성공한 척. UI는 실제 악성이 나타난 뒤 |
| 15 | **내용 필터** | zod refine: URL 패턴 거부(영업시간·주소·메뉴명·후기·요청 내용), 욕설 블록리스트(`lib/content-filter.ts`, 짧은 목록) | spec 5 스팸 4겹 3. 서버 액션의 zod가 이미 마지막 방어선 |
| 16 | **시드 임포트 — 서울 452 + 부산 190 + 광주권(광주 5구·목포·무안) 145 ≈ 790곳** | `convert_seed.py`가 두 CSV 모양(`saewoo_seoul.csv`의 `구`·`새우메뉴확정` / `probe_*.csv`의 `지역`·`분류`)을 다 읽고 정제(이름 잔재·단위 파싱) + `--report`(파싱율 표) → JSON 하나 → `scripts/import-seed.ts`(secret key, `seed_ref`=네이버 place_id로 멱등 upsert). 지역 표기는 앱 규칙(`Place.gu`: 서울 "마포구", 밖은 "해운대구(부산)"·"서구(광주)"·"목포시(전남)"·"무안군(전남)")으로. **needsReview 행은 `hidden_at`을 찍어 넣고 관리자 검색 탭 "검수 필요" 필터에서 눈으로 보고 [복구]** — 검수가 스프레드시트가 아니라 관리자 화면 작업이 된다. 시드 가게마다 `checkins(type='seed', at=수집일)` 한 줄("○일 전 확인"은 수집일 기준, 임포트일이 아니다). **시드는 NEW가 아니다**(source='seed' — 배지·배너·카운터·사후 확인 탭 전부 report만, 사용자 확인 2026-09-10) | roadmap "검수 반영" + 지역 확장(사용자 결정 2026-09-10). 지도는 이미 전국 대응(2026-09-09 지역 라벨 사다리·전국 줌)이라 화면 변경 없음. `/gu/[name]`·구별 OG 25장은 spec대로 서울만. **excluded.csv는 무시한다**(사용자 결정) |
| 17 | **최근접역은 서버가 채운다** | `subway_exits`(역·호선·출구 좌표, OSM 캐시에서 내보낸 CSV — **서울·수도권 + 부산 + 광주**로 bbox 확장, 목포·무안은 지하철 없음) 테이블 + `private.nearest_station(lat,lng)` → `places` `BEFORE INSERT` 트리거가 `nearest_station jsonb`를 채운다. 시드도 같은 트리거를 지난다(`add_nearest_station.py`는 내보내기 전용으로 축소) | spec 2 "Phase 6에선 서버 쓰기 시점에 채우는 컬럼". 제보 핀의 역 줄이 살아난다 |
| 18 | **OG 카드** | 빌드 시 생성 유지(`generateStaticParams`가 DB를 읽는다 — CI는 로컬 Supabase, deploy는 프로덕션 publishable). 빌드 뒤 생긴 제보 핀은 `placeMeta`가 루트 OG로 폴백 | Workers Free CPU 10ms(2026-09-07). Paid로 가면 요청 시 렌더로 되돌릴 수 있다 → 질문 5 |
| 19 | **크론** | pg_cron(Supabase 무료 포함): 월 1회 익명 정리(30일 무활동, 기록 있는 유저 제외) · 일 1회 `rate_events` 정리. Supabase 잠들지 않게 **GitHub Actions schedule이 매일 `/`를 curl** | 워커 `scheduled` 핸들러는 OpenNext 진입점을 감싸야 해서 Actions cron이 가장 짧다 |
| 20 | **알림·에러** | **디스코드 웹훅**(`DISCORD_WEBHOOK_URL` 하나, 봇·토큰 없음): 제보·신고·사장님 요청·신고 3회째에 POST(`waitUntil`, 응답을 막지 않음). spec 5·6의 "텔레그램"은 기획 브리프 값이라 **디스코드로 정정**(사용자가 매일 여는 앱 기준, 2026-09-10). Sentry: `@sentry/nextjs`(문서상 OpenNext 지원 조건 `nodejs_compat` + compat date ≥ 2025-08-16 — 우리 2026-09-01) | roadmap. Sentry는 마지막 커밋이고 프리뷰에서 이벤트 발화가 안 보이면 Phase 7로 넘기고 기록(하네스 발화 검증 규칙) |
| 21 | **테스트** | ① pgTAP `supabase/tests/*.sql`(basejump `tests.authenticate_as`) = **RLS 테스트** ② vitest: `lib/server/*` 순수 부분(행→Place 매핑·ip 해시·내용 필터·Turnstile verify fetch 목)과 `lib/data.ts` 래퍼 ③ 컴포넌트 테스트는 `@/lib/data` 목이라 무변경 ④ CI `db` 잡: `supabase start` → `supabase test db` → `gen types --local` diff 0 → 샘플 시드 → OpenNext 빌드 → workerd 스모크(**실 DB 상대**) | 목 동작 테스트(`data.test.ts` 71개)는 삭제되고 pgTAP·래퍼 테스트로 대체 — 수치는 결과에 기록 |
| 22 | **환경 = 로컬 Docker + 호스티드 prod 하나. 프리뷰는 prod를 읽기 전용으로** | Supabase 무료 한도는 **계정 기준 활성 2개**(모든 조직 합산, 일시정지만 제외 — 문서 확인 2026-09-10)이고 사용자가 이미 1개를 쓰고 있어 슬롯이 하나다. 남은 슬롯 = prod. PR 프리뷰 워커는 prod URL·publishable 키만 받고(`--var`) **`PREVIEW_READONLY=1`** — 서버 액션 맨 앞에서 쓰기·로그인·익명 생성을 전부 거부("프리뷰는 읽기 전용이에요"), secret key는 프리뷰에 없다. 쓰기 검증은 로컬 Docker + `pnpm preview`(workerd), 실서비스에서는 사용자가 실제 행동(진짜 다녀온 가게·진짜 제보)으로 한 바퀴 | 슬롯이 나면 staging을 붙이는 절차를 runbook에. Supabase Pro($25/월)·다른 프로젝트 정지는 미채택 |
| 23 | **가게 id** | `uuid`(DB 기본값). 목의 `p018` 같은 id는 사라진다 — CI 스모크는 `/`에서 첫 `/place/<id>` 링크를 뽑아 따라간다 | 짧은 id는 생성기·충돌 처리가 따로 필요, 공유 링크 길이는 문제가 아니다 |
| 24 | **백로그 하나 같이 닫는다** | "제보 핀 확인일이 거짓" — 뷰에서 `check_count=0`이면 `last_checked_at`이 null → 카드·상세가 "○일 전 **등록**"으로 | 조건이 "실제 제보가 쌓이기 전까지"였고 그 시점이 이 Phase다 → 질문 11 |
| 25 | **`/test` 참여 기록은 테이블까지** | `peel_results(type, created_at)` + `peel_stats()`(참여자 수·유형별 비율) RPC. 결과 화면이 나올 때 액션이 한 줄 insert(Turnstile 없이 — 읽기와 같은 급의 익명 카운트, 속도 제한 IP당 일 20). **화면 표시는 Phase 7**(카피·자리 설계와 함께) | design 11-e "서버가 서면". 런칭 전에 숫자가 미리 쌓인다(사용자 결정 2026-09-10) |
| 26 | **외부 계정 분담** | 저(CLI): R2 버킷 2·D1 1(wrangler, 로그인 확인됨), GitHub secrets/variables(`gh`), Supabase 프로젝트 생성·연결·마이그레이션·`config push`(익명 로그인·카카오 공급자). 사용자(콘솔): **카카오 개발자 앱**(REST API 키·Client Secret·리다이렉트 URI·동의항목 닉네임·프로필 사진) · **Turnstile 위젯**(호스트명 실서비스·프리뷰·localhost) · **디스코드 웹훅** · `supabase login` 브라우저 승인 1회(`! supabase login`). 키 값은 채팅에 적지 않고 `.env`·GH secrets에만 | 커밋 1의 runbook이 클릭 순서. 필요한 커밋에 도달할 때 그 키만 요청 |

---

## 이전·시리즈 원칙 (사용자 조건 2·3)

- **한 지도 = 한 리포(템플릿 fork) + Supabase 프로젝트 하나 + 워커 하나.** 멀티테넌트(한 DB에 여러 맵)는 하지 않는다 — RLS가 두 배로 복잡해지고 한 맵의 사고가 전부로 번지며, 무료 티어는 프로젝트 단위다.
- **Supabase 의존은 Postgres + GoTrue(auth) + PostgREST 셋뿐.** Storage·Edge Functions·Realtime·Vault·Studio 기능을 쓰지 않는다. 셀프호스팅(docker compose, PG17·Envoy — changelog 2026-05·07)으로 갈 때 바꾸는 건 `SUPABASE_URL`·키·OAuth 리다이렉트 URI뿐이고, 마이그레이션 SQL이 그대로 스키마다. 더 나아가 "Supabase 없는 Postgres"로 갈 땐 `lib/server/supabase.ts`(클라이언트 생성)와 auth 계층만 교체 — 컴포넌트·`lib/data.ts` 시그니처는 무변경.
- **스키마에 새우 고유명이 없다**: `tags text[]`·`sides text[]`·`menus[].unit text`, 허용값은 마이그레이션 `0001` 맨 위 CHECK 상수 한 곳. 코드 쪽 도메인 상수(`TAG_LABELS`·`SIDE_KEYS`·카피)는 이미 `lib/places.ts`·`lib/types.ts`에 모여 있다.
- **템플릿화 자체는 이 Phase가 아니다.** "설정 파일 하나로 카테고리·사이드·카피를 갈아끼우는" 추상화는 두 번째 맵이 실제로 시작될 때 만든다(추상화는 세 번째 호출자 규칙 — 지금 만들면 새우맵 하나에 맞춘 추측이 된다). 이 Phase가 남기는 건 **`docs/runbook.md`**: 새 프로젝트를 세우는 순서(Supabase 프로젝트·마이그레이션·시드·Kakao 앱·R2/D1/Images/Turnstile·GH secrets·pg_cron)와 환경 변수 표 — 시리즈의 두 번째 맵은 이 문서를 따라 세운다.
- **공개값 네 가지 습관**(규칙 7 허용 목록 = 네이버 지도 Client ID · 카카오 JS 키 · GA4 측정 ID · Turnstile site key · Sentry DSN — 전부 "명찰"이지 "열쇠"가 아니다): 콘솔에서 도메인·URL로 묶는다 / 사용량 알림을 건다 / 비밀 키(Supabase secret·Turnstile secret·디스코드 웹훅·IP salt)는 절대 섞지 않는다 / 비밀 키가 새면 즉시 교체. runbook의 고정 절이다.

---

## 스키마 (Supabase 마이그레이션 `supabase/migrations/0001_init.sql` — 전문은 구현 커밋에서, 여기는 모양)

| 테이블 | 열(요지) | 제약·인덱스 | RLS(사용자) |
|---|---|---|---|
| `profiles` | `id uuid pk → auth.users cascade`, `nickname`, `is_admin bool`, `shadow_banned bool`, `created_at` | `auth.users` INSERT 트리거가 만든다(카카오 메타의 닉네임) | select 본인·관리자 / update **`nickname`만**(컬럼 GRANT) |
| `places` | `id uuid`, `seed_ref text unique`, `name`, `gu`, `address_road`, `address_jibun`, `lat`, `lng`, `nearest_station jsonb`, `tags text[]`, `specialist`, `naver_place_url`, `hours_note`, `menus jsonb`(≤5줄), `sides text[]`, `source`(seed/report), `reporter_id → users set null`, `duplicate_suspect_of → places`, `merged_into → places`, `needs_review`, `verified_at`, `hidden_at`, `removed_by_owner`, `created_at` | CHECK: tags ⊆ {grill,raw}, sides ⊆ {headButter,ramen,friedRice}, menus 형태(검증 함수), 좌표 한국 상자. BEFORE INSERT 트리거 = 최근접역 | select `hidden_at is null` / insert `reporter_id = auth.uid() and source='report'` / update **hours_note·address_road·menus·sides 컬럼만** GRANT + `using/with check (hidden_at is null)` — `AFTER UPDATE` 트리거가 `place_edits`에 이전 값 기록 |
| `places_public` (뷰, `security_invoker`) | places + `check_count`, `last_checked_at`(없으면 null), `rating_count`, `rating_avg`(3개↑만), `photos jsonb[]`, `is_new` | `getPlaces`·`getPlaceDetail`이 이것만 읽는다 | 뷰 자체는 places RLS를 상속 |
| `checkins` | `id bigint identity`, `place_id → places cascade`, `actor → users set null`, `type`(visited/review/seed), `at`, `kst_day date generated` | **unique (place_id, actor, kst_day) where type='visited'** = 핀당 일 1 | insert `actor = auth.uid()` + 가게 visible / select 없음(집계는 뷰) |
| `reviews` | `id uuid`, `place_id`, `author_id → users set null`, `rating 1~5`, `text ≤500`, `photo_url`, `created_at`, `edited_at`, `deleted_at` | **unique (place_id, author_id) where deleted_at is null** = 핀당 1. `AFTER INSERT` → checkins(type='review') | select `deleted_at is null` / insert·update `author_id = auth.uid() and jwt.is_anonymous = false`(RESTRICTIVE) / delete = update deleted_at |
| `bookmarks` | `user_id`, `place_id`, `created_at` pk(user_id, place_id) | | 전부 본인 |
| `photos` | `id uuid`, `place_id cascade`, `key text`(R2 키, URL 아님), `uploader_id set null`, `created_at`, `removed_at` | 트리거: 가게당 `removed_at is null` 10장 상한 + 월 전역 4,500장 | select 가게 visible / insert `uploader_id = auth.uid()` / 내리기는 관리자 |
| `reports` | `id uuid`, `kind`, `place_id cascade`, `photo_id`, `reason`, `owner_kind`, `contact`, `message`, `actor set null`, `ip_hash`, `status`, `created_at`, `resolved_at` | CHECK kind·status·reason 값 | insert `actor = auth.uid()` / select·update **관리자만** |
| `place_edits` | `id uuid`, `place_id`, `actor set null`, `field`, `before jsonb`, `at` | 트리거 전용 insert(사용자 insert 정책 없음) | select **관리자만** |
| `rate_events` | `kind`, `actor`, `ip_hash`, `at` | 각 쓰기 테이블 `AFTER INSERT` 트리거가 남김. 24h 뒤 pg_cron 삭제 | 정책 없음(트리거·`private.rate_ok`만 접근) |
| `subway_exits` | `station`, `lines text[]`, `exit`, `lat`, `lng` | 시드 전용 | 정책 없음(`private.nearest_station`만) |
| `peel_results` | `id bigint identity`, `type text`(4 슬러그), `created_at` | insert만(트리거로 rate_events) | insert anon·authenticated / select 없음(`peel_stats()`만) |

`private` 스키마(노출 안 됨): `is_admin()`, `rate_ok(kind)`, `is_shadow_banned()`, `nearest_station(lat,lng)`, `merge_users(from,to)`(secret key 전용), `season_stats()`·`admin_stats()`(RPC로 노출하되 관리자·공개 판정 안에서). 탈퇴 = 리뷰 `deleted_at` + 신고의 `contact/message` null + `auth.admin.deleteUser`(FK `set null`이 나머지를 뗀다) — 목의 `deleteAccount`와 같은 규칙.

Data API 노출은 **`places_public`·`checkins`·`reviews`·`bookmarks`·`photos`·`reports`·`profiles`·`places`(insert/update만)** + RPC 3개. 마이그레이션 끝에 `supabase db advisors` 0건이 완료 조건.

---

## 변경

### 1. 문서 먼저 — `docs/decisions.md` · `CLAUDE.md` · `AGENTS.md` · `docs/spec.md` · `docs/roadmap.md` · `.env.example`
- decisions 2026-09-09~10 항목: 위 결정 표(호출 경로·lazy 익명·OAuth+병합·키 체계·Postgres 속도 제한+바인딩 보조·R2 직행+키만 저장·캐시 구성·Free 유지·단일 prod+읽기 전용 프리뷰·디스코드·uuid·시드 지역 확장·시드는 NEW 아님·시리즈 원칙). 뒤집는 것은 취소선으로: spec 5 Upstash, spec 5·6 텔레그램 → 디스코드, spec 6 NCP Object Storage·presigned, spec 5 linkIdentity(수단), spec 1 "서울 새우구이 지도" 정체성에 지역 확장 각주(서울 421 + 부산·광주·목포·무안). 백로그에 **시즌 스탬프**(내 활동 한 줄, 확인 기록 재료) → 반응 보고 레벨·배지 검토(레벨 시스템 제안 2026-09-10 — 확인 신호 오염·익명 참여·1인 운영 비용으로 이번엔 미채택).
- CLAUDE.md: "지금 단계" 블록(Supabase는 아직 없다 → **`lib/server/`만 Supabase를 안다**), 규칙 7 목록(anon 키 삭제, Turnstile site key·Sentry DSN 추가), 명령어에 `pnpm db:start`·`db:test`·`db:types`. AGENTS.md 보안 절 같은 정정. spec 6 스택 문단 정정. roadmap Phase 6 항목 문구 맞춤.
- 플랜 파일은 이 문서(cp 없음 — 이미 docs/plans에 있다).

### 2. Supabase 프로젝트 골격 — `supabase/config.toml` · `supabase/migrations/0001_init.sql` · `supabase/tests/*.sql` · `supabase/seed.sql` · `package.json` 스크립트
- `supabase init` → config: `auth.enable_anonymous_sign_ins = true`, `[auth.external.kakao]`(로컬 리다이렉트 `http://localhost:54321/auth/v1/callback`), `site_url`·`additional_redirect_urls`(localhost:3000·8787), `db.major_version = 17`, pg_cron.
- 마이그레이션 0001: 위 스키마 + `private` 함수 + 트리거 + RLS + GRANT + pg_cron 잡 2개. 0002: `subway_exits` COPY(시드 CSV는 `supabase/seed/`).
- pgTAP: `000-setup`(basejump 헬퍼), `010-rls-places`(익명은 숨긴 가게를 못 보고 4컬럼만 고친다, 이력 트리거), `020-rls-reviews`(익명 거부·핀당 1·본인만), `030-rate`(제보 6번째 거부·다녀왔어요 같은 날 2번째 거부), `040-admin`(비관리자 reports select 0행), `050-shadow`(밴 유저 insert가 오류 없이 0행), `060-merge`(병합 뒤 찜·확인·제보가 옮겨진다).
- `supabase/seed.sql`: 로컬·CI용 샘플(변환기 `--sample 50` 출력에서 생성, 관리자 프로필 1).
- 스크립트: `db:start`·`db:stop`·`db:reset`·`db:test`(`supabase test db`)·`db:types`(`supabase gen types typescript --local > lib/db/database.types.ts`).

### 3. 시드 파이프라인 — `scripts/convert_seed.py` · `scripts/add_nearest_station.py` · `scripts/import-seed.ts`(신규) · `scripts/README.md`
- 변환기: 이름 잔재 제거(`"… 0"`·`(가을 한정 판매)`·이름 속 가격), 단위 재파싱(`1kg`·`500g`·`한판/반판`·`N마리`·`大中小`·인분 + 붙여 쓴 `1키로`·`1k`·`1.5kg` 등 실측 패턴), `--report`로 **단위 파싱율·이름 정제율 표**(지금 74% 미파싱 → 목표는 실측 뒤 기록). 출력은 `seed_ref` 포함.
- 역 스크립트: OSM 캐시(`.osm`)에서 `subway_exits.csv` 내보내기 모드 추가, `places.json` 쓰기 모드는 삭제(서버 트리거가 대체).
- `import-seed.ts`(tsx, secret key): places upsert(`seed_ref`), `needs_review`면 `hidden_at=now()`, 시드 checkins 1줄, `--include <ids>`로 excluded 선별. 멱등 — 두 번 돌려도 diff 0.

### 4. 서버 계층 — `lib/server/*`(신규, `import "server-only"`) · `lib/db/database.types.ts`(생성) · `lib/data.ts`(교체) · `lib/types.ts` · `app/auth/callback/route.ts`(신규) · `components/auth/session-provider.tsx` · `lib/mock/` 정리
- `lib/server/supabase.ts`: `createServerClient`(@supabase/ssr, `cookies()` getAll/setAll — RSC에서 setAll 실패는 무시), `adminClient()`(secret key, 병합·탈퇴·임포트만). `lib/server/session.ts`: `currentSession()`(getClaims → `Session`), `ensureUser()`(없으면 `signInAnonymously`). `lib/server/rows.ts`: `places_public` 행 → `Place`, review 행 → `Review`(순수 함수, 테스트 대상). `lib/server/actions.ts`(`"use server"`): 지금 `lib/data.ts` 공개 함수와 **같은 이름·같은 시그니처**(+ 쓰기에 `turnstileToken`). `lib/server/turnstile.ts`·`rate.ts`(ip 해시)·`telegram.ts`·`photos.ts`(Images+R2)·`content-filter.ts`.
- `lib/data.ts`: 읽기 = 서버면 `queries` 직접, 클라이언트면 액션. 쓰기 = 클라이언트 래퍼가 Turnstile 토큰을 얻어 액션 호출. `MOCK_*`·`setAdmin`·`simulateWrite`·`dataset`·날짜 이동 전부 삭제. 상수(`MAX_PLACE_PHOTOS` 등)·zod 스키마는 남는다(액션·pgTAP과 같은 값). `Session.userId: string | null`, `Session.isAdmin` 유지(서버가 채움). `Checkin.type`에 `review`·`seed`.
- `lib/mock/places.json`·`checkins.json`·`reviews.json` **삭제**, `event-card.json`·`peel-test.json`은 `lib/content/`로(설정값이지 목이 아니다) — eslint boundaries의 "data.ts만 mock을 읽는다"를 `lib/content`로 정정.
- `SessionProvider`: 첫 로드 `getSession()`(방문자면 `userId: null`), 카카오 = 액션이 돌려준 URL로 `location.assign`, 콜백 뒤 `?login=ok`로 돌아오면 시트가 닫히며 하려던 일로 복귀(`requireLogin` 약속은 **URL 왕복을 넘지 못한다** — 리뷰 폼 복귀는 `history-state`에 의도를 심어 콜백 뒤 다시 연다). 로그아웃 = 액션 `signOut` → `userId: null`.
- `activity-panel`의 dev 관리자 토글 삭제. `Session.userId` null 대응 3곳(찜 세션 가드·프로필 행·admin).

### 5. 캐시·사진 서빙 — `open-next.config.ts` · `wrangler.jsonc` · `app/photos/[...key]/route.ts`(신규) · `lib/server/queries.ts`
- 바인딩: `NEXT_INC_CACHE_R2_BUCKET`(R2 `saeu-cache`), `NEXT_TAG_CACHE_D1`(D1 `saeu-tags`), `PHOTOS`(R2 `saeu-photos`), `IMAGES`(이미 있음), `RATE_LIMITER`(속도 제한 바인딩 — 커밋 5b). `staticAssetsIncrementalCache` → `withRegionalCache(r2IncrementalCache)`(OG 프리렌더는 `populateCache`가 R2로).
- `unstable_cache(getPlacesQuery, ["places"], { tags: ["places"] })` 등 3개, 쓰기 액션 끝에서 `revalidateTag`. 관리자 읽기·내 활동·찜은 캐시 안 함(사용자별).
- `/photos/[...key]`: R2 get → `Cache-Control: public, max-age=31536000, immutable`, 없으면 404. 키 형식 `<placeId>/<uuid>.webp`만 통과.

### 6. 스팸 4겹 — `components/auth/turnstile.tsx`(신규) · `lib/server/turnstile.ts` · `rate.ts` · `content-filter.ts` · 마이그레이션 트리거
- 위젯 마운트 1개 + `getTurnstileToken()`(execute → 콜백 약속, 실패 시 `reset` 후 1회 재시도). 액션은 토큰 없으면 거부, `siteverify` 실패는 "잠시 뒤 다시 시도해주세요" 한 문장(내부 정보 없음).
- `x-ip-hash`: 액션이 `headers().get("cf-connecting-ip")` + `IP_HASH_SALT`(일 단위 회전 = salt + KST 날짜) → supabase 클라이언트 `global.headers`. 트리거가 `current_setting('request.headers', true)::json->>'x-ip-hash'`로 읽는다.
- 내용 필터를 `reportInputSchema`·`suggestionSchema`·`reviewInputSchema`·`ownerRequestSchema`에 refine으로.
- **문 앞 경비(별도 커밋 5b)**: `wrangler.jsonc` `ratelimits`(60초 창, IP당 N) + 액션 공통 진입에서 `env.RATE_LIMITER.limit({ key: ip })` → 실패면 같은 문구로 거부. 로컬·테스트에는 바인딩이 없으니 없으면 통과. 프리뷰에서 연타로 실제 거부를 본 뒤 완료.
- **프리뷰 읽기 전용**: `PREVIEW_READONLY=1`이면 모든 쓰기 액션(익명 생성·로그인 포함)이 맨 앞에서 "프리뷰는 읽기 전용이에요"로 거부. 화면은 기존 실패 토스트 경로를 탄다.

### 7. 관리자 실연결 — `app/admin/page.tsx` · `components/admin/*` · `lib/server/admin.ts` · 마이그레이션(관리자 정책·병합 RPC)
- 서버 게이트(진짜 404, 제목은 관리자에게만). 5탭의 읽기·쓰기를 액션으로(시그니처 동일 — 화면 무변경).
- **중복 의심 큐**: 사후 확인 탭에 `duplicate_suspect_of` 있는 행은 "중복 의심 · 후보 가게명" 배지 + [이 가게로 합치기]. **이전 가게 처리**: 검색 탭·중복 배지의 [합치기] = `private.merge_places(from,to)`(사진·확인·리뷰·찜 이동, `merged_into` 기록, 숨김) → `/place/[old]`는 `permanentRedirect(/place/new)`(spec 4.3 엣지). 되돌리기 없음 — 확인 모달(삭제와 같은 급).
- 디스코드 웹훅: 제보·신고·사장님 요청·신고 3회째. `waitUntil`(`getCloudflareContext().ctx`), 실패는 Sentry에만. 본문은 상호·지역·사유·[플레이스 열기]·[관리자 열기] 링크(연락처 같은 개인정보는 넣지 않는다 — 채널이 새면 같이 샌다).

### 8. CI·운영 — `.github/workflows/ci.yml` · `.github/workflows/keepalive.yml`(신규) · `docs/runbook.md`(신규) · Sentry
- `check` 잡 앞에 `db` 잡: `supabase/setup-cli` → `supabase start` → `supabase test db` → `gen types --local` diff → `db advisors`. `check`의 빌드·스모크는 로컬 Supabase(`supabase start` + `seed.sql`)를 상대로 — 스모크가 처음으로 **실 DB 경로**를 지난다(`/`에서 첫 `/place/<uuid>` 링크를 뽑아 따라간다). `preview`는 prod URL·publishable + `--var PREVIEW_READONLY:1`, `deploy`는 prod 키. 시크릿·변수 표는 runbook.
- `keepalive.yml`: 매일 09:00 KST `curl -sf https://saeu-map.saeu-map.workers.dev/`.
- Sentry: `@sentry/nextjs` 위저드 대신 수동 3파일(`sentry.client/server.config.ts`, `instrumentation.ts`), DSN은 `NEXT_PUBLIC_SENTRY_DSN`. 프리뷰에서 `?mock=error`(dev 전용이라 프리뷰엔 없다 — 임시 서버 액션 `throw`로) 이벤트 1건 확인 후 완료.

### 9. 보안 스윕 · 감사 · 머니패스
- **쓰기 경로 × (검증 · 권한 · 제한 · 에러 문구) 표**를 decisions에 남긴다(roadmap "런칭 전 보안 스윕") — security-reviewer 1회 + 표 대조.
- gap-sweeper: roadmap Phase 6 + spec 5·6 + design의 "Phase 6" 문구 8곳(상세 스켈레톤 도달·관리자 사후 확인 행·리뷰 사진 교체 등).
- 폰 머니패스(로컬 workerd → prod): 제보(사진 1장) → 지도 노출 → 다녀왔어요 → 카드 "오늘 확인" → 카카오 로그인 → 리뷰 → 디스코드 알림 → 사후 확인. 결과 "## 결과"에 수치.

## 변경 파일

| 영역 | 파일 |
|---|---|
| 문서 | `docs/decisions.md` `docs/spec.md` `docs/roadmap.md` `docs/runbook.md`(신규) `CLAUDE.md` `AGENTS.md` `.env.example` `scripts/README.md` |
| DB | `supabase/config.toml` `supabase/migrations/0001_init.sql` `0002_subway_exits.sql` `supabase/seed.sql` `supabase/seed/subway_exits.csv` `supabase/tests/{000..060}.sql` |
| 시드 | `scripts/convert_seed.py` `scripts/add_nearest_station.py` `scripts/import-seed.ts`(신규) |
| 서버 | `lib/server/{supabase,session,rows,queries,actions,admin,turnstile,rate,telegram,photos,content-filter}.ts`(신규) `lib/db/database.types.ts`(생성) `app/auth/callback/route.ts`(신규) `app/photos/[...key]/route.ts`(신규) |
| 교체 | `lib/data.ts` `lib/types.ts` `lib/map-screen-data.ts` `lib/env.ts` `lib/mock/*`(삭제 3·이동 2 → `lib/content/`) `eslint.config.mjs` |
| 컴포넌트(최소) | `components/auth/{session-provider,turnstile}.tsx` `components/activity/activity-panel.tsx`(토글 삭제) `components/admin/{pending-tab,search-tab}.tsx`(합치기) `components/map-screen/use-map-screen.ts`(userId null) `app/admin/page.tsx` `app/place/[id]/page.tsx`(리다이렉트) `app/layout.tsx`(Turnstile 스크립트) |
| 인프라 | `open-next.config.ts` `wrangler.jsonc` `next.config.ts` `sentry.*.config.ts` `instrumentation.ts` `.github/workflows/{ci,keepalive}.yml` `package.json` |
| 테스트 | `lib/__tests__/data.test.ts`(삭제 → `data-facade.test.ts`) `lib/server/__tests__/{rows,rate,content-filter,turnstile}.test.ts` `components/auth/__tests__/session.test.tsx` `components/admin/__tests__/*`(합치기) |

## 검증

1. 커밋마다 `pnpm typecheck && pnpm lint && pnpm test 2>&1 | grep -E 'FAIL|✗|error' | head -40` + DB 커밋은 `pnpm db:test`·`supabase db advisors`.
2. `supabase start` + `pnpm dev`: 방문(익명 없음, `auth.users` 0행) → 찜(익명 생성) → 제보(사진) → 다녀왔어요(같은 날 2번째 거부) → 카카오(로컬 앱) → 리뷰 → 로그아웃 → 다시 카카오 = 병합(찜·리뷰가 남는다) → 탈퇴(행 익명화). `/admin` 비관리자 **HTTP 404**. 검수 필터에서 숨긴 시드 [복구] → 지도에 뜬다. 확인 0회 제보 핀은 "○일 전 등록". 시드 790곳에 NEW 배지 0개.
3. `pnpm preview`(workerd :8787, `wrangler dev` 로컬 R2·D1·Images): 홈 200 · 캐시 적중(두 번째 요청에 Supabase 로그 없음) · 제보 뒤 `revalidateTag`로 목록 갱신 · `/photos/<key>` 200 + immutable · OG 정적 서빙 · 새 핀은 루트 OG.
3b. 프리뷰(PR 업로드 뒤): `PREVIEW_READONLY`로 찜·제보·로그인이 전부 "읽기 전용" 토스트, 읽기는 prod 데이터. 속도 제한 바인딩은 연타 시 거부(커밋 5b). 디스코드 채널에 테스트 제보 알림 1건(로컬에서).
4. Playwright 390×702·320×480·1440×900 회귀(화면은 안 바뀌었어야 한다 — 로그인 URL 왕복 뒤 복귀만 새 동작).
5. gap-sweeper·security-reviewer 각 1회 "표 40줄 이내".
6. push + PR(플랜 승인 = push 승인, 완료 조건이 프리뷰 URL) → 프리뷰에서 읽기 전용 확인 → 머지 → prod 임포트 ≈790 → prod에서 실제 행동으로 머니패스 1회.

## 커밋 단위 (한 턴 = 한 커밋)

1. `docs`: decisions·CLAUDE·AGENTS·spec·roadmap·.env.example 정정
2. `chore(db)`: supabase init·config·마이그레이션 0001·pgTAP·seed.sql·스크립트 — `db:test` 초록
3. `feat(seed)`: 변환기 두 CSV 모양 + 정제 + 리포트·역 CSV(서울·부산·광주)·import-seed — 로컬 ≈790곳 임포트, 파싱율 표, needsReview 숨김 수
4. `feat(server)`: lib/server 읽기·세션·콜백·병합, data.ts 읽기 교체, mock 삭제·content 이동, Session null — 홈·상세·`/gu`·`/test` 실 DB
5. `feat(writes)`: 쓰기 액션 11종(확인·찜·제보·제안·리뷰 3·사진·신고 3·사장님·닉네임·탈퇴) + Turnstile + Postgres 속도·필터 + `PREVIEW_READONLY` — 화면 무변경 확인
5b. `feat(ratelimit-edge)`: Cloudflare 속도 제한 바인딩 보조 — 프리뷰에서 발화 확인
6. `feat(cache)`: R2·D1·open-next·unstable_cache·revalidateTag·`/photos` 라우트 — workerd 확인
7. `feat(admin)`: 서버 게이트 404·5탭 액션·검수 필터·중복 의심·합치기·리다이렉트·디스코드 웹훅·`peel_results` 테이블
8. `ci`: db 잡·실 DB 스모크·프리뷰 읽기 전용 변수·prod 키·keepalive·runbook
9. `feat(ops)`: Sentry + 발화 확인(안 되면 decisions에 Phase 7 이월)
10. `fix`/`docs`: 보안 스윕 표·gap-sweeper·security-reviewer 반영·머니패스·roadmap 체크·"## 결과" → push·PR

## 범위 밖 (기록)
- 템플릿화(설정 파일로 카테고리·사이드·카피 교체) — 두 번째 맵 시작 시. 셀프호스팅 실제 이전 — 트리거(egress 4GB·Pro 전환 신호, spec 6) 도달 시.
- 도메인·WAF·Bot Fight Mode·R2 커스텀 도메인·CF Web Analytics·GA4 켜기 — Phase 7(zone이 있어야 한다).
- `/test` 참여자 수·유형 비율의 **화면 표시**(테이블·RPC는 이번에), 사이즈 판독기, 시즌 스탬프·레벨(백로그 — 위 decisions 항목), 부산·광주 구별 페이지(`/gu/`는 서울 25구만) — Phase 7 이후.
- 리뷰 사진 교체(수정 시) — 리뷰 폼 UI 변경이라 별도. 구글 로그인 — 백로그 조건 그대로.
- `cacheComponents`(`use cache`) 전환 — 렌더 모델 변경, 별도 판단.

---

## 결정 기록 (2026-09-09 ~ 10, 사용자와 하나씩 확정)

| # | 질문 | 결정 | 메모 |
|---|---|---|---|
| 1 | 카카오 승계 | **OAuth + 콜백 서버 병합** 한 경로 | linkIdentity는 재로그인에서 실패해 병합이 어차피 필요 |
| 2 | 사진 저장소 | **R2 직행** + 키만 저장 + 월 4,500장 상한 + regional cache + 월 1회 사용량 확인 | 무료 한도 실측 표는 decisions. NCP 크레딧이 아끼는 돈은 0원, 11/30 이전 작업 소멸 |
| 3 | 속도 제한 | **Postgres 트리거 + Cloudflare 바인딩 보조**(별도 커밋, 발화 확인) | Upstash 미채택 |
| 4 | 신고 3회 | **알림 + 관리자 표시까지**, 자동 숨김 없음. 알림 채널은 **디스코드** | 텔레그램은 브리프 값 — 사용자가 매일 여는 앱 기준 |
| 5 | Workers 플랜 | **Free 유지**. 트리거: 새 핀 공유 카드가 필요해지거나 하루 요청 10만 근접 → Paid $5 | 그때 OG를 요청 시 렌더로 되돌린다 |
| 6 | Sentry | **이번 Phase 마지막 커밋**, 프리뷰 발화 미확인 시 Phase 7 |  |
| 7 | 환경 셋 | **호스티드 prod 하나 + 프리뷰 읽기 전용** | 무료 슬롯이 계정당 2개, 1개 사용 중 |
| 8 | NEXT_PUBLIC_ 목록 | 네이버 지도 Client ID · 카카오 JS 키 · GA4 측정 ID · **Turnstile site key · Sentry DSN**. Supabase 키 제외 | 값은 브라우저 파일에 그대로 박힌다 — "명찰"만 보낸다 |
| 9 | 가게 id | **uuid** |  |
| 10 | 검수 37곳 | **숨긴 채 임포트 → 관리자 검색 탭 검수 필터에서 [복구]**. excluded.csv 무시. **시드 지역 확장: 부산·광주·목포·무안** | probe CSV 2026-09-09 크롤(부산 190·광주권 145) |
| 11 | 제보 핀 확인일 | **이번에 닫음** — 확인 0회 "○일 전 등록" | 시드는 수집일 기준 "○일 전 확인", NEW 아님 |
| 12 | `/test` 참여 기록 | **테이블 + RPC까지**, 화면은 Phase 7 |  |
| 13 | 외부 계정 | 분담은 결정 26 | 사용자 몫: 카카오 앱 · Turnstile 위젯 · 디스코드 웹훅 · `supabase login` 승인 |

플랜 승인 = 커밋 1부터 실행. 브랜치는 main에서 `feat/phase6-backend`(현 브랜치 `feat/report-menu-lines`는 그 PR대로 둔다).
