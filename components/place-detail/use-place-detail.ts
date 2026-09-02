"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkIn as requestCheckIn, getPlaceDetail } from "@/lib/data";
import { isMobileUserAgent, naverPlaceWebUrl, naverRouteAppUrl } from "@/lib/naver-links";
import type { Place, Review } from "@/lib/types";
import type { ReviewsStatus } from "./review-section";

/** 아직 없는 플로우의 입구(사진·영업시간·수정 제안·리뷰·신고 등)가 띄우는 토스트 — 화면 1 [제보]와 같은 톤 */
export const COMING_SOON_NOTICE = "준비 중이에요";
export const CHECKIN_FAILED_NOTICE = "확인을 저장하지 못했어요";
export const ADDRESS_COPIED_NOTICE = "주소를 복사했어요";
export const ADDRESS_COPY_FAILED_NOTICE = "주소를 복사하지 못했어요";
export const LINK_COPIED_NOTICE = "링크를 복사했어요";
export const LINK_COPY_FAILED_NOTICE = "링크를 복사하지 못했어요";
/** 앱 스킴을 열고 이 시간 안에 화면이 안 가려지면(앱 없음) 웹 지도로 */
const APP_OPEN_TIMEOUT_MS = 1500;

interface UsePlaceDetailInput {
  place: Place;
  now: string;
  /** 서버가 함께 내려준 리뷰(/place/[id] 직접 진입). 있으면 클라이언트 재요청 없음. */
  initialReviews?: Review[] | undefined;
  /** 이 세션에서 이미 "다녀왔다면"을 누른 가게(핀당 하루 1회) */
  checked: boolean;
  onPatchPlace: (place: Place) => void;
  onChecked: (placeId: string) => void;
  onNotice: (message: string) => void;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function sharePath(placeId: string): string {
  return `/place/${placeId}`;
}

/**
 * 상세 화면 상태 — 리뷰 로드(3상태), "다녀왔다면" 낙관적 업데이트 + 실패 롤백, 복사·공유·길찾기·준비 중 입구.
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
  const [optimistic, setOptimistic] = useState<Place | null>(null);
  const [reviews, setReviews] = useState<Review[]>(initialReviews ?? []);
  const [status, setStatus] = useState<ReviewsStatus>(initialReviews ? "ready" : "loading");
  const [attempt, setAttempt] = useState(0);
  const pendingRef = useRef(false);

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

  /* ── 다녀왔다면: 낙관 +1 → 성공 시 부모 확정, 실패 시 원복 + 토스트 ── */
  const done = checked || optimistic !== null;

  const checkIn = useCallback(() => {
    if (done || pendingRef.current) return;
    pendingRef.current = true;
    const base = place;
    setOptimistic({ ...base, checkCount: base.checkCount + 1, lastCheckedAt: now });
    requestCheckIn(base.id, now)
      .then(
        (updated) => {
          onPatchPlace(updated);
          onChecked(base.id);
        },
        () => {
          onNotice(CHECKIN_FAILED_NOTICE);
        },
      )
      .finally(() => {
        pendingRef.current = false;
        setOptimistic(null);
      });
  }, [done, place, now, onPatchPlace, onChecked, onNotice]);

  /* ── 복사·공유·길찾기 ── */
  const copyAddress = useCallback(() => {
    void copyText(place.addressRoad).then((ok) => {
      onNotice(ok ? ADDRESS_COPIED_NOTICE : ADDRESS_COPY_FAILED_NOTICE);
    });
  }, [place.addressRoad, onNotice]);

  const share = useCallback(() => {
    const url = `${window.location.origin}${sharePath(place.id)}`;
    const fallback = () =>
      copyText(url).then((ok) => {
        onNotice(ok ? LINK_COPIED_NOTICE : LINK_COPY_FAILED_NOTICE);
      });
    if ("share" in navigator) {
      navigator.share({ title: place.name, url }).catch((error: unknown) => {
        // 사용자가 공유 시트를 닫은 것(AbortError)은 실패가 아니다
        if (error instanceof DOMException && error.name === "AbortError") return;
        return fallback();
      });
      return;
    }
    void fallback();
  }, [place.id, place.name, onNotice]);

  const openRoute = useCallback(() => {
    const webUrl = naverPlaceWebUrl(place);
    if (!isMobileUserAgent(navigator.userAgent)) {
      window.open(webUrl, "_blank", "noopener");
      return;
    }
    // 앱 스킴 시도 → 앱이 열리면 화면이 가려진다(visibilitychange). 안 가려지면 웹 지도로.
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") window.location.href = webUrl;
    }, APP_OPEN_TIMEOUT_MS);
    const onHidden = () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onHidden);
    };
    document.addEventListener("visibilitychange", onHidden);
    window.location.href = naverRouteAppUrl(place);
  }, [place]);

  const comingSoon = useCallback(() => {
    onNotice(COMING_SOON_NOTICE);
  }, [onNotice]);

  return {
    place: optimistic ?? place,
    done,
    reviews,
    status,
    retryReviews,
    checkIn,
    copyAddress,
    share,
    openRoute,
    comingSoon,
  };
}
