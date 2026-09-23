# Phase 7 — 런칭 준비 (roadmap Phase 7 · spec 4.6·8·9)

**상태: 확정(2026-09-22) — 결정 10건 전부 답 받음(decisions 같은 날). 런칭일 9-26(금).** 역산: 코드 PR은 9-23 머지 → 9-24~25 콘솔·머니패스·런칭 글. 이 문서는 계속 **런칭 전 남은 일 전수 목록**이다.

## Context

Phase 6 코드는 끝났고(2026-09-16) prod(`새우맵.kr`)가 실 DB로 돈다. 2026-09-21에 Workers Paid 한도 적용(재배포)·workers.dev 복구·Always Use HTTPS까지 닫았다. 이 문서는 roadmap(Phase 6 마지막 줄·백로그·Phase 7) · `phase6-backend.md` "결과"의 이월 · decisions 2026-09-16~21 · runbook · spec 8·9장을 읽어 **런칭 전에 남은 것을 한곳에** 모은 것이다.

조사 시점 prod 실측(2026-09-21 21시 KST): 홈·`sitemap.xml`(URL 793)·`robots.txt` 200, TTFB 2~3.5초(콜드 + LAX 경유), `cf-placement: local-LAX`, `http://` → 301.

## 0. Phase 6 닫기 (코드 0 — 실측·확인만)

