/**
 * 속도 제한용 IP 해시 — sha256(IP + salt + KST 날짜). 원본 IP는 저장하지 않고 해시도 24시간이면 쓸모를 다한다
 * (rate_events는 하루 뒤 지워진다). 날짜가 섞여 있어 어제 해시로 오늘 사람을 못 잇는다.
 */
import { formatKstDate } from "@/lib/time";

export async function hashIp(ip: string, salt: string, now: number = Date.now()): Promise<string> {
  const data = new TextEncoder().encode(`${ip}|${salt}|${formatKstDate(now)}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cloudflare가 붙이는 실제 클라이언트 IP. 없으면(로컬 dev) x-forwarded-for 첫 값, 그것도 없으면 "local". */
export function clientIp(headers: { get(name: string): string | null }): string {
  return headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}
