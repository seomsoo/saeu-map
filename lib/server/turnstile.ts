/**
 * Turnstile 서버 검증 (spec 5 스팸 4겹 1). 토큰은 5분·1회용 — siteverify가 거부하면 그 쓰기는 없다.
 * 테스트 키(runbook): secret `1x…AA` 항상 통과, `2x…AA` 항상 실패, `3x…AA` "이미 쓴 토큰".
 *
 * `expectedHost`(요청의 Host)로 토큰이 **우리 페이지에서** 만들어졌는지도 본다 — 서버 액션은 같은 출처로만 오므로
 * 위젯이 돈 페이지의 hostname과 요청의 Host는 같아야 한다. 위젯의 호스트명 목록(대시보드)이 1차 방어고 이건 그 설정이
 * 풀렸을 때의 2차다(보안 리뷰 2026-09-16 #12). Host가 없으면(null) 통과가 아니라 **실패**다 — Workers는 늘 싣지만
 * 런타임이 바뀌어 빠졌을 때 2차 방어가 조용히 꺼지지 않게(security-reviewer 2026-09-22 ①). 테스트 키는 hostname이
 * 늘 `example.com`이라 건너뛴다 — `result_with_testing_key`는 테스트 secret만 돌려주므로 실서비스에서 이 분기로 빠질 수 없다.
 */
import "server-only";
import { reportError } from "./observe";
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type Siteverify = { success?: boolean; hostname?: string; metadata?: { result_with_testing_key?: boolean } };

/** 비교용 — 포트를 떼고 한글 도메인은 퓨니코드로(URL 파서가 한다). 없거나 못 읽으면 null */
function hostnameOf(host: string | null | undefined): string | null {
  if (!host) return null;
  try {
    return new URL(`https://${host}`).hostname;
  } catch {
    return null;
  }
}

export async function verifyTurnstile(token: string, secret: string, expectedHost: string | null, remoteIp?: string): Promise<boolean> {
  if (token.length === 0 || token.length > 2048) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "local") body.set("remoteip", remoteIp);
  try {
    const res = await fetch(SITEVERIFY, { method: "POST", body });
    if (!res.ok) return false;
    const json = (await res.json()) as Siteverify;
    if (json.success !== true) return false;
    if (json.metadata?.result_with_testing_key === true) return true;
    const got = hostnameOf(json.hostname);
    const want = hostnameOf(expectedHost);
    if (got !== null && want !== null && got === want) return true;
    // 조용히 "bot check failed"로만 끝나면 설정 실수(새 도메인 누락)를 못 찾는다 — 호스트명은 개인정보가 아니다
    reportError("turnstile hostname mismatch", { got: json.hostname ?? null, want: expectedHost });
    return false;
  } catch {
    return false;
  }
}
