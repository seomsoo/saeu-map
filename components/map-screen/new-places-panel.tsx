"use client";

import { useCallback, useState } from "react";
import { useOverlayHistory } from "@/components/ui/use-overlay-history";
import { pushOverlayHistoryEntry } from "@/lib/history-state";
import type { Place } from "@/lib/types";
import { FlagSheet } from "./flag-sheet";
import { NewPlaceRow } from "./new-place-row";

export const NEW_PANEL_TITLE = "새로 들어온 집";
export const NEW_PANEL_CAPTION = "아직 검증 전이에요. 다녀오셨다면 확인해주세요";
export const FLAGGED_NOTICE = "알려주셔서 고마워요";

interface NewPlacesPanelProps {
  /** 7일 이내 등록, 최신순 (뷰포트 무관) */
  places: readonly Place[];
  now: string;
  checkedIds: ReadonlySet<string>;
  onOpen: (id: string) => void;
  onPatchPlace: (place: Place) => void;
  onChecked: (placeId: string) => void;
  onNotice: (message: string) => void;
}

/**
 * 화면 4 — 심판대 패널 본문. 헤더(제목·캡션)는 시트가 그리고 여기는 행 리스트 + 달라요 사유 시트.
 * 사유 시트는 오버레이 엔트리 하나(로그인 시트와 같은 길) — 뒤로가기 한 번에 시트만 닫힌다.
 */
export function NewPlacesPanel({
  places,
  now,
  checkedIds,
  onOpen,
  onPatchPlace,
  onChecked,
  onNotice,
}: NewPlacesPanelProps) {
  const [flagTarget, setFlagTarget] = useState<Place | null>(null);
  const clearFlag = useCallback(() => {
    setFlagTarget(null);
  }, []);
  const closeFlag = useOverlayHistory(flagTarget !== null, clearFlag);

  const openFlag = useCallback((place: Place) => {
    pushOverlayHistoryEntry();
    setFlagTarget(place);
  }, []);

  const handleFlagged = useCallback(() => {
    closeFlag();
    onNotice(FLAGGED_NOTICE);
  }, [closeFlag, onNotice]);

  return (
    <>
      <ul aria-label={NEW_PANEL_TITLE} className="divide-y divide-line-hairline pb-safe-bottom-or-3">
        {places.map((place) => (
          <NewPlaceRow
            key={place.id}
            place={place}
            now={now}
            checked={checkedIds.has(place.id)}
            onOpen={onOpen}
            onPatchPlace={onPatchPlace}
            onChecked={onChecked}
            onFlag={openFlag}
            onNotice={onNotice}
          />
        ))}
      </ul>
      {flagTarget && <FlagSheet place={flagTarget} onFlagged={handleFlagged} onClose={closeFlag} />}
    </>
  );
}
