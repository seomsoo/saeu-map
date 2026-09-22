# 새우맵 운영 runbook (Phase 6 초안 — 커밋마다 채운다)

이 문서는 두 사람을 위한 것이다. **지금의 운영자**(새우맵을 세우고 유지한다)와 **시리즈의 두 번째 맵을 세우는 사람**(굴맵·대방어맵 — 이 순서를 그대로 따라가면 같은 백엔드가 선다). 결정의 근거는 docs/decisions.md 2026-09-10, 설계는 docs/plans/phase6-backend.md.

## 0. 부품 한 장

| 부품 | 무엇 | 어디 | 비용 |
|---|---|---|---|
| 앱(워커) | Next.js + OpenNext | Cloudflare Workers **Paid($5/월, 2026-09-18 결정 · 2026-09-21 결제·재배포 뒤 503 0 확인)**. **플랜을 바꾸면 재배포해야 한도가 적용된다** — CPU 한도는 배포된 버전에 붙는다(decisions 2026-09-21) | 월 1,000만 요청(초과 100만당 $0.30) + **월 CPU 3,000만 ms**(초과 100만 ms당 $0.02) 포함, 요청당 CPU 30초. 먼저 닿는 건 CPU다 — 홈 한 번이 CPU ~210ms(p50, 2026-09-18 실측)라 3,000만 ms ≈ 홈 14만 회, 그 뒤는 홈 100만 회당 ~$4.5(CPU $4.2 + 요청 $0.3). Free의 10ms에 콜드 스타트가 걸려 503이 났다(decisions 2026-09-18) |
| 도메인 | `새우맵.kr` = `xn--r02bv8jvof.kr`(퓨니코드) — 가비아 등록, 네임서버 Cloudflare(eric·gail), 워커 custom domain | 가비아 + Cloudflare Free | 연 2만 원 안팎 |
| 장부(DB·인증) | Postgres + GoTrue + PostgREST | Supabase **Free** 프로젝트 1개(prod) | 500MB · MAU 5만 · egress 5GB/월 |
| 사진 창고 | R2 `saeu-photos` | Cloudflare | 10GB · 읽기 1,000만/월 (캐시 버킷과 **합산**) |
| 캐시 | R2 `saeu-cache` + D1 `saeu-tags` | Cloudflare | D1 읽기 500만/일 |
| 이미지 변환 | Images 바인딩(업로드 시 1회) | Cloudflare | 5,000장/월, 우리 상한 4,500 |
| 사람 확인 | Turnstile 위젯 | Cloudflare | 무제한 |
| 문 앞 경비 | 속도 제한 바인딩 `WRITE_RATE_LIMITER`(IP당 60초 20번, wrangler.jsonc) | Cloudflare Workers | 무료 |
| 알림 | 디스코드 웹훅 | Discord | 무료 |
| 에러 | Sentry | sentry.io Free | 5,000건/월 |
| 로컬 개발 | Docker Supabase | 내 노트북 | 무료 |

## 1. 환경 변수

