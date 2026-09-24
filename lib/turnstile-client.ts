/**
 * Turnstile 토큰 — 브라우저에서 쓰기마다 한 장(5분·1회용). 컴포넌트는 모른다: lib/data.ts의 쓰기 래퍼가 부른다.
 * 위젯은 `execution: "execute"`(부를 때만 돈다) + `appearance: "interaction-only"`(사람 확인이 필요할 때만 보인다)로
 * TurnstileHost(app/layout)의 자리에 한 번 그려 두고, 요청마다 reset → execute → callback 토큰을 받는다.
 * 요청이 겹치면(찜 연타) 큐로 직렬화한다 — 위젯 하나에 토큰 하나.
 *
 * **예비 토큰 한 장**(2026-09-23, plan write-latency): 보이지 않는 챌린지가 2~5초라 제출 때 돌리면 그게 그대로 대기 시간이다.
 * 쓰기 화면이 열릴 때 `warmTurnstile()`로 미리 한 장 받아 두고, 제출은 그걸 즉시 쓴 뒤 다음 장을 예열한다.
 * 서버 검증은 그대로다(1회용·5분·hostname) — 시점만 앞당긴다.
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

function freshToken(): Promise<string> {
  const run = queue.then(requestToken, requestToken);
  queue = run.catch(() => undefined);
  return run;
}

/** Turnstile 토큰은 5분 유효 — 여유를 두고 4분 지난 예비는 버린다(만료 토큰을 내면 "잠시 후 다시"가 뜬다) */
const SPARE_TTL_MS = 4 * 60_000;
let spare: { token: string; at: number } | null = null;
let warming: Promise<void> | null = null;

function takeSpare(now: number): string | null {
  if (spare === null) return null;
  const { token, at } = spare;
  spare = null; // 1회용 — 꺼내는 순간 비운다
  return now - at <= SPARE_TTL_MS ? token : null;
}

/**
 * 예비 토큰을 미리 받아 둔다 — 쓰기 화면이 열릴 때 부른다. 이미 있거나 예열 중이면 아무것도 안 한다.
 * 실패는 조용히: 다음 요청이 정상 경로(제출 때 챌린지)로 간다.
 */
export function warmTurnstile(now: number = Date.now()): void {
  if (typeof window === "undefined") return;
  if (warming !== null) return;
  if (spare !== null && now - spare.at <= SPARE_TTL_MS) return;
  spare = null;
  warming = freshToken()
    .then((token) => {
      spare = { token, at: Date.now() };
    })
    .catch(() => undefined)
    .finally(() => {
      warming = null;
    });
}

/** 쓰기 한 번에 토큰 한 장. 예비가 있으면 즉시, 예열 중이면 그걸 기다리고, 없으면 지금 받는다. 쓴 뒤엔 다음 장을 예열한다. */
export async function turnstileToken(now: number = Date.now()): Promise<string> {
  let token = takeSpare(now);
  if (token === null && warming !== null) {
    await warming;
    token = takeSpare(Date.now());
  }
  if (token === null) token = await freshToken();
  warmTurnstile();
  return token;
}

/** 테스트 전용 — 모듈 상태 초기화 */
export function resetTurnstileForTests(): void {
  widgetId = null;
  current = null;
  queue = Promise.resolve();
  spare = null;
  warming = null;
}
