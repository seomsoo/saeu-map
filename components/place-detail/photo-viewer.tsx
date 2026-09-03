"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatKstDate } from "@/lib/time";
import type { Photo } from "@/lib/types";

interface PhotoViewerProps {
  photos: Photo[];
  /** 스트립에서 누른 사진 */
  initialIndex: number;
  placeName: string;
  onClose: () => void;
}

/**
 * 화면 2 변형 (e) — 사진 전체 화면 뷰어.
 *
 * body 포털 + 네이티브 <dialog>.showModal()인 이유 둘:
 *  1. .saeu-sheet가 transform: translateY()라, 시트 안의 position:fixed는 뷰포트가 아니라 시트를 기준으로 잡힌다.
 *  2. top layer는 z 경쟁(시트 z-20, 드롭다운 z-30, 토스트 z-10)을 없애고 포커스 트랩·Escape·포커스 복원을 공짜로 준다.
 *
 * 좌우 넘김은 CSS scroll-snap이다. 바텀시트가 겪은 pointer-capture 리타겟·non-passive touchmove 함정은
 * 전부 "세로 시트 vs 가로 스트립" 경합에서 나온 것인데, 포털된 단독 표면에는 그 경합이 없다.
 */
export function PhotoViewer({ photos, initialIndex, placeName, onClose }: PhotoViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(initialIndex);
  const [failedIds, setFailedIds] = useState<readonly string[]>([]);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // 첫 위치는 scrollLeft 대입으로 — scrollIntoView는 스냅 컨테이너 밖 조상까지 스크롤시킨다
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (track) track.scrollLeft = track.clientWidth * initialIndex;
  }, [initialIndex]);

  const syncIndex = useCallback(() => {
    const track = trackRef.current;
    // 레이아웃 전(jsdom 포함)에는 clientWidth가 0이다 — 0으로 나누지 않는다
    if (!track || track.clientWidth === 0) return;
    setIndex(Math.round(track.scrollLeft / track.clientWidth));
  }, []);

  const requestClose = useCallback(() => {
    // close()가 close 이벤트를 내고, 그 핸들러가 onClose를 부른다 — 닫는 경로를 하나로 유지한다
    dialogRef.current?.close();
  }, []);

  const current = photos[Math.min(index, photos.length - 1)];
  if (!current) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-label={`${placeName} 사진 크게 보기`}
      onClose={onClose}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none bg-immersive p-0 text-fg-on-immersive backdrop:bg-immersive"
    >
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between pt-safe-top-or-3 pr-5 pl-2">
          <button
            type="button"
            onClick={requestClose}
            aria-label="사진 닫기"
            className="press flex size-11 items-center justify-center"
          >
            <span className="icon-[ci--close-md] size-5" aria-hidden="true" />
          </button>
          <p aria-live="polite" className="text-caption-l-regular tabular-nums">
            {index + 1} / {photos.length}
          </p>
        </div>

        {/* 한 장 = 한 화면. 스트립은 cover로 자르지만 여기서는 contain으로 원본 비율을 보여준다. */}
        <ul
          ref={trackRef}
          onScroll={syncIndex}
          className="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-contain"
        >
          {photos.map((photo, i) => (
            <li
              key={photo.id}
              className="flex w-full shrink-0 snap-center items-center justify-center overflow-hidden"
            >
              {failedIds.includes(photo.id) ? (
                <p className="text-body-m-regular">사진을 불러오지 못했어요</p>
              ) : (
                /* 불러오는 동안은 몰입 배경이 그대로 보인다 — 검은 자리가 곧 로딩 상태 */
                <Image
                  src={photo.url}
                  alt={`${placeName} 사진 ${String(i + 1)}`}
                  width={1200}
                  height={900}
                  draggable={false}
                  onError={() => {
                    setFailedIds((ids) => (ids.includes(photo.id) ? ids : [...ids, photo.id]));
                  }}
                  className="max-h-full w-full object-contain"
                />
              )}
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center justify-between px-5 pt-3 pb-safe-bottom-or-3">
          <p className="text-caption-l-regular tabular-nums">{formatKstDate(current.uploadedAt)}</p>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
