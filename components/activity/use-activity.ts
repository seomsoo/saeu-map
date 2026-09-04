"use client";

import { useCallback, useEffect, useState } from "react";
import {
  REVIEW_DELETE_FAILED_NOTICE,
  REVIEW_UPDATED_NOTICE,
} from "@/components/place-detail/use-place-detail";
import type { ReviewSaveResult } from "@/components/review/use-review-form";
import { deleteReview as requestDeleteReview, getMyReports, getMyReviews } from "@/lib/data";
import { pushOverlayHistoryEntry } from "@/lib/history-state";
import { sortReviewsNewest } from "@/lib/reviews";
import type { MyReview, Place, Review } from "@/lib/types";

/** 내 활동 탭 (spec 5): 찜(기본) / 내 리뷰 / 내 제보 */
export type ActivityTab = "bookmarks" | "reviews" | "reports";

export const ACTIVITY_TABS: readonly { key: ActivityTab; label: string }[] = [
  { key: "bookmarks", label: "찜" },
  { key: "reviews", label: "내 리뷰" },
  { key: "reports", label: "내 제보" },
];

export type LoadStatus = "loading" | "ready" | "error";

interface UseActivityInput {
  now: string;
  tab: ActivityTab;
  onNotice: (message: string) => void;
}

/**
 * 내 활동 데이터 — 내 리뷰·내 제보는 탭에 들어갈 때 불러온다(4상태, 재시도). 찜은 부모(지도 훅)가 진실이라 여기 없다.
 * 내 리뷰의 수정·삭제는 상세와 같은 규칙(폼 오버레이, 낙관 삭제 + 실패 원복).
 */
export function useActivity({ now, tab, onNotice }: UseActivityInput) {
  const [reviews, setReviews] = useState<MyReview[]>([]);
  const [reviewsStatus, setReviewsStatus] = useState<LoadStatus>("loading");
  const [reports, setReports] = useState<Place[]>([]);
  const [reportsStatus, setReportsStatus] = useState<LoadStatus>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (tab === "bookmarks") return;
    let alive = true;
    const load = async () => {
      try {
        if (tab === "reviews") {
          const list = await getMyReviews(now);
          if (!alive) return;
          setReviews(list);
          setReviewsStatus("ready");
        } else {
          const list = await getMyReports(now);
          if (!alive) return;
          setReports(list);
          setReportsStatus("ready");
        }
      } catch {
        if (!alive) return;
        if (tab === "reviews") setReviewsStatus("error");
        else setReportsStatus("error");
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [tab, now, attempt]);

  const retry = useCallback(() => {
    if (tab === "reviews") setReviewsStatus("loading");
    if (tab === "reports") setReportsStatus("loading");
    setAttempt((n) => n + 1);
  }, [tab]);

  /* ── 내 리뷰 수정·삭제 ── */
  const [editing, setEditing] = useState<MyReview | null>(null);

  const editReview = useCallback((review: Review) => {
    const target = reviews.find((r) => r.id === review.id);
    if (!target) return;
    pushOverlayHistoryEntry();
    setEditing(target);
  }, [reviews]);

  const closeReviewForm = useCallback(() => {
    setEditing(null);
  }, []);

  const handleReviewSaved = useCallback(
    ({ review }: ReviewSaveResult) => {
      setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, ...review } : r)));
      onNotice(REVIEW_UPDATED_NOTICE);
    },
    [onNotice],
  );

  const deleteReview = useCallback(
    (id: string) => {
      const removed = reviews.find((r) => r.id === id);
      if (!removed) return;
      setReviews((prev) => prev.filter((r) => r.id !== id));
      requestDeleteReview(id).catch(() => {
        setReviews((prev) => sortReviewsNewest([...prev, removed]) as MyReview[]);
        onNotice(REVIEW_DELETE_FAILED_NOTICE);
      });
    },
    [reviews, onNotice],
  );

  return {
    reviews,
    reviewsStatus,
    reports,
    reportsStatus,
    retry,
    editing,
    editReview,
    closeReviewForm,
    handleReviewSaved,
    deleteReview,
  };
}
