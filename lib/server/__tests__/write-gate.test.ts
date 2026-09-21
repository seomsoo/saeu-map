import { afterEach, describe, expect, it, vi } from "vitest";
import { clientIp, hashIp } from "../ip-hash";
import { reportError } from "../observe";
import { verifyTurnstile } from "../turnstile";

vi.mock("../observe", () => ({ reportError: vi.fn() }));

describe("hashIp — sha256(IP + salt + KST 날짜)", () => {
  it("같은 날·같은 salt면 같고, 날짜·salt가 바뀌면 다르며, 원본 IP가 안 보인다", async () => {
    const a = await hashIp("203.0.113.9", "salt-1", Date.parse("2026-09-10T03:00:00+09:00"));
    const b = await hashIp("203.0.113.9", "salt-1", Date.parse("2026-09-10T22:00:00+09:00"));
    const next = await hashIp("203.0.113.9", "salt-1", Date.parse("2026-09-11T03:00:00+09:00"));
    const other = await hashIp("203.0.113.9", "salt-2", Date.parse("2026-09-10T03:00:00+09:00"));
    expect(a).toBe(b);
    expect(a).not.toBe(next);
    expect(a).not.toBe(other);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("203");
  });

  it("clientIp — Cloudflare 헤더 → x-forwarded-for 첫 값 → local", () => {
    const h = (map: Record<string, string>) => ({ get: (k: string) => map[k] ?? null });
    expect(clientIp(h({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" }))).toBe("1.2.3.4");
    expect(clientIp(h({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }))).toBe("5.6.7.8");
    expect(clientIp(h({}))).toBe("local");
  });
});

describe("verifyTurnstile — siteverify", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("success: true일 때만 통과, 네트워크 오류·non-2xx·빈 토큰은 실패", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
    expect(await verifyTurnstile("tok", "secret", "1.2.3.4")).toBe(true);
    const sent = fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(sent.get("response")).toBe("tok");
    expect(sent.get("remoteip")).toBe("1.2.3.4");

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: false }), { status: 200 }));
    expect(await verifyTurnstile("tok", "secret")).toBe(false);
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 500 }));
    expect(await verifyTurnstile("tok", "secret")).toBe(false);
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await verifyTurnstile("tok", "secret")).toBe(false);
    expect(await verifyTurnstile("", "secret")).toBe(false);
    // 로컬(dev)에서는 remoteip를 보내지 않는다 — "local"은 IP가 아니다
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
    await verifyTurnstile("tok", "secret", "local");
    expect((fetchMock.mock.calls.at(-1)?.[1]?.body as URLSearchParams).has("remoteip")).toBe(false);
  });

  it("요청의 Host를 주면 토큰이 만들어진 hostname과 같아야 통과한다 — 포트·한글 표기는 무시, 테스트 키는 건너뛴다", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const reply = (json: object) => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(json), { status: 200 }));

    reply({ success: true, hostname: "xn--r02bv8jvof.kr" });
    expect(await verifyTurnstile("tok", "secret", undefined, "xn--r02bv8jvof.kr")).toBe(true);
    reply({ success: true, hostname: "새우맵.kr" });
    expect(await verifyTurnstile("tok", "secret", undefined, "xn--r02bv8jvof.kr")).toBe(true);
    reply({ success: true, hostname: "localhost" });
    expect(await verifyTurnstile("tok", "secret", undefined, "localhost:3000")).toBe(true);

    reply({ success: true, hostname: "evil.example" });
    expect(await verifyTurnstile("tok", "secret", undefined, "xn--r02bv8jvof.kr")).toBe(false);
    expect(reportError).toHaveBeenCalledWith("turnstile hostname mismatch", { got: "evil.example", want: "xn--r02bv8jvof.kr" });
    reply({ success: true });
    expect(await verifyTurnstile("tok", "secret", undefined, "xn--r02bv8jvof.kr")).toBe(false);

    // 테스트 secret의 응답은 hostname이 늘 example.com이다(로컬·CI)
    reply({ success: true, hostname: "example.com", metadata: { result_with_testing_key: true } });
    expect(await verifyTurnstile("tok", "secret", undefined, "localhost:3000")).toBe(true);
  });
});
