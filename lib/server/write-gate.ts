/**
 * 모든 사용자 쓰기가 지나는 문 — 순서가 곧 규칙이다.
 *  1) 프리뷰 읽기 전용(`PREVIEW_READONLY=1`)이면 아무것도 쓰지 않는다 — 프리뷰 워커는 prod DB를 본다(decisions 2026-09-10)
 *  2) Turnstile 토큰 검증 — 사람 확인(스팸 4겹 1)
 *  3) IP 해시를 만들어 Supabase 요청 헤더(x-ip-hash)에 싣는다 — DB의 rate_ok가 actor 또는 IP로 센다(스팸 4겹 2)
 * 관리자 쓰기는 이 문을 지나지 않는다(is_admin RLS가 게이트, 스팸 표면이 아니다) — 프리뷰 차단만 같이 받는다.
 */
import { headers } from "next/headers";
import { env } from "@/lib/env";
import { clientIp, hashIp } from "./ip-hash";
import { type Db, userClient } from "./supabase";
import { verifyTurnstile } from "./turnstile";

export type GateFailure = "read only" | "bot check failed";

export function isReadOnly(): boolean {
  return env.PREVIEW_READONLY === "1";
}

/** 성공하면 IP 해시 헤더가 붙은 사용자 클라이언트. 실패 사유는 값으로(액션이 Result로 돌려준다). */
export async function openWriteGate(turnstileToken: string): Promise<{ db: Db } | { failure: GateFailure }> {
  if (isReadOnly()) return { failure: "read only" };
  const h = await headers();
  const ip = clientIp(h);
  if (!(await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY, ip))) return { failure: "bot check failed" };
  const ipHash = await hashIp(ip, env.IP_HASH_SALT);
  return { db: await userClient({ ipHash }) };
}
