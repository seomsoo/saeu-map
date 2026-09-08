"use client";

import { useCallback, useRef, useState } from "react";
import { MAX_PLACE_PHOTOS, addPlacePhotos } from "@/lib/data";
import type { Photo, Place } from "@/lib/types";

export const PHOTO_UPLOADED_NOTICE = "사진을 올렸어요";
export const PHOTO_UPLOAD_FAILED_NOTICE = "사진을 올리지 못했어요";

/** 미리보기 사진의 임시 id — 서버가 준 id와 섞이지 않게 접두어를 둔다 */
let tempSeq = 0;

interface UsePhotoUploadInput {
  place: Place;
  /** 서버 렌더 시각(ISO) — 낙관적 업로드일의 기준. 클라이언트 Date.now() 금지 */
  now: string;
  onPatchPlace: (place: Place) => void;
  onNotice: (message: string) => void;
}

/**
 * 사진 올리기 — **수정 제안과 달리 즉시 반영이다**(spec 4.2 "예외: 사진(즉시)"). 고른 순간 스트립에 넣고
 * (낙관) 실패하면 빼며 토스트를 낸다 — "다녀왔어요"과 같은 규칙이다.
 * 미리보기 URL은 이 훅이 만든 것이라 확정·실패 양쪽에서 되돌린다(revoke). 확정된 사진은 `lib/data.ts`가
 * 자기 URL을 따로 만들어 들고 있다 — 그래서 여기서 revoke해도 스트립이 깨지지 않는다(decisions 2026-09-08).
 */
export function usePhotoUpload({ place, now, onPatchPlace, onNotice }: UsePhotoUploadInput) {
  const [optimistic, setOptimistic] = useState<Place | null>(null);
  const pendingRef = useRef(false);

  const uploadPhotos = useCallback(
    (files: readonly File[]) => {
      const base = place;
      const room = MAX_PLACE_PHOTOS - base.photos.length;
      // 10장이 차면 UI에 ＋ 타일 자체가 없다 — 여기는 마지막 방어선이다
      if (pendingRef.current || files.length === 0 || room <= 0) return;
      const picked = files.slice(0, room);
      const preview: Photo[] = picked.map((file) => {
        tempSeq += 1;
        return { id: `temp-${String(tempSeq)}`, url: URL.createObjectURL(file), uploadedAt: now };
      });
      pendingRef.current = true;
      const photos = [...base.photos, ...preview];
      setOptimistic({ ...base, photos, thumbnailUrl: photos[0]?.url ?? null });
      addPlacePhotos(base.id, picked, now)
        .then(
          (updated) => {
            onPatchPlace(updated);
            onNotice(PHOTO_UPLOADED_NOTICE);
          },
          () => {
            onNotice(PHOTO_UPLOAD_FAILED_NOTICE);
          },
        )
        .finally(() => {
          for (const photo of preview) URL.revokeObjectURL(photo.url);
          pendingRef.current = false;
          setOptimistic(null);
        });
    },
    [place, now, onPatchPlace, onNotice],
  );

  return { place: optimistic ?? place, uploadPhotos };
}
