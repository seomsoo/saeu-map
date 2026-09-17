/**
 * Turnstile 토큰 — 브라우저에서 쓰기 직전에 한 장씩 받는다(5분·1회용). 컴포넌트는 모른다: lib/data.ts의 쓰기 래퍼가 부른다.
 * 위젯은 `execution: "execute"`(부를 때만 돈다) + `appearance: "interaction-only"`(사람 확인이 필요할 때만 보인다)로
 * TurnstileHost(app/layout)의 자리에 한 번 그려 두고, 요청마다 reset → execute → callback 토큰을 받는다.
 * 요청이 겹치면(찜 연타) 큐로 직렬화한다 — 위젯 하나에 토큰 하나.
 */
import { env } from "@/lib/env";

interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileOptions): string;
  execute(widgetId: string): void;
  reset(widgetId: string): void;
}
interface TurnstileOptions {
  sitekey: string;
  execution: "execute";
  appearance: "interaction-only";
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const TURNSTILE_HOST_ID = "turnstile-host";
export const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_TIMEOUT_MS = 10_000;

let widgetId: string | null = null;
let current: { resolve: (token: string) => void; reject: (reason: Error) => void } | null = null;
let queue: Promise<unknown> = Promise.resolve();

function waitForApi(): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const api = window.turnstile;
      if (api) resolve(api);
      else if (Date.now() - started > SCRIPT_TIMEOUT_MS) reject(new Error("turnstile script missing"));
      else setTimeout(tick, 100);
    };
    tick();
  });
}

function settle(result: { token: string } | { error: string }): void {
  const waiter = current;
  current = null;
  if (!waiter) return;
  if ("token" in result) waiter.resolve(result.token);
  else waiter.reject(new Error(result.error));
}

async function requestToken(): Promise<string> {
  const api = await waitForApi();
  const host = document.getElementById(TURNSTILE_HOST_ID);
  if (!host) throw new Error("turnstile host missing");
  return new Promise<string>((resolve, reject) => {
    current = { resolve, reject };
    if (widgetId === null) {
      widgetId = api.render(host, {
        sitekey: env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
        execution: "execute",
        appearance: "interaction-only",
        callback: (token) => {
          settle({ token });
        },
        "error-callback": () => {
          settle({ error: "turnstile error" });
        },
        "expired-callback": () => {
          settle({ error: "turnstile expired" });
        },
      });
    } else {
      api.reset(widgetId);
    }
    api.execute(widgetId);
  });
}

/** 쓰기 한 번에 토큰 한 장. 겹치면 앞 요청이 끝난 뒤 차례로. */
export function turnstileToken(): Promise<string> {
  const run = queue.then(requestToken, requestToken);
  queue = run.catch(() => undefined);
  return run;
}
