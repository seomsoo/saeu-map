import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

/* 서버 전용 env 기본값 — lib/server/*가 import 경로에 걸려도 createEnv가 죽지 않게. 값은 어디에도 연결되지 않는다. */
process.env["NEXT_PUBLIC_NCP_CLIENT_ID"] ??= "test-client-id";
process.env["SUPABASE_URL"] ??= "http://127.0.0.1:54321";
process.env["SUPABASE_PUBLISHABLE_KEY"] ??= "test-publishable";
process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"] ??= "1x00000000000000000000BB";
process.env["TURNSTILE_SECRET_KEY"] ??= "1x0000000000000000000000000000000AA";
process.env["IP_HASH_SALT"] ??= "test-salt-0000000000";

// globals: false 라서 RTL 자동 cleanup이 등록되지 않는다 → 직접 등록 (테스트 간 DOM 누적 방지)
afterEach(() => {
  cleanup();
});

/* jsdom 30에 없는 브라우저 API 스텁. 동작 검증이 필요한 테스트는 개별로 vi.spyOn한다. */

function stub(target: object, key: string, value: unknown): void {
  // `key in target`로 검사하면 안 된다: vitest의 jsdom 환경은 window의 모든 키를 globalThis에 접근자로 복사해
  // 없는 API(matchMedia)도 `in`이 true인 채 undefined를 돌려준다 — 그래서 matchMedia 스텁이 조용히 죽어 있었다(2026-09-07 발견).
  if ((target as Record<string, unknown>)[key] !== undefined) return;
  Object.defineProperty(target, key, {
    value,
    configurable: true,
    writable: true,
  });
}

stub(Element.prototype, "scrollIntoView", () => {});
stub(Element.prototype, "setPointerCapture", () => {});
stub(Element.prototype, "releasePointerCapture", () => {});
stub(Element.prototype, "hasPointerCapture", () => false);

// jsdom 30에는 <dialog>의 showModal/close가 없다 — top layer는 못 만들지만 open 상태와 close 이벤트는 흉내 낸다
stub(HTMLDialogElement.prototype, "showModal", function (this: HTMLDialogElement) {
  this.open = true;
});
stub(HTMLDialogElement.prototype, "close", function (this: HTMLDialogElement) {
  if (!this.open) return;
  this.open = false;
  this.dispatchEvent(new Event("close"));
});

stub(
  globalThis,
  "ResizeObserver",
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  },
);

stub(window, "matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
}));

// navigator.geolocation은 일부러 스텁하지 않는다 → "위치 없음" 경로가 기본.
// 허용 경로 테스트는 개별 테스트에서 Object.defineProperty로 주입한다.

// findBy*·waitFor의 기본 1초는 머신이 놀 때의 값이다 — stop 훅이 전체 스위트를 다른 작업과 같이 돌리면 상세·지도 렌더가 1초를 넘겨
// 거짓 실패가 난다(2026-09-16 map-screen 주소 검색 행, 홀로 돌리면 통과). 진짜 멈춘 테스트는 testTimeout(15초)이 잡는다.
configure({ asyncUtilTimeout: 5000 });
