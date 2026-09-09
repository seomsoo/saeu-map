# 새우맵 운영 runbook (Phase 6 초안 — 커밋마다 채운다)

이 문서는 두 사람을 위한 것이다. **지금의 운영자**(새우맵을 세우고 유지한다)와 **시리즈의 두 번째 맵을 세우는 사람**(굴맵·대방어맵 — 이 순서를 그대로 따라가면 같은 백엔드가 선다). 결정의 근거는 docs/decisions.md 2026-09-10, 설계는 docs/plans/phase6-backend.md.

## 0. 부품 한 장

| 부품 | 무엇 | 어디 | 비용 |
|---|---|---|---|
| 앱(워커) | Next.js + OpenNext | Cloudflare Workers **Free** | 하루 10만 요청, 초과는 에러(과금 없음) |
| 장부(DB·인증) | Postgres + GoTrue + PostgREST | Supabase **Free** 프로젝트 1개(prod) | 500MB · MAU 5만 · egress 5GB/월 |
| 사진 창고 | R2 `saeu-photos` | Cloudflare | 10GB · 읽기 1,000만/월 (캐시 버킷과 **합산**) |
| 캐시 | R2 `saeu-cache` + D1 `saeu-tags` | Cloudflare | D1 읽기 500만/일 |
| 이미지 변환 | Images 바인딩(업로드 시 1회) | Cloudflare | 5,000장/월, 우리 상한 4,500 |
| 사람 확인 | Turnstile 위젯 | Cloudflare | 무제한 |
| 알림 | 디스코드 웹훅 | Discord | 무료 |
| 에러 | Sentry | sentry.io Free | 5,000건/월 |
| 로컬 개발 | Docker Supabase | 내 노트북 | 무료 |

## 1. 환경 변수

| 이름 | 공개/비밀 | 어디서 얻나 | 어디에 넣나 |
|---|---|---|---|
| `NEXT_PUBLIC_NCP_CLIENT_ID` | 공개 | NCP 콘솔 Maps | `.env` · GH variable · 워커 var |
| `SUPABASE_URL` | 공개값이지만 서버 전용 | Supabase 대시보드 Project Settings → API / 로컬은 `supabase start` 출력 | `.env` · GH variable · 워커 var |
| `SUPABASE_PUBLISHABLE_KEY` | 공개값이지만 서버 전용 | 같은 곳 API Keys(`sb_publishable_…`) | `.env` · GH variable · 워커 var |
| `SUPABASE_SECRET_KEY` | **비밀** | 같은 곳(`sb_secret_…`) | `.env` · GH secret · 워커 secret(**프리뷰 제외**) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | 공개 | Cloudflare → Turnstile → 위젯 | `.env` · GH variable |
| `TURNSTILE_SECRET_KEY` | **비밀** | 같은 위젯 | `.env` · GH secret · 워커 secret |
| `DISCORD_WEBHOOK_URL` | **비밀** | 디스코드 채널 설정 → 연동 → 웹훅 | `.env` · 워커 secret |
| `IP_HASH_SALT` | **비밀** | 아무 긴 난수(`openssl rand -hex 32`) | `.env` · 워커 secret |
| `PREVIEW_READONLY` | — | 프리뷰 워커만 `1` | ci.yml `--var` |
| `NEXT_PUBLIC_SENTRY_DSN` | 공개 | sentry.io 프로젝트 | `.env` · GH variable |
| `SITE_URL` · `NEXT_PUBLIC_GA_ID` | 기존 | (변경 없음) | |

워커 secret은 `wrangler secret put <이름>`, GH는 `gh secret set <이름>` / `gh variable set <이름>`. 값은 채팅·커밋·문서에 절대 적지 않는다(훅이 막는다).

## 2. 사용자가 콘솔에서 하는 것 (한 번)

순서대로. 각 항목이 어느 커밋 전에 필요한지 적었다.

1. **`supabase login`** (커밋 4 전) — 터미널에서 `! supabase login`을 치면 브라우저가 열리고 승인 한 번. 그 뒤 프로젝트 생성·연결·마이그레이션은 CLI로 내가 한다.
2. **카카오 개발자 앱** (커밋 4 전) — developers.kakao.com → 내 애플리케이션 → 추가. 앱 이름 "새우맵". 그 다음:
   - 앱 키 → **REST API 키**를 복사해 둔다(= client_id).
   - 카카오 로그인 → 활성화 ON, **Client Secret 생성 + "사용함"**(= client_secret).
   - 카카오 로그인 → Redirect URI에 `https://<프로젝트ref>.supabase.co/auth/v1/callback`과 `http://localhost:54321/auth/v1/callback` 둘 다.
   - 동의항목 → **닉네임·프로필 사진 필수**. 이메일은 받지 않는다(비즈 앱 전용이라) → Supabase 쪽에서 "Allow users without an email"을 내가 켠다.
   - 플랫폼 → Web 사이트 도메인에 실서비스·프리뷰·`http://localhost:3000`.
   - 두 값은 `.env`의 주석 없는 새 줄이 아니라 **나에게 "넣었다"고만 알려준다** — 내가 `supabase config push`로 올린다. (변수 이름은 커밋 4에서 정한다.)
