/**
 * 문 앞 경비 — Cloudflare 속도 제한 바인딩(WRITE_RATE_LIMITER, wrangler.jsonc). 같은 IP의 쓰기를 60초에 N번까지.
 * DB의 rate_events가 진짜 규칙(사람·가게·종류별)이고 이건 봇 폭주가 DB까지 안 가게 하는 보조다(decisions 2026-09-10).
 * next dev에는 Cloudflare 컨텍스트가 없다 → 통과. **실서비스 빌드에서 바인딩이 없으면 쓰기를 막는다**(fail closed) —
 * 설정 드리프트가 경비를 조용히 끄지 않게(security-reviewer 2026-09-16 #13). 실서비스면 Sentry 이벤트도 남긴다.
 */
import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { reportError } from "./observe";

const PRODUCTION = process.env.NODE_ENV === "production";

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export async function edgeRateLimitOk(ip: string): Promise<boolean> {
  let limiter: RateLimiter | undefined;
  try {
    const { env } = await getCloudflareContext({ async: true });
    limiter = (env as { WRITE_RATE_LIMITER?: RateLimiter }).WRITE_RATE_LIMITER;
  } catch {
    if (PRODUCTION) reportError("edge rate limit: no Cloudflare context — refusing writes");
    return !PRODUCTION; // next dev — 워커 밖
  }
  if (!limiter) {
    if (PRODUCTION) reportError("WRITE_RATE_LIMITER binding missing — refusing writes");
    else console.warn("WRITE_RATE_LIMITER binding missing — edge rate limit off (dev)");
    return !PRODUCTION;
  }
  const { success } = await limiter.limit({ key: ip });
  return success;
}
