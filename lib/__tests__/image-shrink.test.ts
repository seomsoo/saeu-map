import { afterEach, describe, expect, it, vi } from "vitest";
import { SHRINK_MAX_EDGE_PX, shrinkImage } from "../image-shrink";

const original = () => new File([new Uint8Array(3 * 1024 * 1024)], "IMG_0001.jpg", { type: "image/jpeg" });

describe("shrinkImage — 폰에서 먼저 줄이기", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("createImageBitmap이 없으면(오래된 브라우저·서버) 원본 그대로", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    const file = original();
    expect(await shrinkImage(file)).toBe(file);
  });

  it("4000×3000을 긴 변 1200으로 줄여 webp로 — 이름은 .webp, 크기는 원본보다 작다", async () => {
    let drawn: [number, number] | null = null;
    vi.stubGlobal("createImageBitmap", vi.fn(() => Promise.resolve({ width: 4000, height: 3000, close: () => {} })));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({ drawImage: () => {} }) as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (this: HTMLCanvasElement, cb, type) {
      drawn = [this.width, this.height];
      cb(new Blob([new Uint8Array(200 * 1024)], { type: String(type) }));
    });
    const out = await shrinkImage(original());
    expect(drawn).toEqual([SHRINK_MAX_EDGE_PX, 900]);
    expect(out.type).toBe("image/webp");
    expect(out.name).toBe("IMG_0001.webp");
    expect(out.size).toBe(200 * 1024);
  });

  it("줄인 결과가 원본보다 크거나 webp를 못 만들면 원본 그대로", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(() => Promise.resolve({ width: 800, height: 600, close: () => {} })));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({ drawImage: () => {} }) as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) => {
      cb(null);
    });
    const file = original();
    expect(await shrinkImage(file)).toBe(file);
  });
});
