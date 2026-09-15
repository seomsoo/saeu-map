#!/usr/bin/env bash
# 워커 스모크 — 빌드된 워커가 workerd에서 기동하고 **실 DB(로컬 Supabase) 경로**로 페이지를 내는지 (decisions 2026-09-01 스모크 정의,
# Phase 6에서 목 id `p018` 대신 DB에서 뽑은 uuid로 — plan 결정 23). CI와 로컬이 같은 스크립트를 쓴다.
#
# 사용: DB_URL=postgresql://… scripts/smoke.sh [BASE]   (BASE 기본 http://localhost:8787 — wrangler dev를 먼저 띄운다)
# GITHUB_OUTPUT이 있으면 place_id를 내보낸다(Lighthouse가 같은 가게를 잰다).
set -euo pipefail

BASE=${1:-http://localhost:8787}
: "${DB_URL:?DB_URL이 필요하다 — supabase status -o env의 DB_URL}"

fail() {
  echo "::error::smoke failed — $1"
  [ -f wrangler.log ] && tail -50 wrangler.log
  exit 1
}

for _ in $(seq 1 30); do
  if curl -sf "$BASE/" -o smoke.html; then break; fi
  sleep 2
done
grep -q "새우맵" smoke.html 2>/dev/null || fail "worker did not serve /"
echo "smoke ok: / ($(wc -c < smoke.html) bytes)"

# 가게 하나 — 공개 뷰에서, HTML 이스케이프가 끼지 않는 상호로(&·<·>·따옴표 없음). 서울 구(…구, 괄호 없음)는 /gu 확인용
IFS='|' read -r PLACE_ID PLACE_NAME < <(psql "$DB_URL" -Atc "select id, name from places_public where name !~ '[&<>\"'']' order by name limit 1")
[ -n "${PLACE_ID:-}" ] || fail "no visible place in DB (seed missing?)"
IFS='|' read -r GU GU_NAME < <(psql "$DB_URL" -Atc "select gu, name from places_public where gu like '%구' and gu not like '%(%' and name !~ '[&<>\"'']' order by gu, name limit 1")
[ -n "${GU:-}" ] || fail "no Seoul-gu place in DB"
GU_ENC=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$GU")

# /place/[id]: 있는 가게는 상호 + og:title, 모르는 uuid·uuid 아닌 id는 HTTP 404 + not-found 카피 (decisions 2026-09-07)
curl -sf "$BASE/place/$PLACE_ID" -o smoke-place.html || fail "/place/$PLACE_ID not 200"
grep -q "$PLACE_NAME" smoke-place.html || fail "/place/$PLACE_ID did not render '$PLACE_NAME'"
grep -q "property=\"og:title\" content=\"$PLACE_NAME\"" smoke-place.html || fail "/place/$PLACE_ID og:title != '$PLACE_NAME'"
for bad in 00000000-0000-4000-8000-000000000000 nope; do
  code=$(curl -s -o smoke-404.html -w '%{http_code}' "$BASE/place/$bad")
  { [ "$code" = "404" ] && grep -q "가게를 찾을 수 없어요" smoke-404.html; } || fail "/place/$bad expected 404 + not-found copy, got $code"
done

# /gu/[name] SSR(상호가 HTML에), 비서울은 404, sitemap(가게·구)·robots
curl -sf "$BASE/gu/$GU_ENC" -o smoke-gu.html || fail "/gu/$GU not 200"
{ grep -q "$GU 새우구이" smoke-gu.html && grep -q "$GU_NAME" smoke-gu.html; } || fail "/gu/$GU did not SSR the gu list ('$GU_NAME')"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/gu/nope")
[ "$code" = "404" ] || fail "/gu/nope expected 404, got $code"
curl -sf "$BASE/sitemap.xml" -o smoke-sitemap.xml || fail "sitemap.xml not 200"
{ grep -q "/gu/" smoke-sitemap.xml && grep -q "/place/$PLACE_ID" smoke-sitemap.xml; } || fail "sitemap.xml missing gu or place entries"
curl -sf "$BASE/robots.txt" | grep -q "sitemap.xml" || fail "robots.txt missing sitemap"

# next/og 카드 — 동적 세그먼트의 이미지 URL은 해시 쿼리가 붙으므로 페이지의 og:image에서 읽는다
for page in / "/place/$PLACE_ID" "/gu/$GU_ENC"; do
  og=$(curl -s "$BASE$page" | grep -o 'property="og:image" content="[^"]*"' | head -1 | sed 's/.*content="//; s/"$//' | sed -E 's|^https?://[^/]+||')
  type=$(curl -s -o /dev/null -w '%{content_type}' "$BASE$og")
  case "$type" in image/png*) ;; *) fail "og:image for $page ($og) returned $type" ;; esac
done

echo "smoke ok: /place/$PLACE_ID($PLACE_NAME, +og) · 404 ×2 · /gu/$GU · /gu/nope 404 · sitemap · robots · og 3종"
if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "place_id=$PLACE_ID" >> "$GITHUB_OUTPUT"; fi