| 이름 | 공개/비밀 | 어디서 얻나 | 어디에 넣나 |
|---|---|---|---|
| `NEXT_PUBLIC_NCP_CLIENT_ID` | 공개 | NCP 콘솔 Maps | `.env` · GH variable(빌드에 박힌다) |
| `SUPABASE_URL` | 공개값이지만 서버 전용 | Supabase 대시보드 Project Settings → API / 로컬은 `supabase start` 출력 | `.env` · `.dev.vars` · **GH secret**(빌드의 OG 프리렌더용 — variable이면 로그에 찍힌다) · **워커 secret**(`wrangler secret put`, 런타임) |
| `SUPABASE_PUBLISHABLE_KEY` | 공개값이지만 서버 전용 | 같은 곳 API Keys(`sb_publishable_…`) | `.env` · `.dev.vars` · GH secret · 워커 secret(위와 같은 이유) |
| `SUPABASE_SECRET_KEY` | **비밀** | 같은 곳(`sb_secret_…`) | `.env` · `.dev.vars` · 워커 secret(프리뷰 버전은 워커 secret을 물려받지만 `PREVIEW_READONLY=1`이 모든 쓰기를 막는다) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | 공개 | Cloudflare → Turnstile → 위젯 | `.env` · GH variable(빌드에 박힌다) |
| `TURNSTILE_SECRET_KEY` | **비밀** | 같은 위젯 | `.env` · `.dev.vars` · 워커 secret(GH에는 없다 — 빌드는 더미로 t3-env 검증만 지난다) |
| `DISCORD_WEBHOOK_URL` | **비밀** | 디스코드 채널 설정 → 연동 → 웹훅 | `.env` · `.dev.vars` · 워커 secret |
| `IP_HASH_SALT` | **비밀** | 아무 긴 난수(`openssl rand -hex 32`) | `.env` · `.dev.vars` · 워커 secret(GH에는 없다, 빌드는 더미) |
| `PREVIEW_READONLY` | — | 프리뷰 워커만 `1` | ci.yml preview 잡의 `--var`(커밋 8) |
| `NEXT_PUBLIC_SENTRY_DSN` | 공개 | sentry.io 프로젝트 → Settings → Client Keys | `.env` · GH variable(빌드에 박힌다, 서버·브라우저 공용). 비우면 Sentry 꺼짐 |
| `SITE_URL` · `NEXT_PUBLIC_GA_ID` | 기존 | (변경 없음) | |

워커 secret은 `wrangler secret put <이름>`, GH는 `gh secret set <이름>` / `gh variable set <이름>`. 값은 채팅·커밋·문서에 절대 적지 않는다(훅이 막는다).

## 2. 사용자가 콘솔에서 하는 것 (한 번)

순서대로. 각 항목이 어느 커밋 전에 필요한지 적었다.

0. **R2 켜기** (커밋 8 배포 전) — dash.cloudflare.com → R2 Object Storage → 시작(무료 플랜, 결제 수단을 묻는 계정도 있다 — 무료 한도 안이면 청구 0). 켜진 뒤 내가 `wrangler r2 bucket create saeu-photos`·`saeu-cache`를 돌린다(그 전엔 API가 10042로 거부한다). D1 `saeu-tags`는 이미 만들었다.
1. **`supabase login`** (커밋 4 전) — 터미널에서 `! supabase login`을 치면 브라우저가 열리고 승인 한 번. 그 뒤 프로젝트 생성·연결·마이그레이션은 CLI로 내가 한다.
2. **카카오 개발자 앱** (커밋 4 전) — developers.kakao.com → 내 애플리케이션 → 추가. 앱 이름 "새우맵". 그 다음:
   - 앱 키 → **REST API 키**를 복사해 둔다(= client_id).
   - 카카오 로그인 → 활성화 ON, **Client Secret 생성 + "사용함"**(= client_secret).
   - 카카오 로그인 → Redirect URI에 `https://<프로젝트ref>.supabase.co/auth/v1/callback`과 `http://localhost:54321/auth/v1/callback` 둘 다.
   - **개인 개발자 비즈 앱으로 전환**(사업자등록번호 불필요): 프로필 → 계정 설정 → 본인인증 → [앱] > [일반] > [비즈니스 정보] > [개인 개발자 비즈 앱]. 이메일 동의항목을 쓰려면 필요하다.
   - 동의항목 → **닉네임·프로필 사진 필수 + 카카오계정(이메일) 선택 동의**. 이메일은 우리가 쓰지 않는다 — Supabase Auth가 인가 요청 scope에 `account_email`을 고정으로 넣어서(빼는 옵션 없음) 동의항목에 없으면 카카오가 **KOE205**로 로그인 전체를 막는다(2026-09-21 prod에서 겪음). 거부한 사용자는 Supabase 쪽 "Allow users without an email"(`email_optional = true`, 내가 켠다)이 받는다.
   - 플랫폼 → Web 사이트 도메인에 실서비스·프리뷰·`http://localhost:3000`.
   - 두 값을 `.env.local`에 `SUPABASE_AUTH_EXTERNAL_KAKAO_CLIENT_ID=`·`SUPABASE_AUTH_EXTERNAL_KAKAO_SECRET=`로 넣고 **"넣었다"고만 알려준다** — 로컬은 `supabase/config.toml`이 그 이름으로 읽고(`[auth.external.kakao] enabled = true`로 바꾼다), 실서비스는 내가 `supabase config push`로 올린다. 값은 채팅에 적지 않는다.
   - 로컬에서 처음 카카오로 로그인한 뒤 관리자로 만들기: `psql … -c "update public.profiles set is_admin = true where id = '<uid>'"` (uid는 Studio → Authentication → Users).
