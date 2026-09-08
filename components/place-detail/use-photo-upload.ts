"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [optimistic, setOptimistic] = useState<{ place: Place; urls: readonly string[] } | null>(null);
  const pendingRef = useRef(false);

  /*
   * 미리보기 URL은 **다음 렌더가 커밋된 뒤** 되돌린다. `finally`에서 바로 revoke하면 화면이 아직 그 URL을
   * 가리키는 한 프레임이 남아, 스크롤·리사이즈로 재디코드될 때 사진이 깨진다(security-reviewer 2026-09-08).
   * effect 정리는 `optimistic`이 바뀐 뒤(=DOM이 확정 URL로 교체된 뒤)에 돌아 그 창을 없앤다 —
   * PhotoPicker가 미리보기를 정리하는 규칙과 같다.
   */
  useEffect(() => {
    const urls = optimistic?.urls;
    return () => {
      for (const url of urls ?? []) URL.revokeObjectURL(url);
    };
  }, [optimistic]);

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
      setOptimistic({
        place: { ...base, photos, thumbnailUrl: photos[0]?.url ?? null },
        urls: preview.map((photo) => photo.url),
      });
      addPlacePhotos(base.id, picked, now)
        .then(
          (updated) => {
            /*
             * 상세가 닫힌 뒤에 와도 그대로 확정한다 — 쓰기는 이미 일어났고 가게 데이터의 진실은 부모다
             * ("다녀왔어요"의 useCheckIn과 같은 규칙). 시트를 닫거나 단계를 옮기는 콜백이 아니라서
             * alive 가드를 두지 않는다(CLAUDE.md 비동기 가드는 "아직 그 화면인가"가 결과를 바꿀 때의 규칙).
             */
            onPatchPlace(updated);
            onNotice(PHOTO_UPLOADED_NOTICE);
          },
          () => {
            onNotice(PHOTO_UPLOAD_FAILED_NOTICE);
          },
        )
        .finally(() => {
          pendingRef.current = false;
          setOptimistic(null);
        });
    },
    [place, now, onPatchPlace, onNotice],
  );

  return { place: optimistic?.place ?? place, uploadPhotos };
}
