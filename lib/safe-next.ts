/**
 * 돌아갈 곳(`next`)을 같은 사이트의 경로로 좁힌다 — 로그인 뒤 리다이렉트에 쓴다.
 * 문자열 검사(`/`로 시작하고 `//`가 아님)는 `/\evil.com`이 뚫는다: WHATWG 파서가 http(s)에서 `\`를 `/`로 읽어
 * `new URL("/\\evil.com", origin)`이 다른 호스트가 된다(security-reviewer 2026-09-16 #1). 그래서 **파싱한 결과의 origin**을 비교한다.
 * 돌려주는 값은 경로 + 쿼리뿐(해시·인증 정보 없음). 못 믿으면 "/".
 */
export function sameOriginPath(next: string | null | undefined, origin: string): string {
  if (!next) return "/";
  let target: URL;
  try {
    target = new URL(next, origin);
  } catch {
    return "/";
  }
  if (target.origin !== origin) return "/";
  return `${target.pathname}${target.search}`;
}
