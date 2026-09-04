"use client";

import { useCallback, useRef, useState } from "react";
import { checkIn as requestCheckIn } from "@/lib/data";
import type { Place } from "@/lib/types";

export const CHECKIN_FAILED_NOTICE = "확인을 저장하지 못했어요";

interface UseCheckInInput {
  place: Place;
  /** 서버 렌더 시각(ISO) — 낙관적 확인일의 기준. 클라이언트 Date.now() 금지 */
  now: string;
  /** 이 세션에서 이미 확인한 가게(핀당 하루 1회) */
  checked: boolean;
  onPatchPlace: (place: Place) => void;
  onChecked: (placeId: string) => void;
  onNotice: (message: string) => void;
}

/**
 * "다녀왔어요"(상세 기여 블록) = "맞아요"(신규 패널 행): 낙관 +1·오늘 확인 → 성공 시 부모 확정, 실패 시 원복 + 토스트.
 * 가게 데이터의 진실은 부모(`places` state)이고, 여기선 낙관 패치만 겹쳐 보여준다. 취소 없음(spec 5).
 */
export function useCheckIn({ place, now, checked, onPatchPlace, onChecked, onNotice }: UseCheckInInput) {
  const [optimistic, setOptimistic] = useState<Place | null>(null);
  const pendingRef = useRef(false);
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

  return { place: optimistic ?? place, done, checkIn };
}