3. **Turnstile 위젯** (프리뷰 배포 전 — 로컬·CI는 Cloudflare 공개 더미 키를 쓴다: site `1x00000000000000000000BB`(보이지 않고 항상 통과)·secret `1x0000000000000000000000000000000AA`(항상 통과). 실패 경로를 보고 싶으면 secret을 `2x…AA`로) — dash.cloudflare.com → Turnstile → Add widget. 이름 "saeu-map", 호스트명에 `saeu-map.saeu-map.workers.dev`·`preview-saeu-map.saeu-map.workers.dev`·`localhost`. 모드 **Managed**(위젯은 우리가 `execute` 모드로 보이지 않게 돌린다). Site key·Secret key를 `.env`에.
4. **디스코드 웹훅** (커밋 7 전) — 알림 받을 채널 → 채널 편집 → 연동 → 웹훅 → 새 웹훅 → URL 복사 → `.env`의 `DISCORD_WEBHOOK_URL`.
   - 로컬에서 본문만 확인하려면 가짜 수신기: `python3 -m http.server 9999`는 POST를 501로 거부하니 `DISCORD_WEBHOOK_URL=http://127.0.0.1:9999/hook` + 아래 한 줄짜리 수신기(`python3 -c "...HTTPServer..."`, 커밋 7 실측)로 본다. 본문엔 연락처가 없어야 한다.