| # | 할 일 | 누가 | 상태 |
|---|---|---|---|
| ~~0-0~~ | ~~prod 카카오 로그인 불가~~ — GoTrue가 scope에 `account_email`을 고정 → 카카오 앱에 동의항목이 없어 KOE205. **개인 개발자 비즈 앱 전환 + 이메일 선택 동의**로 해결, 코드·배포 변경 0 (decisions 2026-09-21). 병합·리뷰·탈퇴는 0-2에서 | 사용자(콘솔) | 완료 2026-09-21 (사용자 로그인 확인) |
| 0-1 | ~~`docs/keepalive-verify` 브랜치 push → 문서 PR~~ — 그 커밋 6개가 `feat/phase7-hardening`(PR #18)에 이미 들어 있어 별도 PR이 필요 없다. #18 머지 뒤 로컬 브랜치만 지운다 | 내가 | PR #18에 포함 (2026-09-22 확인) |
| 0-2 | **prod 폰 머니패스**: 확인·찜·제보(사진)·수정 제안·신고 → 카카오 로그인 → 리뷰 작성·삭제 → 익명→카카오 병합 → 탈퇴. 첫 쓰기의 Turnstile 지연도 같이 본다(프리뷰 헤드리스에서 첫 POST 6초+, decisions 2026-09-21) | 사용자(폰) + 내가(`wrangler tail`·DB 대조) | **일부 완료 2026-09-21**: 찜 → 카카오 로그인 → 병합(찜 유지) → 탈퇴(DB에서 유저·아이덴티티·프로필·찜 0 확인, decisions 같은 날). **남음**: 확인·제보(사진)·수정 제안·신고 · 리뷰 작성·삭제 · 첫 쓰기 지연 |
| 0-3 | prod 관리자: 카카오 로그인 뒤 `profiles.is_admin = true`(runbook 2-2) → `/admin` 5탭 실사용 → 디스코드 **실채널** 알림 발화 | 같이 | 기록 없음 |
| 0-4 | ~~프리뷰 읽기 전용 발화~~ | 내가 | 완료 2026-09-21 (`read only` → 토스트 → 롤백) |
| 0-5 | 검수 대기 27곳 — 관리자 [검수 대기] 칩 → 30초 보고 [복구] (runbook 3b) | 사용자 | 미착수 |
| 0-6 | Smart Placement가 `remote-…`로 옮겼는지 재확인(지금 `local-LAX`). 트래픽 부족이면 `INSUFFICIENT_INVOCATIONS` | 내가 | **아직 아님** — 2026-09-22 실측 `cf-placement: local-SEA`(홈·상세·sitemap, 5회). 배포 후 하루라 트래픽 부족일 가능성이 크다. 상태 코드는 대시보드 Workers → saeu-map → Settings → Placement(사용자). 런칭 뒤 1~2주 실측과 같이 다시 본다(범위 밖 "워커 CPU 다이어트"와 한 묶음) |
| 0-7 | Sentry 정리: MAP-1 resolve · MAP-2 archive · MAP-4 resolve | 내가(사용자가 `event:write` 토큰 발급) | **완료 2026-09-23** — API PUT 3건 200. 남은 미해결 MAP-3·5·6·7(9/18~21, 네트워크 끊김류 + "unexpected response" 1건)은 배포 뒤 다시 본다 |
| 0-8 | roadmap Phase 6 "사용자 콘솔 작업" 줄 체크 + 완료 줄 갱신 | 내가 | 0-2·0-3 뒤 |

0-2에서 버그가 나오면 그게 Phase 7의 어떤 항목보다 먼저다.

## 결정 (2026-09-22 전부 확정 — 답: D1·D1b·D1c·D2·D6·D7·D9 권고대로, D3·D4 런칭 후, D8 보류, **D10 = 9-26**. 분석은 GA4 + CF Web Analytics 둘 다, 방침과 같은 PR)

| # | 질문 | 권고(= 결정) | 근거 |
|---|---|---|---|
| D1 | 개인정보처리방침 페이지 | 만든다 — 정적 `/privacy` | 지금 `app/`에 없다. GA와 무관하게 카카오 닉네임·프로필 사진 + **이메일(선택 동의, 2026-09-21)** 을 받는다. 분석 켜기의 선행 조건(roadmap, decisions 2026-09-08). 본문 초안은 내가(수집 항목 = 컬럼 GRANT, 보관 = 익명 정리 크론·IP 해시 24h, 위탁 = Supabase·Cloudflare·Sentry(+GA4), 탈퇴 = `admin_delete_user`), 운영자 표시(이름·연락 이메일)는 사용자 |
| D1b | 서비스 이용약관 | 만든다 — 정적 `/terms`, `/privacy`와 같은 레이아웃 | 법적 의무는 아니지만 UGC(리뷰·사진·제보)를 받는다: 게시 허락 · 삭제·숨김·제한 권한 · 제보 기반 정보의 정확성 면책 · 사장님 요청 처리(spec 3) · 금지 행위. **법률 검토가 아니라 판단** |
| D1c | 약관·방침 링크 자리와 동의 방식 | 로그인 시트 [카카오로 시작하기] 아래 캡션 한 줄("시작하면 이용약관·개인정보처리방침에 동의하게 됩니다") + 내 활동 시트 하단. 익명 쓰기는 체크박스 없이 "이용 시 동의" | 지도 앱이라 푸터가 없고 design.md에 자리가 없다(미정). 체크박스는 제보 플로우를 무겁게 한다 |
| D2 | 동의 배너 | 없이 가고 방침에 쿠키·GA4 고지 | 국내 서비스 관행. **법률 검토가 아니라 판단이다** — 사용자 확인 필요 |
| D3 | 축제 페이지 | 런칭 후로(roadmap Phase 7 줄 정정) | spec 8은 "런칭 후", roadmap은 Phase 7 — 어긋나 있다 |
| D4 | `/test` 참여자 수·유형 비율 화면 | 런칭 후 | RPC는 Phase 6에 있다. 0명에서 시작하는 숫자는 역효과 — 노출 하한(예: 수백 명)을 정한 뒤 |
| D5 | 라이브 피드(spec 8 "런칭에 포함") | **확인 끝(2026-09-21) — design 기준으로는 구현돼 있다.** design 화면 1-4의 캡션 "초록 라이브 점 + 오늘 N건 확인됐어요 │ 이번 주 N곳 │ 새로 들어온 집 N곳"이 `season-counter.tsx`이고 값은 `season_stats` RPC(checkins 실데이터)다 → roadmap의 "시즌 카운터 실데이터"도 Phase 6에서 끝났다. spec 8 문구의 "3분 전 을지로 OO집"(최근 확인 가게) 조각은 design에 없다 — 넣고 싶으면 결정 | 관련 코드가 `lib/map-screen-data.ts`·`lib/server/actions.ts`에 보이나 화면까지 미확인. roadmap Phase 7 줄엔 없다 |
| D6 | HSTS | 켠다, 짧은 `max-age`부터 | decisions 2026-09-21 "따로 정한다(미정)" |
| D7 | keepalive 실패 알림 | 워크플로 실패 시 디스코드 한 스텝 | 나흘 빨강을 월간 점검이 못 잡았다(decisions 2026-09-21, 미정) |
| D8 | `www` 리다이렉트 | 계속 보류 | runbook 3d "치는 사람이 거의 없어 보류" |
| D9 | 구글 서치 콘솔도 등록? | 한다(네이버와 같은 작업) | spec 4.6은 네이버만 적었다 |
| D10 | **런칭일** | **2026-09-26(금)** | 역산 기준. spec 9의 나머지(SNS 채널·10월 말 판단 숫자·태그라인)는 런칭 글 전까지 |

## 변경 (결정 뒤 확정)

### 1. 보안 하드닝 4건 (roadmap 백로그 "보안 리뷰 백로그", 런칭 전 필수) — `supabase/migrations/` · `supabase/tests/` · `lib/server/turnstile.ts` · `lib/server/write-gate.ts`
- ① publishable 키 유출 대비: GoTrue captcha(`[auth.captcha] turnstile`) + `signInAnonymously`에 captchaToken. 토큰이 1회용이라 지금의 서버 siteverify와 이중 검증이 안 된다 → **구조 변경, 넷 중 가장 크다.**
- ② `reviews_public.author_id` → `is_mine` (익명에게 auth uid 노출 안 함)
- ③ 카카오 닉네임 초기값을 폼과 같은 정규화·금칙어 검사로(트리거)
- ④ Turnstile siteverify `hostname` 검증 — 더미 키의 hostname 확인 뒤

### 2. 최종 리뷰 백로그 (roadmap 백로그, 2026-09-16 커밋 10a)
- 42501 매핑 통일(신고는 rate limited · 확인은 place not found)
- 액션 단위 테스트 세트(supabase 클라이언트 목)
- supabase CLI npm 고정(`pnpm exec supabase`)
- `peel_results` 월 집계 후 정리 크론

### 3. 서치어드바이저 — `app/layout.tsx`(소유 확인 메타, 지금 없음)
- 네이버 서치어드바이저(+ D9면 구글) 소유 확인 → sitemap 제출. 콘솔 등록·확인 코드는 사용자, 메타 배선은 내가. 확인 코드는 공개값.

### 4. 약관·방침·분석 — `app/privacy/page.tsx` · `app/terms/page.tsx`(신규, D1b면) · 로그인 시트·내 활동 링크(D1c) · `app/layout.tsx` · GH variable `NEXT_PUBLIC_GA_ID`
- D1·D1b·D1c·D2 뒤. design.md에 링크 자리를 먼저 적는다. Cloudflare Web Analytics 배선 + GA4 측정 ID(허용 목록 안 — 절대 규칙 7). GA4 내부 트래픽 제외(runbook 4-1).

### 5. Sentry 소스맵 — GH secret `SENTRY_AUTH_TOKEN` · `next.config`
- phase6 "하지 않은 것"에서 이월.

### 6. 운영 — `.github/workflows/keepalive.yml`(D7) · 대시보드 HSTS(D6, 사용자)

### 7. 조건부
- 핀 공유 카드 요청 시 생성(`/og/place/[id]` — satori+resvg + R2 캐시). 조건: 새 제보가 공유되기 시작할 때. 런칭 전에 넣을지는 0-2 머니패스에서 "새 핀 공유 → 루트 카드"가 거슬리는지로 판단.
- D5 결과 라이브 피드가 미구현이면 여기 들어온다.

### 8. 마감
- gap-sweeper(spec 4.6·8 + 이 문서) 미구현 0 · security-reviewer · 이 파일 맨 아래 "## 결과".

## 사용자 몫 (콘솔·운영 — 코드와 병행)

- 실기기: iOS 리뷰 폼 CTA가 키보드에 가리는지(roadmap 백로그) · 실기기 LCP(4초를 넘으면 청크 분할 백로그를 집는다, decisions 2026-09-07)
- 사용량 알림(runbook 4-2): Cloudflare Images · Supabase Usage (NCP는 이미)
- 런칭 글("전수조사", spec 8) · SNS 채널 개설 (D10과 함께)
- ~~로컬 `[gone]` 브랜치 8개 정리(`/clean_gone`)~~ — 2026-09-22 `fetch --prune` 뒤 0개(이미 정리됨)

## 검증

- 매 커밋: `pnpm typecheck && pnpm lint && pnpm test`. 마이그레이션이 있으면 `pnpm db:reset && pnpm db:test && pnpm db:advisors`(0건) + `pnpm db:types` diff.
- 보안 ①: 로컬 dev + workerd(`pnpm preview`)에서 익명 첫 쓰기·카카오 로그인·프리뷰 읽기 전용이 그대로인지. 배포 뒤 prod에서 0-2의 쓰기 한 바퀴를 다시.
- 서치어드바이저·분석·소스맵은 **발화가 완료 조건**: 콘솔의 "소유 확인됨", GA4 실시간 1건, Sentry 스택에 원본 파일명.
- 배포 뒤 runbook 3d 마지막 두 줄(세 주소 200 · keepalive 수동 실행).

## 진행 (2026-09-21 — 사용자 "결정이 필요 없는 것부터 시작", 브랜치 `feat/phase7-hardening`)

| 단위 | 상태 | 검증 |
|---|---|---|
| 보안 ④ Turnstile `hostname` | 완료 `4a35fc1` — 요청 `Host`와 대조(`x-forwarded-host`는 안 본다), 테스트 키(`result_with_testing_key`)는 건너뜀, 어긋나면 `reportError` | vitest 1 추가 · 로컬 dev 찜·해제 `{"ok":true}`. **배포 뒤 prod 첫 쓰기로 재확인**(실 secret의 hostname 표기를 아직 못 봤다 — 어긋나면 Sentry "turnstile hostname mismatch") |
| 보안 ③ 카카오 닉네임 초기값 | 완료 `7073644` — `private.clean_nickname`(NFKC → 글자·숫자·공백만 → 12자 → 2자 미만·금칙어면 null)을 `handle_new_user`가 쓴다. 금칙어가 TS·SQL 두 곳이라 동기화 테스트 | pgTAP 070(12) · `banned-words-sync.test.ts` · `[[:alnum:]]`의 한글 판정은 로컬·prod(17.6, en_US.UTF-8) 동일 확인 |
| 리뷰 백로그: 42501 매핑 | 완료 `4255b22` — `failFromDb`에 42501·23503, 확인·찜·신고 호출부 통일. 화면은 두 코드를 가르지 않아(grep 0) 구분용 추가 조회는 넣지 않았다 | vitest 그대로 |
| 리뷰 백로그: `peel_results` 정리 | 완료 `c88cbb5` — `peel_monthly` + 월 1회 크론(`rollup-peel-results`), `peel_stats()` = 합계 + 원본 | pgTAP 080(9) · advisors 0 · 타입 갱신 |
| 리뷰 백로그: supabase CLI npm 고정 | **하지 않음** — 로컬·CI 둘 다 2.117.0이고 CI는 `setup-cli`에 판을 적어 뒀다. 어긋나면 CI의 타입 diff가 트립와이어. postinstall 바이너리 의존성을 새로 들일 값이 없다(코드 최소주의 4) | — |
| 리뷰 백로그: 액션 단위 테스트 | 완료 — `lib/server/__tests__/actions.test.ts`: 문(gate) 실패 4종 전달 · 행위자 전달 · 확인·찜·신고의 오류 코드 매핑 · 성공 시 캐시 만료·알림 · 섀도 밴은 알림 없음. 체이닝 가능한 가짜 클라이언트(`fakeDb`) — 권한·제한 자체는 pgTAP 몫 | vitest 16 추가 |
| Sentry 소스맵 | **배선 완료, 발화는 토큰 뒤** — `next.config.ts`가 `SENTRY_UPLOAD_TOKEN`이 있을 때만 업로드(main `deploy` 잡), 올린 뒤 .map 삭제. 브라우저 스택만 풀린다(서버는 OpenNext가 다시 묶는다). **사용자: Organization Token(`org:ci`) 만들어 `! gh secret set SENTRY_UPLOAD_TOKEN`**(runbook 2-5) | 토큰 없음: 빌드 통과·맵 0 · 가짜 토큰: 401 로그만 남기고 빌드 완주·맵 0(만료 토큰이 배포를 막지 않는다). 남은 발화: 배포 로그의 업로드 줄 + 새 이슈 스택의 원본 파일명 |
| 보안 ② `author_id` | 완료 — **뷰가 아니라 컬럼 GRANT를 거뒀다**(`reviews` 표 전체가 SELECT로 열려 있어 뷰만 바꾸면 `/rest/v1/reviews?select=author_id`로 그대로 읽혔다). `reviews_public`에서 열 제거 + 닉네임은 DEFINER 헬퍼 `private.review_nickname`, **본인 판정은 `me().reviewIds`**(상세는 anon 공유 캐시라 행마다 `is_mine`을 실을 수 없다 → 세션에 싣는다, 추가 요청 0). 화면은 `Review.authorId` 대신 `Session.reviewIds` + 이 화면에서 방금 쓴 id(`writtenHereId` — 세션 갱신 전·섀도 밴의 가짜 리뷰). `reviews`를 `author_id`로 읽던 액션 3곳(내 리뷰·닉네임 뒤 캐시 만료·리뷰 사진 소유 확인)은 id 목록으로 | pgTAP 020 11 → 17(방문자·로그인 모두 `author_id` 42501, 뷰엔 열 없음 42703, 정책의 author_id 비교는 열 권한 없이 돈다, `me().reviewIds`) · advisors 0 · 로컬 PostgREST anon 실측 · 상세 SSR 200에 리뷰·닉네임 있음/uid 없음 |
| 보안 ① captcha 구조 변경 | **사용자 결정·재료 대기 — 코드만으로 못 끝낸다** | 필요한 것: ⓐ 실 Turnstile secret을 Supabase auth 설정(`[auth.captcha]`)에 — 그 값은 사용자만 갖고 있다(로컬은 테스트 키) ⓑ prod `supabase config push`(인증 설정 변경) ⓒ 순서가 걸린 배포: captcha를 켜는 순간 **옛 앱의 익명 가입(토큰 없이 `signInAnonymously`)이 전부 거부**되고, 새 앱을 먼저 내면 첫 쓰기의 봇 확인이 GoTrue로 넘어가 있어 켜기 전까지 비어 버린다(토큰이 1회용이라 우리 siteverify와 둘 다 쓸 수 없다) → 전환용 플래그가 필요. 막는 위협은 "publishable 키가 새면 익명 유저를 대량 생성해 DB 제한을 우회"인데 키는 워커·GH secret에만 있고 `rate_ok`는 이미 fail-closed다. **권고: 런칭 뒤**(트래픽 없는 지금보다, 실제 어뷰징 신호가 보일 때 반나절 잡고) |

| security-reviewer (PR #18 diff, 머지 전) | **완료 2026-09-22 — High/Med 0.** Low 3: ① `turnstile.ts` Host 헤더가 없으면 hostname 검증을 건너뜀(fail-open) ② prod에 Cloudflare 더미 secret이 들어가면 siteverify·hostname 두 겹이 같이 꺼지는데 `lib/env`에 가드 없음 ③ `use-place-detail.ts` `writtenHereId`가 사용자 전환 뒤 남아 이전 사용자 리뷰에 [수정][삭제] 표시(RLS가 막아 표시 오류뿐). Info 2: 백필 update의 "캐시 무관" 주석 부정확(배포~db push 사이 채워진 상세는 옛 닉네임, prod 실효 0) · `private.review_nickname`은 profiles 닉네임 공개가 전제. 확인함: DEFINER `search_path=''`·EXECUTE 회수, uid 새는 경로 0, 세션은 anon 캐시 밖, Host 스푸핑 불가, 소스맵 토큰 번들 밖, 절대 규칙 위반 0 | **①③④⑤ 반영(2026-09-22)**: ① `verifyTurnstile`의 `expectedHost`를 필수 `string \| null`로 — 없으면 mismatch(`want: null` 보고) · ③ `writtenHere`에 쓴 사람 uid를 같이 담아 세션 사용자와 같을 때만 내 것 · ④⑤ 주석·배포 순서 한 줄. vitest +1(회귀: 옛 코드 실패 확인). **② 백로그(런칭 뒤)** — CI 빌드가 설계상 더미 secret을 써(runbook 1절) `lib/env` production refine이면 CI가 깨진다; 런타임 가드로 다시 설계 |
| Codex PR #18 코멘트 2건 | 완료 `a03408b` `dfad926` — ① 세션을 바꾸는 요청 다섯이 `settleSession`(요청 순번)을 지난다 ② 닉네임 트리거의 기존 프로필 백필 update(decisions 2026-09-22) | vitest 1 · pgTAP 1 추가 · CI 재실행 초록 |

수치: pgTAP 99 → **127**(9 파일) · vitest 560 → **580** · advisors 0.

**PR 2 `feat/phase7-launch` 진행 (2026-09-22, #18 위에 쌓음)**

| 단위 | 상태 | 검증 |
|---|---|---|
| 6 design 화면 12 + 링크 자리 | 완료 `312f399` — 흰 바탕 640 컬럼 문서 그릇, 화면 5에 캡션·하단 링크(새 탭) | — |
| 7 `/privacy`·`/terms` | 완료 `8b4df52` `32152ae` — 본문은 Explore 조사 표(스키마·크론·위탁·탈퇴 동작)로. `lib/legal.ts` 상수(`lib/content`는 data 전용이라 밖). 문의 이메일 확정(2026-09-22) | vitest 3 · 390×702 실측(위탁 표 3열로 정정) |
| 8 로그인 시트 캡션 + 내 활동 하단 | 완료 `8b4df52` — 체크박스 없음, 새 탭(오버레이 히스토리와 안 얽히게) | vitest 2 |
| 9 분석 | **코드 0** — GA4는 이미 배선(`google-analytics.tsx`, 변수 없으면 미삽입), CF Web Analytics는 대시보드 자동 설정(prod HTML에 `no-transform` 없음 확인). runbook 2-6 | 발화: GA4 실시간 1건 · `grep -c cloudflareinsights` = 1 |
| 10 keepalive 알림 | 완료 `b5a499c` — `if: failure()` 디스코드, secret 없으면 경고만. 수동 실행 `url` 입력으로 발화 검증 | **발화 대기**: `gh secret set DISCORD_WEBHOOK_URL` 뒤 없는 주소로 수동 실행 → 1건 |
| 11 소유 확인 메타 | **사용자 코드 대기** — 네이버·구글 콘솔의 HTML 태그 `content` 값(공개값) | 콘솔 "소유 확인됨" |
| Codex PR #19 코멘트 2건(P1) | 완료 — 둘 다 **문장 정정**(사용자 결정: 탈퇴해도 기여 콘텐츠는 남긴다, decisions 2026-09-23). 리뷰/기여 콘텐츠·속도 제한 해시/신고 해시를 행으로 나눠 적음. 신고 IP 해시 정리 잡은 런칭 뒤 백로그 | vitest 그대로 |
| 12 docs | roadmap `a49b63d` · runbook 2-6 `c2410f0` · 갭 스윕·"## 결과"는 11 뒤 | — |


**배포 순서(어기면 상세가 전원에게 깨진다)**: ① PR 머지 → `deploy` 잡 초록(새 앱) → ② `supabase db push`(사용자 승인, CI가 하지 않는다 — runbook 3) → ③ prod에서 상세 한 번 + 카카오 로그인 상태로 내 리뷰 [수정][삭제] 확인. 이유: **옛 앱은 `reviews_public.author_id`를 필수로 읽어서** 마이그레이션이 먼저 가면 리뷰 파싱이 전부 실패한다. 새 앱은 옛 DB에서도 돈다(`reviewIds` 없으면 빈 목록 — ①~② 사이 몇 분은 내 리뷰의 [수정][삭제]·내 리뷰 목록만 안 보인다). 마이그레이션 3개: `nickname_clean` · `peel_rollup` · `reviews_hide_author`. ②의 닉네임 백필이 행을 고쳤으면(prod는 닉네임 프로필 0이라 실효 없음) ①~② 사이에 채워진 상세 캐시가 옛 닉네임을 들고 있다 — 다음 main 머지(문서 PR이라도 `deploy`가 돈다)가 새 빌드 id로 캐시를 새로 시작하니 그걸로 닫는다(security-reviewer 2026-09-22 ④).

## 커밋 단위 (한 턴 = 한 커밋)

~~1~5. 플랜·보안 ②③④·리뷰 백로그·소스맵 배선~~ — PR #18(2026-09-21~22). 보안 ①은 런칭 뒤.

**PR 2 — `feat/phase7-launch`(#18 위에 쌓고 #18 머지 뒤 main으로 리베이스), 9-23 머지 목표:**
6. docs(design): 약관·방침 링크 자리(로그인 시트 캡션·내 활동 하단) + 정적 문서 페이지 레이아웃을 design.md에 먼저 적는다
7. feat: `app/privacy/page.tsx` · `app/terms/page.tsx` — 본문은 코드에서 뽑은 사실(수집 항목 = 컬럼 GRANT, 보관 = 익명 정리 크론·IP 해시 24h, 위탁 = Supabase·Cloudflare·Sentry·GA4, 탈퇴 = `admin_delete_user`). 운영자 이름·연락 이메일은 사용자 값 자리
8. feat(auth): 로그인 시트 캡션 + 내 활동 시트 하단 링크
9. feat(analytics): GA4(`NEXT_PUBLIC_GA_ID`, 없으면 스크립트 없음) + Cloudflare Web Analytics 배선. GA4 내부 트래픽 제외(runbook 4-1)
10. ci: keepalive 실패 → 디스코드 스텝(`DISCORD_WEBHOOK_URL` 재사용) — **발화 검증**: 일부러 실패시킨 수동 실행으로 메시지 1건
11. feat(seo): 소유 확인 메타(`metadata.verification`) — 사용자가 콘솔에서 코드를 받아 오면(공개값)
12. docs: roadmap Phase 7 줄 정정(D3·D4 런칭 후) + runbook(HSTS 절차·분석·서치어드바이저 발화) + 갭 스윕·"## 결과"

배포 뒤 발화(검증 절): GA4 실시간 1건 · CF Analytics 대시보드 1건 · 콘솔 "소유 확인됨" 둘 · keepalive 디스코드 1건.

## 범위 밖 (이미 "런칭 뒤"로 정한 것 — roadmap 백로그)

워커 CPU 다이어트(1~2주 실측 뒤 판단, decisions 2026-09-18) · 급증 디스코드 알림 · 구글 로그인 · 시즌 스탬프 · [새로 들어온 집] 필터 재검토 · 1024 경계 리센터 · 앱(TWA/Capacitor) · 사이즈 판독기.
