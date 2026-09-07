import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * createEnv는 import 시점에 검증한다 — 케이스마다 모듈을 새로 읽는다.
 * jsdom엔 window가 있어 t3-env가 클라이언트로 보고 서버 변수 접근을 막는다 — 서버로 읽히게 window를 지운다.
 */
async function loadEnv(siteUrl: string | undefined) {
  vi.resetModules();
  vi.stubGlobal("window", undefined);
  vi.stubEnv("NEXT_PUBLIC_NCP_CLIENT_ID", "test-client-id");
  if (siteUrl === undefined) vi.stubEnv("SITE_URL", undefined);
  else vi.stubEnv("SITE_URL", siteUrl);
  return (await import("../env")).env;
}

describe("env — SITE_URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it(".env.example처럼 비워 둔 SITE_URL=는 없는 것과 같다 (앱이 뜨고 lib/seo가 기본 URL로 폴백)", async () => {
    const env = await loadEnv("");
    expect(env.SITE_URL).toBeUndefined();
  });

  it("없으면 undefined, 있으면 그대로", async () => {
    expect((await loadEnv(undefined)).SITE_URL).toBeUndefined();
    expect((await loadEnv("https://preview.example.com")).SITE_URL).toBe("https://preview.example.com");
  });

  it("http(s)가 아닌 스킴은 거부한다 (메타에 javascript: 가 들어가는 길을 닫는다)", async () => {
    await expect(loadEnv("javascript:alert(1)")).rejects.toThrow();
  });
});
