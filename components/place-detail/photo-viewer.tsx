"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Toast } from "@/components/ui/toast";
import type { PhotoReportReason } from "@/lib/data";
import { formatKstDate } from "@/lib/time";
import type { Photo } from "@/lib/types";
import { PhotoReportSheet } from "./photo-report-sheet";
import { PHOTO_REPORT_FAILED_NOTICE } from "./use-place-detail";

/** 실패 토스트가 떠 있는 시간 — 지도 화면 토스트와 같다 */
const NOTICE_MS = 2000;

interface PhotoViewerProps {
  photos: Photo[];
  /** 스트립에서 누른 사진 */
  initialIndex: number;
  placeName: string;
  onClose: () => void;
  /** 성공하면 부모가 뷰어를 닫고 토스트까지 낸다 — 여기서는 실패만 처리한다. */
  onReport: (photoId: string, reason: PhotoReportReason) => Promise<void>;
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
export function PhotoViewer({
  photos,
  initialIndex,
  placeName,
  onClose,
  onReport,
}: PhotoViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(initialIndex);
  const [failedIds, setFailedIds] = useState<readonly string[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [pending, setPending] = useState<PhotoReportReason | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | null>(null);

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

  useEffect(
    () => () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    },
    [],
  );

  const current = photos[Math.min(index, photos.length - 1)];

  const submitReport = useCallback(
    (reason: PhotoReportReason) => {
      if (pending !== null || !current) return;
      setPending(reason);
      onReport(current.id, reason)
        // 성공 처리(뷰어 닫기 + 토스트)는 부모 몫이다. 실패는 여기서 — 뷰어를 닫아 버리면
        // 무엇이 실패했는지 사라지고, 지도 화면 토스트는 top layer에 가려 안 보인다.
        .catch(() => {
          setPending(null);
          setNotice(PHOTO_REPORT_FAILED_NOTICE);
          if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
          noticeTimer.current = window.setTimeout(() => {
            setNotice(null);
          }, NOTICE_MS);
        });
    },
    [pending, current, onReport],
  );

  if (!current) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-label={`${placeName} 사진 크게 보기`}
      onClose={onClose}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none bg-bg-immersive p-0 text-fg-on-immersive backdrop:bg-bg-immersive"
    >
      <div className="flex h-full flex-col">
        {/* 컨트롤은 전부 raised 알약 위에 올린다 — 흰 사진이 뒤에 오면 맨 흰 아이콘은 사라진다 */}
        <div className="flex shrink-0 items-center justify-between gap-3 px-3 pt-safe-top-or-3">
          <button
            type="button"
            onClick={requestClose}
            aria-label="사진 닫기"
            className="press flex size-11 items-center justify-center rounded-max bg-bg-immersive-raised"
          >
            <span className="icon-[ci--close-md] size-6" aria-hidden="true" />
          </button>
          <p
            aria-live="polite"
            className="inline-flex h-8 items-center rounded-max bg-bg-immersive-raised px-3 text-caption-l-medium tabular-nums"
          >
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

        {/* 좋아요·공유는 두지 않는다 — 크게 보기와 잘못된 사진 걸러내기 둘뿐인 화면 */}
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-3 pb-safe-bottom-or-3">
          <p className="text-body-m-medium tabular-nums">
            {formatKstDate(current.uploadedAt)}
            <span className="text-body-m-regular text-fg-on-immersive-secondary"> 등록</span>
          </p>
          <button
            type="button"
            onClick={() => {
              setReportOpen(true);
            }}
            className="press flex h-11 shrink-0 items-center gap-1.5 rounded-max bg-bg-immersive-raised px-4 text-body-m-medium"
          >
            <span className="icon-[ci--flag] size-4" aria-hidden="true" />
            신고
          </button>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0">
        <div className="px-5 pb-3">
          <Toast message={notice} />
        </div>
        {reportOpen && (
          <PhotoReportSheet
            pending={pending}
            onSelect={submitReport}
            onClose={() => {
              setReportOpen(false);
            }}
          />
        )}
      </div>
    </dialog>,
    document.body,
  );
}
