import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 쓰기 래퍼의 두 약속(Codex PR #16 #1·#3): 행위자는 Turnstile을 기다리기 전에 잡고, 찜 쓰기는 한 줄로 보낸다.
 * 액션·Turnstile은 목 — 실제 문(openWriteGate)의 대조는 pgTAP가 아니라 서버 세션이라 여기서는 "무엇을 보냈나"만 본다.
 */
const actions = vi.hoisted(() => ({
  checkIn: vi.fn(),
  setBookmark: vi.fn(),
}));
const turnstile = vi.hoisted(() => ({ turnstileToken: vi.fn<() => Promise<string>>() }));
vi.mock("../server/actions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../server/actions")>()),
  ...actions,
}));
vi.mock("../turnstile-client", () => turnstile);

import { checkIn, rememberSession, setBookmark } from "../data";

const ok = <T,>(value: T) => ({ ok: true as const, value });
const session = (userId: string | null) => ({ userId, provider: "anonymous" as const, nickname: null });

beforeEach(() => {
  actions.checkIn.mockReset();
  actions.setBookmark.mockReset();
  turnstile.turnstileToken.mockReset();
  rememberSession(null);
});

describe("행위자는 await 전에 잡는다", () => {
  it("토큰을 기다리는 사이 세션이 바뀌어도 처음 잡은 사용자로 보낸다", async () => {
    let releaseToken!: (token: string) => void;
    turnstile.turnstileToken.mockReturnValue(new Promise<string>((resolve) => (releaseToken = resolve)));
    actions.checkIn.mockResolvedValue(ok({ id: "p1" }));
    rememberSession(session("user-a"));
    const pending = checkIn("p1", "2026-09-18T00:00:00Z");
    rememberSession(session("user-b")); // 다른 탭의 로그인이 그 사이 끝났다
    releaseToken("tok");
    await pending;
    expect(actions.checkIn).toHaveBeenCalledWith("p1", "tok", "2026-09-18T00:00:00Z", "user-a");
  });

  it("세션을 모르면 null — 서버는 대조하지 않는다", async () => {
    turnstile.turnstileToken.mockResolvedValue("tok");
    actions.checkIn.mockResolvedValue(ok({ id: "p1" }));
    await checkIn("p1", "2026-09-18T00:00:00Z");
    expect(actions.checkIn).toHaveBeenLastCalledWith("p1", "tok", "2026-09-18T00:00:00Z", null);
  });
});

describe("찜 쓰기는 한 줄로", () => {
  it("앞 요청이 끝나기 전에는 다음 요청을 보내지 않고, 앞이 실패해도 줄은 이어진다", async () => {
    turnstile.turnstileToken.mockResolvedValue("tok");
    let finishFirst!: () => void;
    actions.setBookmark
      .mockReturnValueOnce(
        new Promise((_, reject) => {
          finishFirst = () => {
            reject(new Error("boom"));
          };
        }),
      )
      .mockResolvedValueOnce(ok(["p1"]));
    const first = setBookmark("p1", true);
    const second = setBookmark("p1", false);
    await Promise.resolve();
    await Promise.resolve();
    expect(actions.setBookmark).toHaveBeenCalledTimes(1);
    finishFirst();
    await expect(first).rejects.toThrow("boom");
    await expect(second).resolves.toEqual(["p1"]);
    expect(actions.setBookmark).toHaveBeenCalledTimes(2);
    expect(actions.setBookmark).toHaveBeenLastCalledWith("p1", false, "tok", null);
  });
});
