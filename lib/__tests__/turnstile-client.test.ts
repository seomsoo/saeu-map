import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TURNSTILE_HOST_ID, resetTurnstileForTests, turnstileToken, warmTurnstile } from "../turnstile-client";

/**
 * 가짜 위젯 — execute마다 챌린지 하나가 "돈다"(pending). 테스트가 `solve()`로 토큰을 내준다.
 * 예비 토큰(plan write-latency 2026-09-23): 시점만 앞당기고 챌린지 수는 같아야 한다.
 */
function fakeTurnstile() {
  let callback: ((token: string) => void) | null = null;
  let executes = 0;
  let n = 0;
  window.turnstile = {
    render: (_el, options) => {
      callback = options.callback;
      return "w1";
    },
    execute: () => {
      executes += 1;
    },
    reset: () => {},
  };
  return {
    solve: () => {
      n += 1;
      callback?.(`tok-${String(n)}`);
    },
    executes: () => executes,
  };
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe("turnstile-client — 예비 토큰", () => {
  let widget: ReturnType<typeof fakeTurnstile>;
  beforeEach(() => {
    resetTurnstileForTests();
    document.body.innerHTML = `<div id="${TURNSTILE_HOST_ID}"></div>`;
    widget = fakeTurnstile();
  });
  afterEach(() => {
    delete window.turnstile;
    vi.useRealTimers();
  });

  it("예열 없이 요청하면 지금까지처럼 챌린지를 기다린다", async () => {
    const p = turnstileToken();
    await flush(); // 스크립트 폴링 한 틱
    expect(widget.executes()).toBe(1);
    widget.solve();
    expect(await p).toBe("tok-1");
  });

  it("예열해 두면 요청이 즉시 그 토큰을 쓰고, 쓴 뒤 다음 장을 예열한다 — 챌린지 수는 같다", async () => {
    warmTurnstile();
    await flush();
    expect(widget.executes()).toBe(1);
    widget.solve(); // 예비 = tok-1
    await flush();
    const token = await turnstileToken();
    expect(token).toBe("tok-1");
    await flush();
    expect(widget.executes()).toBe(2); // 다음 장 예열이 바로 시작
    widget.solve(); // 예비 = tok-2
    await flush();
    expect(await turnstileToken()).toBe("tok-2"); // 소비한 tok-1은 다시 나오지 않는다
  });

  it("예열 중에 요청이 오면 챌린지를 또 돌리지 않고 그 결과를 쓴다", async () => {
    warmTurnstile();
    await flush();
    const p = turnstileToken();
    await flush();
    expect(widget.executes()).toBe(1);
    widget.solve();
    expect(await p).toBe("tok-1");
  });

  it("4분 지난 예비는 버리고 새로 받는다 — 만료 토큰을 서버에 내지 않는다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-23T10:00:00Z"));
    warmTurnstile();
    await flush();
    widget.solve(); // tok-1 @10:00
    await flush();
    vi.setSystemTime(new Date("2026-09-23T10:04:30Z"));
    const p = turnstileToken();
    await flush();
    expect(widget.executes()).toBe(2); // 새 챌린지
    widget.solve();
    expect(await p).toBe("tok-2");
  });

  it("이미 예비가 있으면 예열은 아무것도 안 한다", async () => {
    warmTurnstile();
    await flush();
    widget.solve();
    await flush();
    warmTurnstile();
    warmTurnstile();
    await flush();
    expect(widget.executes()).toBe(1);
  });
});
