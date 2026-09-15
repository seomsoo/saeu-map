/**
 * Turnstile 서버 검증 (spec 5 스팸 4겹 1). 토큰은 5분·1회용 — siteverify가 거부하면 그 쓰기는 없다.
 * 테스트 키(runbook): secret `1x…AA` 항상 통과, `2x…AA` 항상 실패, `3x…AA` "이미 쓴 토큰".
 */
import "server-only";
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(token: string, secret: string, remoteIp?: string): Promise<boolean> {
  if (token.length === 0 || token.length > 2048) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "local") body.set("remoteip", remoteIp);
  try {
    const res = await fetch(SITEVERIFY, { method: "POST", body });
    if (!res.ok) return false;
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}
