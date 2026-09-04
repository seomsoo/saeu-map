"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import type { ReviewSaveResult } from "@/components/review/use-review-form";
import {
  deleteReview as requestDeleteReview,
  getPlaceDetail,
  type PhotoReportReason,
  reportPhoto as requestReportPhoto,
} from "@/lib/data";
import {
  isPhotoHistoryState,
  pushOverlayHistoryEntry,
  type SaeuHistoryState,
} from "@/lib/history-state";
import { isMobileUserAgent, naverPlaceWebUrl, naverRouteAppUrl } from "@/lib/naver-links";
import { sortReviewsNewest } from "@/lib/reviews";
import { copyText, sharePlace } from "@/lib/share";
import type { Place, Review } from "@/lib/types";
import type { ReviewsStatus } from "./review-section";
import { useCheckIn } from "./use-check-in";

export { CHECKIN_FAILED_NOTICE } from "./use-check-in";

/** 아직 없는 플로우의 입구(사진·영업시간·수정 제안·신고 등)가 띄우는 토스트 — 화면 1 [제보]와 같은 톤 */
export const COMING_SOON_NOTICE = "준비 중이에요";
export const REVIEW_SAVED_NOTICE = "리뷰를 남겼어요";
export const REVIEW_UPDATED_NOTICE = "리뷰를 고쳤어요";
export const REVIEW_DELETE_FAILED_NOTICE = "리뷰를 삭제하지 못했어요";
export const ADDRESS_COPIED_NOTICE = "주소를 복사했어요";
export const ADDRESS_COPY_FAILED_NOTICE = "주소를 복사하지 못했어요";
export const PHOTO_REPORTED_NOTICE = "신고를 접수했어요";
/** 실패 토스트는 뷰어 안에서 뜬다(top layer가 지도 화면 토스트를 가린다) — 문구만 여기 모아 둔다 */
export const PHOTO_REPORT_FAILED_NOTICE = "신고를 접수하지 못했어요";
/** 앱 스킴을 열고 이 시간 안에 화면이 안 가려지면(앱 없음) 웹 지도로 */
const APP_OPEN_TIMEOUT_MS = 1500;

interface UsePlaceDetailInput {
  place: Place;
  now: string;
  /** 서버가 함께 내려준 리뷰(/place/[id] 직접 진입). 있으면 클라이언트 재요청 없음. */
  initialReviews?: Review[] | undefined;
  /** 이 세션에서 이미 "다녀왔어요"을 누른 가게(핀당 하루 1회) */
  checked: boolean;
  onPatchPlace: (place: Place) => void;
  onChecked: (placeId: string) => void;
  onNotice: (message: string) => void;
}

/**
 * 상세 화면 상태 — 리뷰 로드(3상태), "다녀왔어요" 낙관적 업데이트 + 실패 롤백, 복사·공유·길찾기·준비 중 입구.
 * 가게 데이터의 진실은 부모(`places` state)이고, 여기선 낙관 패치만 겹쳐 보여준다.
 */
