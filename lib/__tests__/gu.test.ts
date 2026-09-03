import { describe, expect, it } from "vitest";
import { guOfPoint } from "../gu";

describe("guOfPoint — 서울 25구 경계 판정", () => {
  it.each([
    ["서울시청", 37.5665, 126.978, "중구"], // 청계천 경계에서 300m — 단순화본이면 종로구로 새던 점
    ["삼성역", 37.5089, 127.0631, "강남구"],
    ["잠실역", 37.5133, 127.1001, "송파구"],
    ["홍대입구역", 37.5571, 126.9245, "마포구"],
    ["노원역", 37.6553, 127.0616, "노원구"],
  ])("%s → %s", async (_, lat, lng, gu) => {
    expect(await guOfPoint({ lat, lng })).toBe(gu);
  });

  it("서울 밖(김포 고촌·바다)은 null", async () => {
    expect(await guOfPoint({ lat: 37.6, lng: 126.77 })).toBeNull();
    expect(await guOfPoint({ lat: 35.1, lng: 129.0 })).toBeNull();
  });
});
