import { describe, expect, it, vi } from "vitest";
import type { Db } from "../supabase";
import { ensureUser, readSession, requireKakao, VISITOR } from "../session";

/** auth 클라이언트 가짜 — getClaims(로컬 JWT 검증)·getUser(서버 왕복)·signOut·signInAnonymously만 */
function fakeDb(input: {
  claims?: { sub: string; is_anonymous?: boolean } | null;
  userExists?: boolean;
  me?: { id: string; nickname: string | null; isAdmin: boolean };
}) {
  const signOut = vi.fn(() => Promise.resolve({ error: null }));
  const signInAnonymously = vi.fn(() =>
    Promise.resolve({ data: { user: { id: "new-anon" }, session: null }, error: null }),
  );
  const getUser = vi.fn(() =>
    Promise.resolve(
      input.userExists === false
        ? { data: { user: null }, error: { message: "User from sub claim in JWT does not exist" } }
        : { data: { user: { id: input.claims?.sub } }, error: null },
    ),
  );
  const db = {
    auth: {
      getClaims: () => Promise.resolve({ data: input.claims ? { claims: input.claims } : null, error: null }),
      getUser,
      signOut,
      signInAnonymously,
    },
    rpc: (name: string) => Promise.resolve({ data: name === "me" ? input.me : null, error: null }),
  };
  return { db: db as unknown as Db, signOut, signInAnonymously, getUser };
}

describe("ensureUser — 쓰기 직전의 행위자", () => {
  it("세션이 없으면 익명을 만든다(lazy)", async () => {
    const f = fakeDb({ claims: null });
    expect(await ensureUser(f.db)).toBe("new-anon");
    expect(f.getUser).not.toHaveBeenCalled();
  });
  it("세션이 있고 유저도 살아 있으면 그 uid", async () => {
    const f = fakeDb({ claims: { sub: "u1", is_anonymous: true } });
    expect(await ensureUser(f.db)).toBe("u1");
    expect(f.signInAnonymously).not.toHaveBeenCalled();
  });
  it("JWT는 유효한데 유저가 지워졌으면(정리 크론·탈퇴·db reset) 세션을 버리고 새 익명으로", async () => {
    const f = fakeDb({ claims: { sub: "ghost", is_anonymous: true }, userExists: false });
    expect(await ensureUser(f.db)).toBe("new-anon");
    expect(f.signOut).toHaveBeenCalledTimes(1);
    expect(f.signInAnonymously).toHaveBeenCalledTimes(1);
  });
});

describe("readSession / requireKakao", () => {
  it("방문자 → VISITOR(userId null), 익명 → provider anonymous, 카카오 → me()의 닉네임·isAdmin", async () => {
    expect(await readSession(fakeDb({ claims: null }).db)).toEqual(VISITOR);
    expect(await readSession(fakeDb({ claims: { sub: "a1", is_anonymous: true } }).db)).toEqual({
      userId: "a1",
      provider: "anonymous",
      nickname: null,
    });
    const kakao = fakeDb({
      claims: { sub: "3f2a9c1e-1111-4a1a-9b1b-000000000001", is_anonymous: false },
      me: { id: "3f2a9c1e-1111-4a1a-9b1b-000000000001", nickname: "새우헌터", isAdmin: true },
    });
    expect(await readSession(kakao.db)).toEqual({
      userId: "3f2a9c1e-1111-4a1a-9b1b-000000000001",
      provider: "kakao",
      nickname: "새우헌터",
      isAdmin: true,
    });
  });
  it("requireKakao는 익명·방문자를 거부한다(리뷰의 마지막 방어선)", async () => {
    await expect(requireKakao(fakeDb({ claims: null }).db)).rejects.toThrow("login required");
    await expect(requireKakao(fakeDb({ claims: { sub: "a1", is_anonymous: true } }).db)).rejects.toThrow("login required");
    expect(await requireKakao(fakeDb({ claims: { sub: "k1", is_anonymous: false } }).db)).toBe("k1");
  });
});
