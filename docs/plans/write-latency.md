# 쓰기 체감 지연 — Turnstile 미리 돌리기 (2026-09-23, 런칭 전)

**상태: 착수(사용자 "지금 하는 건?" 2026-09-23).** 브랜치 `feat/write-latency`.

## Context
prod 폰 머니패스에서 제보·수정 제안이 **각 6~7초**(사용자 실측 2026-09-23). 서버 일이 크게 다른 둘이 같은 시간이라 공통 요소가 주범: **쓰기마다 Turnstile 챌린지를 새로 돌린다**(`lib/turnstile-client.ts` reset → execute → 토큰, 보이지 않는 챌린지 2~5초 — decisions 2026-09-21 "프리뷰 첫 POST 6초+"). 나머지는 미국 엣지 ↔ 서울 DB 왕복(콜드 TTFB 1.3~6.3s 실측). 디스코드 알림은 이미 `waitUntil`이라 서버 응답을 막지 않는다(`lib/server/notify.ts`).

## 변경
- `lib/turnstile-client.ts` — **예비 토큰 한 장**: `warmTurnstile()`이 챌린지를 미리 돌려 `{ token, at }`로 들고 있는다(4분 뒤 폐기 — Turnstile 유효 5분에 여유). `turnstileToken()`은 예비가 있으면 즉시 그걸 쓰고(1회용이라 비우고) 다음 장을 바로 예열, 없으면 지금처럼 기다린다. 예열 중이면 요청은 그 예열을 기다린다(챌린지 두 번 안 돈다). 예열 실패는 조용히(다음 요청이 정상 경로).
- `lib/data.ts` — `warmWriteGate()` 노출(컴포넌트는 lib/data만 안다). 서버에선 no-op.
- 진입 4곳에 `useEffect(() => { warmWriteGate(); }, [])`: `use-place-detail`(확인·찜·사진·제안·신고) · `use-report-flow`(제보) · `review-form`(리뷰) · `activity-panel`(찜 해제·닉네임·탈퇴).
- 서버 검증(`openWriteGate`·siteverify·hostname)은 그대로 — 토큰은 여전히 1회용·5분·서버 대조. 보안 경계 변화 없음.

## 검증
- vitest `lib/__tests__/turnstile-client.test.ts`(신설, 가짜 `window.turnstile`): 예열 → 즉시 소비 · 소비한 토큰 재사용 없음 · 4분 지나면 폐기 · 예열 중 요청은 한 챌린지만 · 예열 없이 요청은 기존 경로 · 예열 실패 무해.
- `pnpm typecheck && pnpm lint && pnpm test`. 로컬 dev(테스트 키) 찜·제보 한 바퀴.
- **발화**: PR 프리뷰에서 폰으로 찜(읽기 전용 토스트까지) 체감, 머지 뒤 prod에서 수정 제안 1번 — 목표 6초 → 1~2초.

## 위험
- 예비 토큰이 만료·소비 뒤 재사용되면 "잠시 후 다시" 한 번 → 만료 시각과 소비 즉시 폐기, 테스트로 고정.
- 쓰기 화면만 열고 안 쓰면 챌린지 1회 낭비 — 무시할 수준(횟수는 지금과 같고 시점만 앞당김).

## 범위 밖(런칭 뒤 백로그)
Smart Placement(엣지 → 서울 근처) · 클라이언트 사진 리사이즈 · 워커 CPU 다이어트.
