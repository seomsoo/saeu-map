# AGENTS.md — 새우맵

전체 스펙은 docs/spec.md, 개발 규칙은 CLAUDE.md 참조. 이 파일은 코드 리뷰 기준용이다.

## Code Review Rules

### 원칙
- correctness에 영향 있는 것만 지적하라. 스타일·취향·네이밍 코멘트 금지.
- 이미 존재하던 문제(pre-existing)는 지적하지 마라. 이번 diff가 만든 것만.

### 데이터 경계
- 컴포넌트에서 데이터 직접 접근(fetch, DB 클라이언트 호출) 금지 — 모든 데이터는 lib/data.ts 경유.
- 네이버·카카오 API 응답을 파일·DB·Place·전역 상태에 저장하는 코드 금지. 화면에 그리는 동안만 드는 컴포넌트 임시 상태(주소 검색 제안 목록)는 허용 — 닫히면 버리고, 남기는 건 사용자가 확정한 값(핀 좌표)뿐(decisions 2026-09-04).
- 외부 이미지 도메인(pstatic.net, kakaocdn 등) 사용 금지.
- localStorage/sessionStorage 사용 금지.

### 보안
- 시크릿 하드코딩, 서버 전용 키(service_role 등)의 클라이언트 노출 금지. NEXT_PUBLIC_ 접두사는 네이버 지도 Client ID·Supabase anon 키·카카오 JS 키(공유용)·GA4 측정 ID만 허용 (decisions 2026-09-08).
- dangerouslySetInnerHTML 금지 (리뷰·코멘트·제보는 유저 입력).
- 쓰기 경로(Server Action)마다 확인: 입력 검증(zod) / 권한 체크 / 속도 제한 자리 / 에러에 내부 정보 노출 없음.
- 쓰기 함수가 **지연·await 전에 행위자(세션)를 잡는지**, 상대값(토글)이 아니라 **원하는 상태**를 받는지. `await` 뒤에 세션을 읽으면 그 사이 바뀐 사용자의 데이터를 건드리고, 화면 가드는 응답만 버릴 뿐 쓰기는 못 되돌린다 (decisions 2026-09-08 Codex PR #10).

### UI 계약
- 새 화면·상태에 4상태(로딩/빈/에러/정상) 누락 여부.
- 쓰기 동작의 낙관적 업데이트에 실패 롤백이 있는지. 연타로 요청이 겹칠 때 **마지막 의도가 이기는지**(가게·항목별 요청 순번).
- 시간 계산이 Asia/Seoul 고정인지 (저장은 UTC).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
