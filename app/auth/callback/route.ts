import { NextResponse } from "next/server";
import { sameOriginPath } from "@/lib/safe-next";
import { adminClient, userClient } from "@/lib/server/supabase";
import { isReadOnly } from "@/lib/server/write-gate";

/**
 * 카카오 OAuth 콜백 (decisions 2026-09-10 "OAuth + 서버 병합").
 * 1) 이 요청이 들고 온 **옛 쿠키**가 익명 세션이면 그 uid를 잡아 두고(소유 증명은 쿠키 자체)
 * 2) code를 세션으로 바꾼다(새 쿠키) — 처음이면 카카오 유저가 새로 생기고, 재로그인이면 기존 유저다
 * 3) 옛 익명 uid의 찜·확인·제보·사진·신고·이력을 새 uid로 옮기고 익명 유저를 지운다(secret key RPC)
 * 4) 돌아갈 곳(`next`, 같은 사이트 경로만)으로 `?login=ok|fail`을 붙여 보낸다 — 화면이 하려던 일(intent)을 이어 간다
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sameOriginPath(url.searchParams.get("next"), url.origin);
  const back = (status: "ok" | "fail"): Response => {
    const target = new URL(next, url.origin);
    target.searchParams.set("login", status);
    return NextResponse.redirect(target);
  };
  if (!code || isReadOnly()) return back("fail");

  const db = await userClient();
  const before = await db.auth.getClaims();
  const oldUid = before.data?.claims.sub ?? null;
  const wasAnonymous = before.data?.claims.is_anonymous === true;

  const { data, error } = await db.auth.exchangeCodeForSession(code);
  if (error) return back("fail");

  if (wasAnonymous && oldUid !== null && oldUid !== data.user.id) {
    const { error: mergeError } = await adminClient().rpc("admin_merge_users", {
      p_from: oldUid,
      p_into: data.user.id,
    });
    // 로그인은 됐고 승계만 실패한 상태 — 사용자를 막지 않는다. 기록은 서버 로그(커밋 9에서 Sentry)
    if (mergeError) console.error("anonymous merge failed", mergeError.code);
  }
  return back("ok");
}
