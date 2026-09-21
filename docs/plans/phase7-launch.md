# Phase 7 — 런칭 준비 (roadmap Phase 7 · spec 4.6·8·9)

**상태: 초안(2026-09-21) — 승인 전.** "결정" 표의 답이 와야 "변경"·"커밋 단위"가 확정된다. 그 전까지 이 문서는 **런칭 전 남은 일 전수 목록**으로 쓴다.

## Context

Phase 6 코드는 끝났고(2026-09-16) prod(`새우맵.kr`)가 실 DB로 돈다. 2026-09-21에 Workers Paid 한도 적용(재배포)·workers.dev 복구·Always Use HTTPS까지 닫았다. 이 문서는 roadmap(Phase 6 마지막 줄·백로그·Phase 7) · `phase6-backend.md` "결과"의 이월 · decisions 2026-09-16~21 · runbook · spec 8·9장을 읽어 **런칭 전에 남은 것을 한곳에** 모은 것이다.

조사 시점 prod 실측(2026-09-21 21시 KST): 홈·`sitemap.xml`(URL 793)·`robots.txt` 200, TTFB 2~3.5초(콜드 + LAX 경유), `cf-placement: local-LAX`, `http://` → 301.

## 0. Phase 6 닫기 (코드 0 — 실측·확인만)

| # | 할 일 | 누가 | 상태 |
|---|---|---|---|
| ~~0-0~~ | ~~prod 카카오 로그인 불가~~ — GoTrue가 scope에 `account_email`을 고정 → 카카오 앱에 동의항목이 없어 KOE205. **개인 개발자 비즈 앱 전환 + 이메일 선택 동의**로 해결, 코드·배포 변경 0 (decisions 2026-09-21). 병합·리뷰·탈퇴는 0-2에서 | 사용자(콘솔) | 완료 2026-09-21 (사용자 로그인 확인) |
| 0-1 | `docs/keepalive-verify` 브랜치 push → 문서 PR → CI 통과 후 셀프 머지 | 내가(push는 사용자 승인) | 대기 |
| 0-2 | **prod 폰 머니패스**: 확인·찜·제보(사진)·수정 제안·신고 → 카카오 로그인 → 리뷰 작성·삭제 → 익명→카카오 병합 → 탈퇴. 첫 쓰기의 Turnstile 지연도 같이 본다(프리뷰 헤드리스에서 첫 POST 6초+, decisions 2026-09-21) | 사용자(폰) + 내가(`wrangler tail`·DB 대조) | **일부 완료 2026-09-21**: 찜 → 카카오 로그인 → 병합(찜 유지) → 탈퇴(DB에서 유저·아이덴티티·프로필·찜 0 확인, decisions 같은 날). **남음**: 확인·제보(사진)·수정 제안·신고 · 리뷰 작성·삭제 · 첫 쓰기 지연 |
| 0-3 | prod 관리자: 카카오 로그인 뒤 `profiles.is_admin = true`(runbook 2-2) → `/admin` 5탭 실사용 → 디스코드 **실채널** 알림 발화 | 같이 | 기록 없음 |
| 0-4 | ~~프리뷰 읽기 전용 발화~~ | 내가 | 완료 2026-09-21 (`read only` → 토스트 → 롤백) |
| 0-5 | 검수 대기 27곳 — 관리자 [검수 대기] 칩 → 30초 보고 [복구] (runbook 3b) | 사용자 | 미착수 |
| 0-6 | Smart Placement가 `remote-…`로 옮겼는지 재확인(지금 `local-LAX`). 트래픽 부족이면 `INSUFFICIENT_INVOCATIONS` | 내가 | 2026-09-22 이후 |
| 0-7 | Sentry UI 정리: MAP-1 resolve · MAP-2 archive · MAP-4 resolve (토큰이 읽기 전용) | 사용자 | 미착수 |
| 0-8 | roadmap Phase 6 "사용자 콘솔 작업" 줄 체크 + 완료 줄 갱신 | 내가 | 0-2·0-3 뒤 |

0-2에서 버그가 나오면 그게 Phase 7의 어떤 항목보다 먼저다.

## 결정 (권고 — 사용자 답 필요)

