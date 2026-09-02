import type { Review } from "./types";
import { toMs } from "./time";

/** 평균 별점을 보여주는 최소 리뷰 수 (spec 4.2-9, 5장 "3개 미만 평균 숨김"). */
export const MIN_REVIEWS_FOR_RATING = 3;

export interface RatingSummary {
  count: number;
  /** 소수 첫째 자리까지. 리뷰가 MIN_REVIEWS_FOR_RATING 미만이면 null(숨김). */
  average: number | null;
}

export function ratingSummary(reviews: readonly Review[]): RatingSummary {
  const count = reviews.length;
  if (count < MIN_REVIEWS_FOR_RATING) return { count, average: null };
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return { count, average: Math.round((sum / count) * 10) / 10 };
}

/** "4.7" — 정수여도 "5.0" (자릿수가 흔들리면 tabular 정렬이 깨진다). */
export function formatRating(average: number): string {
  return average.toFixed(1);
}

/** 별 5개 렌더용: 1~5 정수로 고정. */
export function clampRating(rating: number): number {
  return Math.min(5, Math.max(1, Math.round(rating)));
}

/** 최신순 정렬 (원본 불변). */
export function sortReviewsNewest(reviews: readonly Review[]): Review[] {
  return [...reviews].sort((a, b) => toMs(b.at) - toMs(a.at));
}
