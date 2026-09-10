import { describe, expect, it } from "vitest";
import { isPhotoKey, placePhotoKey, reviewPhotoKey } from "../photo-key";

const A = "3f2a9c1e-1111-4a1a-9b1b-000000000001";
const B = "3f2a9c1e-2222-4a1a-9b1b-000000000002";

describe("photo-key — 서빙 라우트가 받는 키의 모양", () => {
  it("우리가 만든 키만 통과한다", () => {
    expect(isPhotoKey(placePhotoKey(A, B))).toBe(true);
    expect(isPhotoKey(reviewPhotoKey(A, B))).toBe(true);
    expect(placePhotoKey(A, B)).toBe(`places/${A}/${B}.webp`);
  });
  it("경로 탐색·다른 접두어·확장자·대문자 uuid는 거부", () => {
    for (const bad of [
      `places/${A}/../${B}.webp`,
      `photos/${A}/${B}.webp`,
      `places/${A}/${B}.png`,
      `places/${A.toUpperCase()}/${B}.webp`,
      `places/${A}/${B}.webp/extra`,
      "",
      "places//x.webp",
    ]) {
      expect(isPhotoKey(bad), bad).toBe(false);
    }
  });
});
