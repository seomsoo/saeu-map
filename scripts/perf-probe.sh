#!/usr/bin/env bash
# 성능 프로브 — 같은 방법으로 전후를 잰다 (docs/plans/perf-diet.md "측정 프로토콜").
#   scripts/perf-probe.sh <origin> [--budget-js-kb N]
# curl + python3만 쓴다(로컬·CI 공통). 재는 것: 홈·상세 TTFB(5회 중앙값), 홈 HTML gzip/원본 바이트,
# RSC 페이로드 바이트, 홈 JS 청크 수·gzip 합, 폰트·사진 캐시 헤더.
# --budget-js-kb: 홈 JS gzip 합이 N KB를 넘으면 exit 1 (CI 회귀 가드). gzip은 여기서 직접 한다 — prod(brotli)·wrangler dev(무압축)를 같은 자로.
set -euo pipefail

# 전송 중 끊김(curl 56 등)이 표 전체를 삼키지 않게: 재시도 2회, 그래도 실패면 빈 값
CURL=(curl -s --retry 2 --retry-all-errors --max-time 60)

ORIGIN=${1:?usage: perf-probe.sh <origin> [--budget-js-kb N]}
ORIGIN=${ORIGIN%/}
BUDGET_KB=""
if [ "${2:-}" = "--budget-js-kb" ]; then BUDGET_KB=${3:?N}; fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

median() { sort -n | awk '{a[NR]=$1} END{print a[int((NR+1)/2)]}'; }
# 실패한 요청은 -w 값(0) 대신 99초로 — 중앙값을 아래로 끌지 않게
ttfb1() { local t; t=$("${CURL[@]}" -o /dev/null -w '%{time_starttransfer}' "$1") || t=99; echo "$t"; }
ttfb() { for _ in 1 2 3 4 5; do ttfb1 "$1"; done | median; }
# 받아서 gzip한 바이트 — 서버가 압축을 하든(prod brotli) 안 하든(wrangler dev) 같은 자로 잰다. 실패면 0
gz1() {
  local f="$WORK/body.$$"
  if "${CURL[@]}" --compressed -o "$f" "$1"; then gzip -c "$f" | wc -c | tr -d ' '; else echo 0; fi
  rm -f "$f"
}

# 상세 하나 — sitemap의 첫 가게(호스트는 SITE_URL이라 경로만 본다)
PLACE_PATH=$("${CURL[@]}" "$ORIGIN/sitemap.xml" | grep -o '/place/[a-f0-9-]\{36\}' | head -1 || true)

HOME_TTFB=$(ttfb "$ORIGIN/")
PLACE_TTFB="-"
[ -n "$PLACE_PATH" ] && PLACE_TTFB=$(ttfb "$ORIGIN$PLACE_PATH")

# 홈 HTML — 원본 바이트와 gzip 바이트
"${CURL[@]}" --compressed -o "$WORK/home.html" "$ORIGIN/" || : > "$WORK/home.html"
HOME_DECODED=$(wc -c < "$WORK/home.html" | tr -d ' ')
HOME_GZ=$(gzip -c "$WORK/home.html" | wc -c | tr -d ' ')

# RSC 페이로드(인라인 __next_f) 바이트 + 홈 스크립트 목록
RSC_BYTES=$(python3 - "$WORK/home.html" "$WORK/scripts.txt" <<'EOF'
import re, sys
html = open(sys.argv[1], encoding="utf-8").read()
print(sum(len(s.encode()) for s in re.findall(r"<script>self\.__next_f\.push\((.*?)\)</script>", html, re.S)))
with open(sys.argv[2], "w") as f:
    f.write("\n".join(re.findall(r'<script[^>]+src="(/_next/static/[^"]+\.js)"', html)))
EOF
)

JS_COUNT=0
JS_BYTES=0
while IFS= read -r src; do
  [ -z "$src" ] && continue
  n=$(gz1 "$ORIGIN$src")
  JS_COUNT=$((JS_COUNT + 1))
  JS_BYTES=$((JS_BYTES + n))
done < "$WORK/scripts.txt"

header() { "${CURL[@]}" -o /dev/null -D - "$1" | tr -d '\r' | grep -i "^$2:" | head -1 | cut -d' ' -f2- || true; }
FONT_CSS="$ORIGIN/fonts/pretendard/pretendardvariable-dynamic-subset.css"
WOFF=$("${CURL[@]}" "$FONT_CSS" | grep -o 'woff2-dynamic-subset/[^)]*\.woff2' | head -1 || true)
FONT_CACHE=$(header "$ORIGIN/fonts/pretendard/$WOFF" cache-control)

PHOTO_PATH=$(grep -o '/photos/[a-z]*/[a-f0-9-]\{36\}/[a-f0-9-]\{36\}\.webp' "$WORK/home.html" | head -1 || true)
PHOTO_LINE="(홈에 사진 없음)"
if [ -n "$PHOTO_PATH" ]; then
  PHOTO_LINE="$("${CURL[@]}" -o /dev/null -w '%{http_code}' "$ORIGIN$PHOTO_PATH" || true) · $(header "$ORIGIN$PHOTO_PATH" cache-control)"
fi

kb() { echo "$(( $1 / 1024 ))KB"; }
echo "| 항목 | 값 |"
echo "|---|---|"
echo "| 홈 TTFB (5회 중앙값) | ${HOME_TTFB}s |"
echo "| 상세 TTFB (5회 중앙값) | ${PLACE_TTFB}s \`${PLACE_PATH:-?}\` |"
echo "| 홈 HTML gzip / 원본 | $(kb "$HOME_GZ") / $(kb "$HOME_DECODED") |"
echo "| 홈 RSC 페이로드(원본) | $(kb "$RSC_BYTES") |"
echo "| 홈 JS 청크 수 / gzip 합 | $JS_COUNT / $(kb "$JS_BYTES") |"
echo "| 폰트 woff2 Cache-Control | ${FONT_CACHE:-?} |"
echo "| 사진 첫 장 상태 · Cache-Control | $PHOTO_LINE |"

if [ -n "$BUDGET_KB" ] && [ $((JS_BYTES / 1024)) -gt "$BUDGET_KB" ]; then
  echo "홈 JS gzip 합 $(kb "$JS_BYTES") > 예산 ${BUDGET_KB}KB" >&2
  exit 1
fi