| # | 질문 | 권고 | 근거 |
|---|---|---|---|
| D1 | 개인정보처리방침 페이지 | 만든다 — 정적 `/privacy` | 지금 `app/`에 없다. GA와 무관하게 카카오 닉네임·프로필 사진 + **이메일(선택 동의, 2026-09-21)** 을 받는다. 분석 켜기의 선행 조건(roadmap, decisions 2026-09-08). 본문 초안은 내가(수집 항목 = 컬럼 GRANT, 보관 = 익명 정리 크론·IP 해시 24h, 위탁 = Supabase·Cloudflare·Sentry(+GA4), 탈퇴 = `admin_delete_user`), 운영자 표시(이름·연락 이메일)는 사용자 |
| D1b | 서비스 이용약관 | 만든다 — 정적 `/terms`, `/privacy`와 같은 레이아웃 | 법적 의무는 아니지만 UGC(리뷰·사진·제보)를 받는다: 게시 허락 · 삭제·숨김·제한 권한 · 제보 기반 정보의 정확성 면책 · 사장님 요청 처리(spec 3) · 금지 행위. **법률 검토가 아니라 판단** |
| D1c | 약관·방침 링크 자리와 동의 방식 | 로그인 시트 [카카오로 시작하기] 아래 캡션 한 줄("시작하면 이용약관·개인정보처리방침에 동의하게 됩니다") + 내 활동 시트 하단. 익명 쓰기는 체크박스 없이 "이용 시 동의" | 지도 앱이라 푸터가 없고 design.md에 자리가 없다(미정). 체크박스는 제보 플로우를 무겁게 한다 |
| D2 | 동의 배너 | 없이 가고 방침에 쿠키·GA4 고지 | 국내 서비스 관행. **법률 검토가 아니라 판단이다** — 사용자 확인 필요 |
| D3 | 축제 페이지 | 런칭 후로(roadmap Phase 7 줄 정정) | spec 8은 "런칭 후", roadmap은 Phase 7 — 어긋나 있다 |
| D4 | `/test` 참여자 수·유형 비율 화면 | 런칭 후 | RPC는 Phase 6에 있다. 0명에서 시작하는 숫자는 역효과 — 노출 하한(예: 수백 명)을 정한 뒤 |
| D5 | 라이브 피드(spec 8 "런칭에 포함") | 결정 아님 — 갭 스윕에서 구현 여부 확정 | 관련 코드가 `lib/map-screen-data.ts`·`lib/server/actions.ts`에 보이나 화면까지 미확인. roadmap Phase 7 줄엔 없다 |
| D6 | HSTS | 켠다, 짧은 `max-age`부터 | decisions 2026-09-21 "따로 정한다(미정)" |
| D7 | keepalive 실패 알림 | 워크플로 실패 시 디스코드 한 스텝 | 나흘 빨강을 월간 점검이 못 잡았다(decisions 2026-09-21, 미정) |
| D8 | `www` 리다이렉트 | 계속 보류 | runbook 3d "치는 사람이 거의 없어 보류" |
| D9 | 구글 서치 콘솔도 등록? | 한다(네이버와 같은 작업) | spec 4.6은 네이버만 적었다 |
| D10 | **런칭일** | — | 역산 기준. spec 9의 나머지(SNS 채널·10월 말 판단 숫자·태그라인)는 런칭 글 전까지 |

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
- 로컬 `[gone]` 브랜치 8개 정리(`/clean_gone`) — 사소

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
| 리뷰 백로그: 액션 단위 테스트 | 남음 | |
| Sentry 소스맵 | 남음 | |
| 보안 ② `author_id` | 남음 — **플랜보다 크다**: `grant select on public.reviews`가 표 전체라 뷰만 바꿔선 그대로 노출된다. 컬럼 GRANT 회수 + 목록을 DEFINER RPC로 + "내 리뷰" 판정을 uid 비교에서 사용자별 읽기로(상세는 anon 공유 캐시라 `is_mine`을 캐시에 실을 수 없다) + `reviews`를 직접 읽는 액션 2곳 | |
| 보안 ① captcha 구조 변경 | 남음 | |

수치: pgTAP 99 → **120**(9 파일) · vitest 560 → **563** · advisors 0. **마이그레이션 2개는 머지 뒤 `supabase db push`(사용자 승인)로 prod에 올린다** — CI가 하지 않는다(runbook 3).

## 커밋 단위 (초안 — 한 턴 = 한 커밋)

1. docs: 이 플랜 확정 + roadmap Phase 7 줄 정정(D3·D4) + decisions 기록
2. db: 보안 ②③ (마이그레이션 + pgTAP)
3. feat(server): 보안 ④ hostname 검증
4. feat(auth): 보안 ① captcha 구조 변경
5. fix/test: 리뷰 백로그 4건
6. feat(seo): 소유 확인 메타
7. feat: `/privacy`·`/terms` + 링크 자리 · 분석 배선(둘로 나눌 수 있다)
8. ci: 소스맵 · keepalive 알림
9. docs: 갭 스윕·보안 리뷰 반영 + "## 결과"

## 범위 밖 (이미 "런칭 뒤"로 정한 것 — roadmap 백로그)

워커 CPU 다이어트(1~2주 실측 뒤 판단, decisions 2026-09-18) · 급증 디스코드 알림 · 구글 로그인 · 시즌 스탬프 · [새로 들어온 집] 필터 재검토 · 1024 경계 리센터 · 앱(TWA/Capacitor) · 사이즈 판독기.