5. **Sentry 프로젝트** (PR 전) — sentry.io → Create Project → Next.js → Settings → Client Keys(DSN) 복사 → `.env`와 `gh variable set NEXT_PUBLIC_SENTRY_DSN --body <DSN>`(공개값). Settings → Security & Privacy → **Allowed Domains**에 우리 호스트 둘(`saeu-map.saeu-map.workers.dev`·`preview-saeu-map.saeu-map.workers.dev`). 이벤트만 쓴다(트레이싱·리플레이 꺼짐, 무료 5k/월).
   - **소스맵 업로드 토큰**(Phase 7, 한 번): sentry.io → Settings → Developer Settings → **Organization Tokens** → Create(이름 "saeu-map ci", 권한은 기본 `org:ci` — 업로드 전용) → 터미널에서 `! gh secret set SENTRY_UPLOAD_TOKEN`에 붙여 넣는다(채팅에 적지 않는다). 다음 main 배포부터 `deploy` 잡이 브라우저 소스맵을 올리고 .map은 지운다(`next.config.ts`). 없으면 업로드만 꺼진 채 배포된다. `.env.local`의 `SENTRY_AUTH_TOKEN`(읽기 전용 점검용)과는 다른 토큰이다. 발화 검증: 배포 로그의 업로드 줄 + 새 이슈의 스택에 원본 파일명(`components/…tsx`).
   - 발화 검증: 프리뷰 배포 뒤 임시 throw 1건이 sentry.io에 뜨면 끝(decisions 2026-09-10 #6 — 안 뜨면 Phase 7로). 로컬은 가짜 수신기로 봉투(envelope)가 오는 것까지 확인했다(커밋 9).
6. **런칭 주 콘솔 4건** (Phase 7, decisions 2026-09-22 — 전부 코드 0이거나 공개값 하나):
   - **GA4** — analytics.google.com → 속성 만들기(웹, `새우맵.kr`) → 측정 ID `G-…` → `! gh variable set NEXT_PUBLIC_GA_ID --body G-…`(공개값, 허용 목록 안). 코드는 이미 있다(`components/analytics/google-analytics.tsx` — 변수 없으면 미삽입, `/admin` 제외). 관리 → 데이터 스트림 → 태그 설정 → **내부 트래픽 정의**에 집 IP를 넣고 필터를 "활성"으로(4절 1). 발화: 다음 main 배포 뒤 실시간 보고서에 1건.
   - **Cloudflare Web Analytics** — dash.cloudflare.com → Analytics & Logs → Web Analytics → Add a site → 호스트명 드롭다운에서 `새우맵.kr` 선택(**자동 설정** — 프록시된 zone이라 엣지가 비컨을 넣는다. 우리 HTML 응답에 `no-transform`이 없어 조건을 만족한다, 2026-09-22 확인). 코드 0. 발화: `curl -s https://xn--r02bv8jvof.kr/ | grep -c cloudflareinsights`가 1.
   - **HSTS** (D6) — dash → 새우맵.kr → SSL/TLS → Edge Certificates → HTTP Strict Transport Security → Enable HSTS: **Max Age 1일(86400)**, Apply to subdomains 끔, **Preload 끔**(되돌릴 수 없다). 한 달 문제 없으면 6개월. 발화: `curl -sI https://xn--r02bv8jvof.kr/ | grep -i strict-transport`.
   - **서치어드바이저** (D9, 네이버 + 구글) — searchadvisor.naver.com → 웹마스터 도구 → 사이트 등록 `https://새우맵.kr` → 소유확인 **HTML 태그** 방식의 `content` 값을 복사 / search.google.com/search-console → URL 접두어 → **HTML 태그**의 `content` 값. 둘 다 공개값이라 **채팅에 그대로 적어 주면** 내가 `app/layout.tsx` `metadata.verification`에 넣는다(커밋 11). 배포 뒤 콘솔에서 [소유확인] → 사이트맵 제출 `https://새우맵.kr/sitemap.xml`. 발화: 두 콘솔의 "소유 확인됨".

## 3. 내가 CLI로 하는 것

로컬은 `pnpm db:start`(Docker Supabase) → `pnpm db:reset`(마이그레이션 + seed) → `pnpm db:test`(pgTAP) → `pnpm db:advisors`(0건). Studio는 http://127.0.0.1:54323.
워커 런타임 확인은 `npx opennextjs-cloudflare build && npx opennextjs-cloudflare populateCache local && npx wrangler dev --port 8787 --compatibility-flags nodejs_compat` — 마지막 플래그는 `global_fetch_strictly_public`을 빼서 워커가 127.0.0.1의 로컬 Supabase를 부를 수 있게 한다(실서비스 설정은 그대로). 런타임 변수는 `.dev.vars`(gitignore).

```
# Cloudflare (wrangler 로그인 확인됨 2026-09-10)
wrangler r2 bucket create saeu-photos     # 2026-09-17 완료(R2 구독 추가 뒤) — saeu-cache도
wrangler r2 bucket create saeu-cache
wrangler d1 create saeu-tags              # 2026-09-10 완료
wrangler secret put SUPABASE_URL          # 런타임 값은 전부 secret — URL·publishable도(로그에 안 찍히게, 최종 보안 리뷰 #3)
wrangler secret put SUPABASE_PUBLISHABLE_KEY
wrangler secret put SUPABASE_SECRET_KEY   # TURNSTILE_SECRET_KEY · IP_HASH_SALT · DISCORD_WEBHOOK_URL도 같은 방법
# Supabase
# 2026-09-16 완료: 조직 saeu-map(smzmkuvlzouhlpybhzli) · 프로젝트 saeu-map(ref dnwkyobizphuacqvfseh, ap-northeast-2) · link · db push · 시드 789 임포트 · GH/워커 secret.
# 실서비스 키는 로컬 파일에 두지 않는다 — 필요하면 `supabase projects api-keys --project-ref dnwkyobizphuacqvfseh --reveal --output-format json | python3 -c … | wrangler secret put …`처럼 파이프로만.
# DB 비밀번호는 .env.local의 SUPABASE_DB_PASSWORD(gitignore) — 잃으면 대시보드 Database → Reset password
supabase link --project-ref dnwkyobizphuacqvfseh -p "$SUPABASE_DB_PASSWORD"
supabase db push                          # 마이그레이션
set -a; . ./.env.local; set +a; supabase config push --yes   # 2026-09-17 완료. 카카오 키는 config.toml의 env() 플레이스홀더라 .env.local을 셸 env로 올린 채 실행한다. 먼저 `supabase config diff`
# GitHub
gh secret set SUPABASE_URL --body …       # 빌드(OG 프리렌더)용. publishable도 secret으로 — variable은 wrangler가 40자까지 로그에 찍는다
gh secret set SUPABASE_PUBLISHABLE_KEY --body …
gh variable set NEXT_PUBLIC_NCP_CLIENT_ID --body …   # NEXT_PUBLIC_TURNSTILE_SITE_KEY · NEXT_PUBLIC_SENTRY_DSN도
```

## 3c. CI가 하는 것 (`.github/workflows/ci.yml`, 커밋 8)

| 잡 | 언제 | 하는 일 | 필요한 GitHub 값 |
|---|---|---|---|
| `db` | PR·main push | 로컬 Supabase(`supabase start -x …`, CLI 2.117.0 고정) → `supabase test db`(pgTAP) → `gen types` diff(`lib/db/database.types.ts`가 최신인지) → `db advisors` 0건 | 없음 |
| `check` | PR·main push | typecheck·lint·vitest·gitleaks → **로컬 Supabase를 상대로** OpenNext 빌드(OG 프리렌더가 DB를 읽는다) → `scripts/smoke.sh`(workerd + 실 DB: /·/place/uuid·404·/gu·sitemap·robots·og) → Lighthouse(스모크가 고른 가게) | 없음(Turnstile 테스트 키·CI 상수 salt) |
| `preview` | PR | `check`·`db` 통과 후 프리뷰 버전 업로드. **`--var PREVIEW_READONLY:1`**. Supabase 값은 빌드엔 GH secret, 런타임엔 워커 secret(버전이 물려받는다) | secrets `CLOUDFLARE_API_TOKEN`·`CLOUDFLARE_ACCOUNT_ID`·`SUPABASE_URL`·`SUPABASE_PUBLISHABLE_KEY`, variables `NEXT_PUBLIC_NCP_CLIENT_ID`·`NEXT_PUBLIC_TURNSTILE_SITE_KEY`(·`NEXT_PUBLIC_SENTRY_DSN`) |
| `deploy` | main push | 같은 게이트로 prod 배포(`pnpm run deploy`). 런타임 값은 전부 워커 secret | 위와 같음 |
| `keepalive` | 매일 09:00 KST | `GET /` 한 번 — Supabase 무료 프로젝트가 7일 무활동으로 잠들지 않게. **리포에 60일간 커밋이 없으면 GitHub가 스케줄을 끈다**(Actions 탭에서 다시 켠다) | 없음 |

값이 하나라도 비면 preview·deploy는 실패하지 않고 `::notice`로 건너뛴다. 발화 검증(프리뷰에서 찜 → "읽기 전용" 토스트, 디스코드 알림 1건)은 첫 PR에서 한다(plan 3b).

로컬에서 스모크만 다시 보려면: `npx opennextjs-cloudflare build && npx opennextjs-cloudflare populateCache local && npx wrangler dev --port 8787 --compatibility-flags nodejs_compat &` 뒤 `DB_URL=$(supabase status -o env | grep ^DB_URL | cut -d'"' -f2) scripts/smoke.sh`.

## 3b. 시드 넣기 (한 번, 그리고 크롤을 다시 했을 때)

```
# 1) 크롤 CSV → 시드 JSON (수집일을 @로 준다 — "○일 전 확인"의 기준)
python3 scripts/convert_seed.py --out supabase/seed/places.json --report \
  ~/saewoo-map/saewoo_seoul.csv@2026-08-27 ~/saewoo-map/probe_busan.csv@2026-09-09 ~/saewoo-map/probe_gwangju.csv@2026-09-09
# 2) 역·출구 CSV (OSM, 서울·부산·광주. 캐시가 있으면 재질의 없음)
python3 scripts/add_nearest_station.py --cache .osm
# 3) DB에 넣기 — 이미 있는 seed_ref는 건드리지 않는다(사용자 수정 보존). 로컬은 supabase status -o env의 값
SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/import-seed.mjs            # --dry-run으로 먼저
# 4) 로컬·CI 샘플 seed.sql 재생성(가게 60 + 근처 역)
python3 scripts/convert_seed.py --out /tmp/sample.json --sample 60 <같은 입력…>
node scripts/gen-seed.mjs /tmp/sample.json --exits supabase/seed/subway_exits.csv > supabase/seed.sql
```

검수 필요(`needs_review`)로 들어간 가게는 `hidden_at`이 찍혀 지도에 안 보인다. 관리자 검색 탭 [검수 대기] 칩에서 [가게 열기]로 30초 보고 [복구]하면 그 자리에서 지도에 뜨고 검수 표시도 내려간다(커밋 7). 안 살릴 건 그대로 두면 된다.

## 3d. 도메인을 붙이는 날 체크리스트 (커스텀 도메인 — 전부 "추가"지 "교체"가 아니다)

2026-09-17 `새우맵.kr`을 붙였다. 서비스마다 한글 표기(`새우맵.kr`)를 받으면 그걸, 안 받으면 퓨니코드 **`xn--r02bv8jvof.kr`**을 넣는다(같은 주소). 프리뷰는 계속 `preview-saeu-map.saeu-map.workers.dev`. 다음 도메인이 생기면 **같은 날** 아래를 전부 더한다 — 하나라도 빠지면 그 기능만 조용히 죽는다(쓰기 "잠시 후 다시", 지도 401, 로그인 실패).

| 어디 | 무엇 | 안 하면 |
|---|---|---|
| Cloudflare → Turnstile → 위젯 `saeu-map` → Settings → Hostname management | 새 도메인 추가(키는 그대로) — 새우맵.kr ✅ 2026-09-17 | 모든 쓰기가 "bot check failed" |
| Supabase `supabase/config.toml` `additional_redirect_urls` + `supabase config push` (내가) | `https://<도메인>/**` 추가 — 새우맵.kr ✅ 2026-09-17 | 카카오 로그인 뒤 콜백 거부 |
| 카카오 개발자 앱 → 플랫폼 → Web 사이트 도메인 | 새 도메인 추가(리다이렉트 URI는 Supabase 주소라 그대로) — ✅ 2026-09-17 | 카카오가 검사하는 건 리다이렉트 URI라 당장은 안 막히지만 정책상 등록 |
| NCP 콘솔 → Maps → 서비스 URL | 새 도메인 추가 — ✅ 2026-09-17 | 지도가 401로 안 뜸 |
| Sentry → Settings → Security & Privacy → Allowed Domains | 새 도메인 추가 — ✅ 2026-09-17 | 브라우저 에러가 안 들어옴 |
| `wrangler.jsonc` `vars.SITE_URL` + `routes[custom_domain]`, `lib/seo.ts` SITE_HOST/표시명 (내가) | 새 도메인 — 새우맵.kr ✅ 2026-09-17(첫 배포 때 DNS·인증서 자동) | OG·sitemap·공유 링크가 옛 주소 |
| 첫 배포 **뒤** `curl -so /dev/null -w '%{http_code}'`로 세 주소(새 도메인·`saeu-map.saeu-map.workers.dev`·프리뷰 별칭) + Actions → `keepalive` 수동 실행 (내가) | 전부 200·초록. `routes`를 넣으면 wrangler가 `workers_dev`·`preview_urls`를 꺼 버린다 — `wrangler.jsonc`에 둘 다 `true`로 적혀 있는지(2026-09-21) | 프리뷰 별칭 404, keepalive가 조용히 빨강(2026-09-18~21 나흘) |
| Cloudflare → 새 도메인 → SSL/TLS → Edge Certificates → **Always Use HTTPS** 켜기 (사용자, 대시보드) — 새우맵.kr ✅ 2026-09-21(빠져 있던 걸 Sentry 점검에서 발견, 켠 뒤 301 확인) | `curl -sI http://<도메인>/`이 301 → https여야 한다. `.dev`는 TLD 전체가 HSTS preload라 브라우저가 늘 https로 가지만 커스텀 도메인은 zone 설정을 따른다 | `http://`로 치고 들어온 사람은 평문으로 200을 받는다 — 내 위치(geolocation)·공유·복사가 안 되고 세션 쿠키가 평문으로 오간다 |
| Cloudflare → 새우맵.kr → Rules → Redirect Rules (선택) | `www.새우맵.kr/*` → `https://새우맵.kr/$1` 301 | www로 치면 안 열림(치는 사람이 거의 없어 보류) |

Turnstile site key(공개값)는 GH variable `NEXT_PUBLIC_TURNSTILE_SITE_KEY`에, secret은 워커 secret과 Turnstile 대시보드에만 있다(로컬 `.env.local`은 테스트 키).

## 4. 공개값 네 가지 습관

브라우저로 나가는 값(규칙 7 목록)은 "열쇠"가 아니라 "명찰"이다. 그래도:
1. 콘솔에서 **도메인·URL로 묶는다** — NCP 서비스 URL, 카카오 플랫폼 도메인, Turnstile 호스트명, Sentry Allowed Domains, GA4 내부 트래픽 제외.
2. **사용량 알림**을 건다 — NCP 월 400만(이미), Images 알림(Cloudflare Notifications, 전 플랜), Supabase 대시보드 Usage.
3. **비밀 키는 절대 섞지 않는다** — `NEXT_PUBLIC_` 접두사를 붙이는 순간 브라우저 파일에 박힌다.
4. **비밀 키가 새면 즉시 교체** — Supabase API Keys에서 secret 재발급 → `wrangler secret put` → `gh secret set`. 디스코드 웹훅은 삭제 후 재생성. IP salt는 아무 값으로 교체(24시간 뒤 옛 해시는 어차피 지워진다).

## 5. 월 1회 점검 (5분)

- Cloudflare → R2: 두 버킷 저장량·Class A/B 횟수(합산 10GB · 100만 · 1,000만).
- Cloudflare → Images: 이번 달 변환 수(5,000 상한, 앱 상한 4,500).
- Cloudflare → Workers: 이번 달 요청 수·**CPU ms**(포함 1,000만 · 3,000만 ms — CPU가 먼저 닿는다)와 `exceededResources`(503) 건수. Paid에서는 0이어야 한다(decisions 2026-09-21).
- Supabase → Usage: DB 크기(500MB)·MAU(5만)·egress(5GB).
- Sentry: 미해결 이슈.
- GitHub → Actions: `keepalive`가 매일 초록인지(60일 무커밋이면 꺼진다).

## 6. 나중에 슬롯이 나면 — staging 붙이기

Supabase 무료는 계정당 활성 2개. 다른 프로젝트를 정리하거나 유료로 가면: 프로젝트 하나 더 → `supabase link` 별도 ref → 마이그레이션·시드(샘플) → 카카오 Redirect URI 추가 → ci.yml `preview` 잡의 `SUPABASE_URL`·키를 staging 값으로, `PREVIEW_READONLY` 제거.

## 7. 두 번째 맵(시리즈)을 세울 때

1. 리포를 템플릿으로 fork. `lib/types.ts`·`lib/places.ts`의 카테고리·사이드·라벨, `lib/content/*.json`, 마이그레이션 `0001` 맨 위 CHECK 상수(태그·사이드 값)를 바꾼다.
2. 위 1~3절을 그대로(프로젝트·앱·위젯·웹훅은 맵마다 따로).
3. 시드는 `scripts/convert_seed.py` 입력 CSV만 바꾼다.
