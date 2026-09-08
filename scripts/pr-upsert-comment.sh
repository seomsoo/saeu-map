#!/usr/bin/env bash
# PR 코멘트 upsert — 본문 **첫 줄의 표식**(HTML 주석)으로 기존 코멘트를 찾아 갱신하고, 없으면 만든다.
#
# `gh pr comment --edit-last`를 쓰지 않는 이유: 이 리포는 한 PR에 봇 코멘트가 둘이다(프리뷰 URL·Lighthouse 점수).
# "마지막 것"을 고치면 서로를 덮어쓴다 (2026-09-08 — Lighthouse 코멘트를 들이면서 드러났다).
#
# 사용: scripts/pr-upsert-comment.sh <PR 번호> <본문 파일>   (env: GH_TOKEN, REPO)
set -euo pipefail

pr=$1
body=$2
marker=$(head -1 "$body")
case "$marker" in
  "<!--"*"-->") ;;
  *) echo "::error::본문 첫 줄이 표식(<!-- ... -->)이 아니다: $marker"; exit 1 ;;
esac

# head -1을 파이프로 물리면 pipefail + SIGPIPE로 잡이 죽는다 — 변수에 받아 자른다
ids=$(gh api "repos/$REPO/issues/$pr/comments" --paginate \
  --jq ".[] | select(.body | startswith(\"$marker\")) | .id") || ids=""
id=$(printf '%s\n' "$ids" | head -1)

if [ -n "$id" ]; then
  gh api -X PATCH "repos/$REPO/issues/comments/$id" -F body=@"$body" >/dev/null
  echo "updated comment $id"
else
  gh api -X POST "repos/$REPO/issues/$pr/comments" -F body=@"$body" >/dev/null
  echo "created comment"
fi
