import { describe, expect, it } from "vitest";
import {
  MIN_REVIEWS_FOR_RATING,
  clampRating,
  formatRating,
  ratingSummary,
  sortReviewsNewest,
} from "../reviews";
import type { Review } from "../types";

function review(rating: number, at = "2026-08-27T20:00:00+09:00"): Review {
  return { placeId: "p1", rating, text: "", nickname: "n", at };
}

describe("ratingSummary — 리뷰 3개 미만이면 평균 숨김 (spec 4.2-9)", () => {
  it("0·1·2개는 count만 있고 average는 null", () => {
    expect(ratingSummary([])).toEqual({ count: 0, average: null });
    expect(ratingSummary([review(5)])).toEqual({ count: 1, average: null });
    expect(ratingSummary([review(5), review(4)])).toEqual({ count: 2, average: null });
  });

  it("3개부터 소수 첫째 자리 평균", () => {
    expect(MIN_REVIEWS_FOR_RATING).toBe(3);
    expect(ratingSummary([review(5), review(4), review(5)])).toEqual({
      count: 3,
      average: 4.7,
    });
    expect(ratingSummary([review(5), review(5), review(5)]).average).toBe(5);
  });
});

describe("formatRating / clampRating", () => {
  it("정수도 소수 한 자리로 고정", () => {
    expect(formatRating(5)).toBe("5.0");
    expect(formatRating(4.66)).toBe("4.7");
  });
  it("별 개수는 1~5 정수", () => {
    expect(clampRating(0)).toBe(1);
    expect(clampRating(3.6)).toBe(4);
    expect(clampRating(9)).toBe(5);
  });
});

describe("sortReviewsNewest", () => {
  it("최신순, 원본 불변", () => {
    const older = review(3, "2026-08-20T10:00:00+09:00");
    const newer = review(4, "2026-08-27T10:00:00+09:00");
    const input = [older, newer];
    expect(sortReviewsNewest(input)).toEqual([newer, older]);
    expect(input[0]).toBe(older);
  });
});
