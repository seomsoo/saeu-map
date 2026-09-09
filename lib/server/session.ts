/**
 * 세션 읽기·만들기 (spec 5 로그인).
 * - 방문자: 쿠키 없음 → userId null. 아무 기록도 안 남기고 auth.users 행도 없다.
 * - 익명: 첫 쓰기에서 `ensureUser`가 signInAnonymously로 만든다(lazy — decisions 2026-09-10).
 * - 카카오: OAuth 콜백(app/auth/callback)이 세션을 심고 익명 기록을 병합한다.
 * getClaims()는 JWT 서명을 프로젝트 공개키로 검증한다(네트워크 없음). getSession()은 서버에서 쓰지 않는다(Supabase 문서).
 */
import { z } from "zod";
import type { Session } from "@/lib/types";
import type { Db } from "./supabase";

export const VISITOR: Session = { userId: null, provider: "anonymous", nickname: null };

const meSchema = z.object({ id: z.uuid(), nickname: z.string().nullable(), isAdmin: z.boolean() });

export async function readSession(db: Db): Promise<Session> {
  const { data } = await db.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return VISITOR;
  if (claims.is_anonymous === true) return { userId: claims.sub, provider: "anonymous", nickname: null };
  const { data: me, error } = await db.rpc("me");
  if (error) throw new Error("profile unavailable");
  const profile = meSchema.parse(me);
  return { userId: claims.sub, provider: "kakao", nickname: profile.nickname, isAdmin: profile.isAdmin };
}

/** 쓰기 직전: 세션이 없으면 익명 유저를 만든다. 액션·라우트 핸들러에서만(쿠키를 심는다). 돌려주는 값은 uid. */
export async function ensureUser(db: Db): Promise<string> {
  const { data } = await db.auth.getClaims();
  if (data?.claims.sub) return data.claims.sub;
  const { data: signed, error } = await db.auth.signInAnonymously();
  if (error || !signed.user) throw new Error("anonymous sign-in failed");
  return signed.user.id;
}

/** 카카오(비익명) 세션이어야 하는 쓰기 — 리뷰. 아니면 거부(UI 게이트가 먼저 서고 여기가 마지막 방어선). */
export async function requireKakao(db: Db): Promise<string> {
  const { data } = await db.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || claims.is_anonymous === true) throw new Error("login required");
  return claims.sub;
}
