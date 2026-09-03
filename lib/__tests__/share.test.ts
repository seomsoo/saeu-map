import { afterEach, describe, expect, it, vi } from "vitest";
import { LINK_COPIED_NOTICE, LINK_COPY_FAILED_NOTICE, sharePath, sharePlace } from "../share";

const place = { id: "r001", name: "테스트 새우집" };

describe("share", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sharePath는 id를 인코딩한다", () => {
    expect(sharePath("r001")).toBe("/place/r001");
    expect(sharePath("a b")).toBe("/place/a%20b");
  });

  it("navigator.share가 있으면 공유 시트, 닫은 것(AbortError)은 실패가 아니다", async () => {
    const share = vi.fn(() => Promise.reject(new DOMException("closed", "AbortError")));
    vi.stubGlobal("navigator", { share, clipboard: { writeText: vi.fn() } });
    const onNotice = vi.fn();
    sharePlace(place, onNotice);
    await Promise.resolve();
    expect(share).toHaveBeenCalledWith({ title: "테스트 새우집", url: `${window.location.origin}/place/r001` });
    expect(onNotice).not.toHaveBeenCalled();
  });

  it("공유가 다른 이유로 실패하거나 없으면 링크 복사 + 토스트, 복사도 실패하면 실패 토스트", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { share: () => Promise.reject(new Error("nope")), clipboard: { writeText } });
    const onNotice = vi.fn();
    sharePlace(place, onNotice);
    await vi.waitFor(() => {
      expect(onNotice).toHaveBeenCalledWith(LINK_COPIED_NOTICE);
    });
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/place/r001`);

    vi.stubGlobal("navigator", { clipboard: { writeText: () => Promise.reject(new Error("denied")) } });
    const onNotice2 = vi.fn();
    sharePlace(place, onNotice2);
    await vi.waitFor(() => {
      expect(onNotice2).toHaveBeenCalledWith(LINK_COPY_FAILED_NOTICE);
    });
  });
});
