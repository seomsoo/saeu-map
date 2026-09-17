/**
 * 세션 읽기·만들기 (spec 5 로그인).
 * - 방문자: 쿠키 없음 → userId null. 아무 기록도 안 남기고 auth.users 행도 없다.
 * - 익명: 첫 쓰기에서 `ensureUser`가 signInAnonymously로 만든다(lazy — decisions 2026-09-10).
 * - 카카오: OAuth 콜백(app/auth/callback)이 세션을 심고 익명 기록을 병합한다.
 * getClaims()는 JWT 서명을 프로젝트 공개키로 검증한다(네트워크 없음). getSession()은 서버에서 쓰지 않는다(Supabase 문서).
 */
import "server-only";
import { z } from "zod";
import type { Session } from "@/lib/types";
import type { Db } from "./supabase";

export const VISITOR: Session = { userId: null, provider: "anonymous", nickname: null };

const meSchema = z.object({ id: z.uuid(), nickname: z.string().nullable(), isAdmin: z.boolean() });

/**
 * 카카오 세션인가 — "익명이 아니면 카카오"로 보지 않고 공급자 클레임을 본다. 이메일 가입은 config가 닫았지만(#4) 설정이 새면
 * 다른 공급자 계정이 리뷰·탈퇴 게이트를 지날 수 있다(security-reviewer 2026-09-16). 그런 세션은 방문자 취급.
 */
function isKakao(claims: { sub?: string; is_anonymous?: boolean; app_metadata?: { provider?: string } }): claims is { sub: string } {
  return typeof claims.sub === "string" && claims.is_anonymous !== true && claims.app_metadata?.provider === "kakao";
}

export async function readSession(db: Db): Promise<Session> {
  const { data } = await db.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return VISITOR;
  if (claims.is_anonymous === true) return { userId: claims.sub, provider: "anonymous", nickname: null };
  if (!isKakao(claims)) return VISITOR;
  const { data: me, error } = await db.rpc("me");
  if (error) throw new Error("profile unavailable");
  if (me === null) return VISITOR; // 프로필 행이 없다(탈퇴 뒤 아직 유효한 JWT) — 손님으로. 다음 쓰기의 ensureUser가 세션을 정리한다
  const profile = meSchema.parse(me);
  return { userId: claims.sub, provider: "kakao", nickname: profile.nickname, isAdmin: profile.isAdmin };
}

/**
 * 쓰기 직전: 세션이 없으면 익명 유저를 만든다. 액션·라우트 핸들러에서만(쿠키를 심는다). 돌려주는 값은 uid.
 * 세션이 있어도 **유저가 아직 있는지 auth 서버에 묻는다**(getUser) — 유저를 지워도 JWT는 만료 전까지 유효해서(Supabase),
 * 30일 정리 크론·탈퇴·로컬 db reset 뒤에도 옛 쿠키가 "있는 사람"으로 읽히고 첫 쓰기가 FK 위반으로 죽는다(2026-09-10 workerd 실측).
 * 그런 세션은 버리고 새 익명으로 시작한다. 왕복 한 번은 쓰기에만 든다(읽기는 getClaims뿐).
 */
export async function ensureUser(db: Db): Promise<string> {
  const { data } = await db.auth.getClaims();
  if (data?.claims.sub) {
    const { data: live, error } = await db.auth.getUser();
    if (!error) return live.user.id;
    await db.auth.signOut(); // 죽은 세션 쿠키 정리
  }
  const { data: signed, error } = await db.auth.signInAnonymously();
  if (error || !signed.user) throw new Error("anonymous sign-in failed");
  return signed.user.id;
}

/** 카카오(비익명) 세션이어야 하는 쓰기 — 리뷰. 아니면 거부(UI 게이트가 먼저 서고 여기가 마지막 방어선). */
export async function requireKakao(db: Db): Promise<string> {
  const { data } = await db.auth.getClaims();
  const claims = data?.claims;
  if (!claims || !isKakao(claims)) throw new Error("login required");
  return claims.sub;
}
