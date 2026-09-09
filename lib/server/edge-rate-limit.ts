/**
 * 문 앞 경비 — Cloudflare 속도 제한 바인딩(WRITE_RATE_LIMITER, wrangler.jsonc). 같은 IP의 쓰기를 60초에 N번까지.
 * DB의 rate_events가 진짜 규칙(사람·가게·종류별)이고 이건 봇 폭주가 DB까지 안 가게 하는 보조다(decisions 2026-09-10).
 * next dev에는 Cloudflare 컨텍스트가 없다 → 통과. 바인딩이 없는 워커(설정 누락)도 통과 — 조용히 죽지 않게 한 줄 남긴다.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export async function edgeRateLimitOk(ip: string): Promise<boolean> {
  let limiter: RateLimiter | undefined;
  try {
    const { env } = await getCloudflareContext({ async: true });
    limiter = (env as { WRITE_RATE_LIMITER?: RateLimiter }).WRITE_RATE_LIMITER;
  } catch {
    return true; // next dev — 워커 밖
  }
  if (!limiter) {
    console.warn("WRITE_RATE_LIMITER binding missing — edge rate limit off");
    return true;
  }
  const { success } = await limiter.limit({ key: ip });
  return success;
}
