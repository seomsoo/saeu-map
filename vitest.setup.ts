import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// globals: false 라서 RTL 자동 cleanup이 등록되지 않는다 → 직접 등록 (테스트 간 DOM 누적 방지)
afterEach(() => {
  cleanup();
});

/* jsdom 30에 없는 브라우저 API 스텁. 동작 검증이 필요한 테스트는 개별로 vi.spyOn한다. */

function stub(target: object, key: string, value: unknown): void {
  if (key in target) return;
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
