// `server-only`의 테스트용 빈 대체 — 진짜 패키지는 React 서버 조건이 없는 곳(vitest·jsdom)에서 import 즉시 throw한다.
// 컴포넌트 테스트가 lib/data.ts → lib/server/actions.ts를 거쳐 서버 모듈을 모듈 그래프에 올리므로 여기로 돌린다(vitest.config.ts alias).
export {};
