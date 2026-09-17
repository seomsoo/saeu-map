import { describe, expect, it } from "vitest";
import { checkLabel, checkSentence } from "../places";

const NOW = "2026-09-10T12:00:00+09:00";

describe("확인 라벨 — 확인 0회 제보 핀은 '등록'(decisions 2026-09-10 결정 11)", () => {
  it("확인이 있으면 '○일 전 확인'", () => {
    const place = { lastCheckedAt: "2026-09-07T12:00:00+09:00", checkCount: 2 };
    expect(checkLabel(place, NOW)).toBe("3일 전 확인");
    expect(checkSentence(place, NOW)).toBe("3일 전 확인됐어요");
  });
  it("확인 0회면 등록 시각을 '등록'이라 부른다 — '확인'이라 하면 거짓이다", () => {
    const place = { lastCheckedAt: "2026-09-07T12:00:00+09:00", checkCount: 0 };
    expect(checkLabel(place, NOW)).toBe("3일 전 등록");
    expect(checkSentence(place, NOW)).toBe("3일 전 등록됐어요");
  });
});
