# AGENTS.md — 새우맵

전체 스펙은 docs/spec.md, 개발 규칙은 CLAUDE.md 참조. 이 파일은 코드 리뷰 기준용이다.

## Code Review Rules

### 원칙
- correctness에 영향 있는 것만 지적하라. 스타일·취향·네이밍 코멘트 금지.
- 이미 존재하던 문제(pre-existing)는 지적하지 마라. 이번 diff가 만든 것만.

### 데이터 경계
- 컴포넌트에서 데이터 직접 접근(fetch, DB 클라이언트 호출) 금지 — 모든 데이터는 lib/data.ts 경유.
- 네이버·카카오 API 응답을 상태·파일·DB에 저장하는 코드 금지.
- 외부 이미지 도메인(pstatic.net, kakaocdn 등) 사용 금지.
- localStorage/sessionStorage 사용 금지.

### 보안
- 시크릿 하드코딩, 서버 전용 키(service_role 등)의 클라이언트 노출 금지. NEXT_PUBLIC_ 접두사는 네이버 지도 Client ID·Supabase anon 키·카카오 JS 키(공유용)만 허용.
- dangerouslySetInnerHTML 금지 (리뷰·코멘트·제보는 유저 입력).
- 쓰기 경로(Server Action)마다 확인: 입력 검증(zod) / 권한 체크 / 속도 제한 자리 / 에러에 내부 정보 노출 없음.

### UI 계약
- 새 화면·상태에 4상태(로딩/빈/에러/정상) 누락 여부.
- 쓰기 동작의 낙관적 업데이트에 실패 롤백이 있는지.
- 시간 계산이 Asia/Seoul 고정인지 (저장은 UTC).