3. **Turnstile 위젯** (커밋 5 전) — dash.cloudflare.com → Turnstile → Add widget. 이름 "saeu-map", 호스트명에 `saeu-map.saeu-map.workers.dev`·`preview-saeu-map.saeu-map.workers.dev`·`localhost`. 모드 **Managed**(위젯은 우리가 `execute` 모드로 보이지 않게 돌린다). Site key·Secret key를 `.env`에.
4. **디스코드 웹훅** (커밋 7 전) — 알림 받을 채널 → 채널 편집 → 연동 → 웹훅 → 새 웹훅 → URL 복사 → `.env`의 `DISCORD_WEBHOOK_URL`.
5. **Sentry 프로젝트** (커밋 9 전) — sentry.io → Create Project → Next.js. DSN을 `.env`에. Settings → Security & Privacy → **Allowed Domains**에 우리 호스트 둘.

## 3. 내가 CLI로 하는 것

로컬은 `pnpm db:start`(Docker Supabase) → `pnpm db:reset`(마이그레이션 + seed) → `pnpm db:test`(pgTAP) → `pnpm db:advisors`(0건). Studio는 http://127.0.0.1:54323.

```
# Cloudflare (wrangler 로그인 확인됨 2026-09-10)
wrangler r2 bucket create saeu-photos
wrangler r2 bucket create saeu-cache
wrangler d1 create saeu-tags
wrangler secret put SUPABASE_SECRET_KEY   # 등 비밀값
# Supabase
supabase projects create saeu-map --region ap-northeast-2 ...   # 정확한 플래그는 --help
supabase link --project-ref <ref>
supabase db push                          # 마이그레이션
supabase config push                      # 익명 로그인·카카오 공급자 설정
# GitHub
gh secret set SUPABASE_SECRET_KEY < …     # 값은 파일·stdin으로만
gh variable set SUPABASE_URL --body …
```

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

검수 필요(`needs_review`)로 들어간 가게는 `hidden_at`이 찍혀 지도에 안 보인다. 관리자 검색 탭 "검수 필요" 필터에서 [플레이스 열기]로 30초 보고 [복구]하면 그 자리에서 지도에 뜬다. 안 살릴 건 그대로 두면 된다.

## 4. 공개값 네 가지 습관

브라우저로 나가는 값(규칙 7 목록)은 "열쇠"가 아니라 "명찰"이다. 그래도:
1. 콘솔에서 **도메인·URL로 묶는다** — NCP 서비스 URL, 카카오 플랫폼 도메인, Turnstile 호스트명, Sentry Allowed Domains, GA4 내부 트래픽 제외.
2. **사용량 알림**을 건다 — NCP 월 400만(이미), Images 알림(Cloudflare Notifications, 전 플랜), Supabase 대시보드 Usage.
3. **비밀 키는 절대 섞지 않는다** — `NEXT_PUBLIC_` 접두사를 붙이는 순간 브라우저 파일에 박힌다.
4. **비밀 키가 새면 즉시 교체** — Supabase API Keys에서 secret 재발급 → `wrangler secret put` → `gh secret set`. 디스코드 웹훅은 삭제 후 재생성. IP salt는 아무 값으로 교체(24시간 뒤 옛 해시는 어차피 지워진다).

## 5. 월 1회 점검 (5분)

- Cloudflare → R2: 두 버킷 저장량·Class A/B 횟수(합산 10GB · 100만 · 1,000만).
- Cloudflare → Images: 이번 달 변환 수(5,000 상한, 앱 상한 4,500).
- Cloudflare → Workers: 일 요청 수 추이(10만 근접 = Paid $5 검토, decisions 2026-09-10).
- Supabase → Usage: DB 크기(500MB)·MAU(5만)·egress(5GB).
- Sentry: 미해결 이슈.

## 6. 나중에 슬롯이 나면 — staging 붙이기

Supabase 무료는 계정당 활성 2개. 다른 프로젝트를 정리하거나 유료로 가면: 프로젝트 하나 더 → `supabase link` 별도 ref → 마이그레이션·시드(샘플) → 카카오 Redirect URI 추가 → ci.yml `preview` 잡의 `SUPABASE_URL`·키를 staging 값으로, `PREVIEW_READONLY` 제거.

## 7. 두 번째 맵(시리즈)을 세울 때

1. 리포를 템플릿으로 fork. `lib/types.ts`·`lib/places.ts`의 카테고리·사이드·라벨, `lib/content/*.json`, 마이그레이션 `0001` 맨 위 CHECK 상수(태그·사이드 값)를 바꾼다.
2. 위 1~3절을 그대로(프로젝트·앱·위젯·웹훅은 맵마다 따로).
3. 시드는 `scripts/convert_seed.py` 입력 CSV만 바꾼다.
