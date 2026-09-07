import { afterEach, describe, expect, it, vi } from "vitest";
import { DESKTOP_MEDIA_QUERY, DESKTOP_MIN_WIDTH_PX, isDesktopViewport } from "../layout";

describe("데스크탑 판정 (lib/layout)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("경계는 Tailwind lg(64rem = 1024px)와 같은 폭 하나다", () => {
    expect(DESKTOP_MIN_WIDTH_PX).toBe(1024);
    expect(DESKTOP_MEDIA_QUERY).toBe("(min-width: 1024px)");
  });

  it("matchMedia가 그 쿼리에 맞다고 할 때만 데스크탑이다 (jsdom 기본 스텁은 false)", () => {
    expect(isDesktopViewport()).toBe(false);
    const spy = vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) => ({ matches: query === DESKTOP_MEDIA_QUERY }) as MediaQueryList,
    );
    expect(isDesktopViewport()).toBe(true);
    expect(spy).toHaveBeenCalledWith(DESKTOP_MEDIA_QUERY);
  });
});
