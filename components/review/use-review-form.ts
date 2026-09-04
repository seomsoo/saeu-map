"use client";

import { useCallback, useState } from "react";
import { submitReview, updateReview } from "@/lib/data";
import type { Place, Review } from "@/lib/types";

export const REVIEW_TEXT_MAX = 500;
export const RATING_REQUIRED_MESSAGE = "별점을 골라주세요";
export const REVIEW_SAVE_FAILED_MESSAGE = "리뷰를 등록하지 못했어요. 다시 시도해주세요";

/** 저장 결과 — 새 리뷰면 확인일이 갱신된 가게도 함께(상호 블록 캡션 "오늘 확인"), 수정이면 null */
export interface ReviewSaveResult {
  review: Review;
  place: Place | null;
}

interface UseReviewFormInput {
  placeId: string;
  now: string;
  /** 있으면 수정 모드 — 별점·후기만 고친다 */
  initial?: Review | undefined;
}

/**
 * 리뷰 폼 상태 — 별점(필수)·후기(선택 500자)·사진(선택 1장, 목은 버림). 제출은 등록/수정 두 갈래.
 * 결과: 저장 결과 / "invalid"(별점 없음 — 폼에 머문다) / null(쓰기 실패 — 폼 안 오류 한 줄).
 */
export function useReviewForm({ placeId, now, initial }: UseReviewFormInput) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [text, setText] = useState(initial?.text ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const pickRating = useCallback((next: number) => {
    setRating(next);
    setRatingError(null);
  }, []);

  const submit = useCallback(async (): Promise<ReviewSaveResult | "invalid" | null> => {
    if (rating < 1) {
      setRatingError(RATING_REQUIRED_MESSAGE);
      return "invalid";
    }
    setPending(true);
    setSubmitError(null);
    try {
      if (initial) {
        const review = await updateReview(initial.id, { rating, text }, now);
        return { review, place: null };
      }
      return await submitReview({ placeId, rating, text, photo }, now);
    } catch {
      setSubmitError(REVIEW_SAVE_FAILED_MESSAGE);
      return null;
    } finally {
      setPending(false);
    }
  }, [rating, text, photo, initial, placeId, now]);

  return {
    rating,
    text,
    photo,
    ratingError,
    submitError,
    pending,
    editing: initial !== undefined,
    pickRating,
    setText,
    setPhoto,
    submit,
  };
}