export function usePlaceDetail({
  place,
  now,
  initialReviews,
  checked,
  onPatchPlace,
  onChecked,
  onNotice,
}: UsePlaceDetailInput) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews ?? []);
  const [status, setStatus] = useState<ReviewsStatus>(initialReviews ? "ready" : "loading");
  const [attempt, setAttempt] = useState(0);

  /* ── 리뷰 로드 (컴포넌트는 place.id로 key되어 가게가 바뀌면 처음 상태에서 다시 시작) ── */
  useEffect(() => {
    if (initialReviews && attempt === 0) return;
    let cancelled = false;
    const load = async () => {
      try {
        const detail = await getPlaceDetail(place.id, now);
        if (cancelled) return;
        if (!detail) {
          setStatus("error");
          return;
        }
        setReviews(detail.reviews);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [place.id, now, initialReviews, attempt]);

  const retryReviews = useCallback(() => {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }, []);

  /* ── 다녀왔어요: 낙관 +1 → 성공 시 부모 확정, 실패 시 원복 + 토스트 (신규 패널 [맞아요]와 같은 훅) ── */
  const {
    place: shownPlace,
    done,
    checkIn,
  } = useCheckIn({ place, now, checked, onPatchPlace, onChecked, onNotice });

  /* ── 복사·공유·길찾기 ── */
  const copyAddress = useCallback(() => {
    if (place.addressRoad === null) return; // 주소 없는 제보 핀은 [복사] 자체가 없다
    void copyText(place.addressRoad).then((ok) => {
      onNotice(ok ? ADDRESS_COPIED_NOTICE : ADDRESS_COPY_FAILED_NOTICE);
    });
  }, [place.addressRoad, onNotice]);

  const share = useCallback(() => {
    sharePlace(place, onNotice);
  }, [place, onNotice]);

  // 앱 스킴 폴백 타이머 — 상세를 닫거나 가게를 바꾸면(언마운트) 취소한다 (security-reviewer 2026-09-02)
  const routeFallback = useRef<(() => void) | null>(null);
  useEffect(() => () => routeFallback.current?.(), []);

  const openRoute = useCallback(() => {
    const webUrl = naverPlaceWebUrl(place);
    if (!isMobileUserAgent(navigator.userAgent)) {
      window.open(webUrl, "_blank", "noopener");
      return;
    }
    routeFallback.current?.();
    // 앱 스킴 시도 → 앱이 열리면 화면이 가려진다(visibilitychange). 안 가려지면 웹 지도로.
    const onHidden = () => {
      routeFallback.current?.();
    };
    const timer = window.setTimeout(() => {
      routeFallback.current?.();
      if (document.visibilityState === "visible") window.location.href = webUrl;
    }, APP_OPEN_TIMEOUT_MS);
    routeFallback.current = () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onHidden);
      routeFallback.current = null;
    };
    document.addEventListener("visibilitychange", onHidden);
    window.location.href = naverRouteAppUrl(place);
  }, [place]);

  /* ── 사진 뷰어 — 열린 사진의 인덱스(닫히면 null). 뷰어 자체는 place-detail이 렌더한다. ── */
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);

  const openPhoto = useCallback((index: number) => {
    setPhotoIndex(index);
    // 안드로이드 뒤로가기 1회 = 뷰어만 닫기. URL은 그대로 두고 엔트리만 쌓는다(lib/history-state)
    const state: SaeuHistoryState = { saeuDetail: true, saeuPhoto: true };
    window.history.pushState(state, "", window.location.pathname);
  }, []);

  const closePhoto = useCallback(() => {
    setPhotoIndex(null);
    // 뒤로가기로 닫힌 거면 우리 엔트리는 이미 빠졌다 — 그때 back()을 또 부르면 상세까지 닫힌다
    if (isPhotoHistoryState(window.history.state)) window.history.back();
  }, []);

  // 뷰어가 떠 있는 동안만 듣는다. use-map-screen의 popstate도 함께 울리지만 경로가 그대로라
  // openDetail이 멱등 가드로 no-op이 된다(그 가드가 이 설계의 전제다).
  useEffect(() => {
    if (photoIndex === null) return;
    // 닫는 경로는 하나(closePhoto) — 엔트리를 되돌릴지는 그 안에서 히스토리 상태를 보고 정한다
    window.addEventListener("popstate", closePhoto);
    return () => {
      window.removeEventListener("popstate", closePhoto);
    };
  }, [photoIndex, closePhoto]);

  /** 접수되면 뷰어를 닫고 알린다. 실패는 그대로 reject — 뷰어가 자기 안에서 토스트를 낸다. */
  const reportPhoto = useCallback(
    async (photoId: string, reason: PhotoReportReason) => {
      await requestReportPhoto({ placeId: place.id, photoId, reason });
      closePhoto();
      onNotice(PHOTO_REPORTED_NOTICE);
    },
    [place.id, closePhoto, onNotice],
  );

  const comingSoon = useCallback(() => {
    onNotice(COMING_SOON_NOTICE);
  }, [onNotice]);

  /* ── 리뷰 쓰기 (화면 5 변형 (b)·(c)): 로그인 게이트 → 폼(오버레이), 본인 수정·낙관 삭제 ── */
  const { session, requireLogin } = useSession();
  const [reviewForm, setReviewForm] = useState<{ initial?: Review } | null>(null);
  // 늦게 온 게이트 결과가 닫힌 상세를 움직이지 않게 (StrictMode 이중 effect: 본문에서 true)
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** 이 가게에 쓴 내 리뷰 — 있으면 [리뷰 남기기]가 [리뷰 수정]이 된다(핀당 1개, spec 5 스팸 4겹 2). */
  const currentUserId = session?.userId ?? null;
  const myReview = useMemo(
    () => (currentUserId === null ? undefined : reviews.find((r) => r.authorId === currentUserId)),
    [reviews, currentUserId],
  );
  /** 늦게 온 게이트 결과가 최신 목록을 봐야 한다 — 로그인 직후 리렌더 전에 resolve될 수 있다 */
  const myReviewRef = useRef(myReview);
  useEffect(() => {
    myReviewRef.current = myReview;
  }, [myReview]);

  /** [리뷰 남기기]·[리뷰 수정] — 익명이면 로그인 시트, 로그인하면(또는 이미면) 폼. 게이트 뒤 폼으로 복귀(spec 5). */
  const writeReview = useCallback(() => {
    void requireLogin("review").then((ok) => {
      if (!ok || !alive.current) return;
      pushOverlayHistoryEntry();
      const mine = myReviewRef.current;
      setReviewForm(mine ? { initial: mine } : {});
    });
  }, [requireLogin]);

  const editReview = useCallback((review: Review) => {
    pushOverlayHistoryEntry();
    setReviewForm({ initial: review });
  }, []);

  const closeReviewForm = useCallback(() => {
    setReviewForm(null);
  }, []);

  /** 저장 성공 — 새 리뷰는 맨 앞에 + 가게 확인일 갱신, 수정은 제자리 교체. 토스트는 폼이 닫힌 뒤 보인다. */
  const handleReviewSaved = useCallback(
    ({ review, place: updated }: ReviewSaveResult) => {
      setReviews((prev) =>
        updated
          ? [review, ...prev.filter((r) => r.id !== review.id)]
          : prev.map((r) => (r.id === review.id ? review : r)),
      );
      if (updated) onPatchPlace(updated);
      onNotice(updated ? REVIEW_SAVED_NOTICE : REVIEW_UPDATED_NOTICE);
    },
    [onPatchPlace, onNotice],
  );

  /** 본인 리뷰 삭제 — 즉시 빠지고(낙관) 실패하면 제자리(최신순)로 돌아온다 + 토스트 */
  const deleteReview = useCallback(
    (id: string) => {
      const removed = reviews.find((r) => r.id === id);
      if (!removed) return;
      setReviews((prev) => prev.filter((r) => r.id !== id));
      requestDeleteReview(id).catch(() => {
        if (!alive.current) return;
        setReviews((prev) => sortReviewsNewest([...prev, removed]));
        onNotice(REVIEW_DELETE_FAILED_NOTICE);
      });
    },
    [reviews, onNotice],
  );

  return {
    place: shownPlace,
    done,
    reviews,
    status,
    retryReviews,
    checkIn,
    copyAddress,
    share,
    openRoute,
    comingSoon,
    photoIndex,
    openPhoto,
    closePhoto,
    reportPhoto,
    /** 본인 리뷰 판정용 — 세션을 아직 모르면 null(아무 리뷰도 내 것이 아니다) */
    currentUserId,
    /** 이 가게에 이미 쓴 내 리뷰 — 기여 블록 버튼이 [리뷰 수정]으로 바뀐다 */
    hasMyReview: myReview !== undefined,
    reviewForm,
    writeReview,
    editReview,
    closeReviewForm,
    handleReviewSaved,
    deleteReview,
  };
}
