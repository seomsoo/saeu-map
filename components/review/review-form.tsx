"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { PhotoPicker } from "@/components/report/photo-picker";
import { Button } from "@/components/ui/button";
import { useOverlayHistory } from "@/components/ui/use-overlay-history";
import type { Review } from "@/lib/types";
import { StarRatingInput } from "./star-rating-input";
import { REVIEW_TEXT_MAX, useReviewForm, type ReviewSaveResult } from "./use-review-form";

interface ReviewFormProps {
  placeId: string;
  placeName: string;
  now: string;
  /** 있으면 수정 모드 */
  initial?: Review | undefined;
  /** 저장 성공 — 부모가 목록·가게를 갱신하고 토스트를 낸다. 폼은 이어서 스스로 닫힌다 */
  onSaved: (result: ReviewSaveResult) => void;
  /** 히스토리 정리가 끝난 뒤 — 부모는 여기서 언마운트한다 */
  onClose: () => void;
}

/**
 * 화면 5 변형 (b) — 리뷰 폼. 시트·토스트 위 top layer `<dialog>` 전체 화면(사진 뷰어와 같은 자리).
 * 여는 쪽이 오버레이 엔트리를 쌓고, 닫힘(✕·Escape·뒤로가기·저장 뒤)은 전부 `dialog.close()` → `useOverlayHistory`의
 * close → popstate → onClose 한 길이다. 실패는 폼 안 오류 한 줄(지도 화면 토스트는 top layer 뒤라 안 보인다).
 * 높이는 시트와 같은 --vvh/--kb 기준 — 키보드가 뜨면 CTA가 그 위에 앉는다.
 */
export function ReviewForm({ placeId, placeName, now, initial, onSaved, onClose }: ReviewFormProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textId = useId();
  const f = useReviewForm({ placeId, now, initial });
  const close = useOverlayHistory(true, onClose);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const requestClose = () => {
    dialogRef.current?.close();
  };

  const handleSubmit = async () => {
    const result = await f.submit();
    if (result === "invalid" || result === null) return;
    onSaved(result);
    requestClose();
  };

  const title = f.editing ? "리뷰 수정" : "리뷰 남기기";

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-label={title}
      onClose={close}
      className="saeu-overlay-screen m-0 w-full max-w-none bg-bg p-0 text-fg backdrop:bg-bg"
    >
      <div className="flex h-full flex-col">
        <div className="relative flex h-11 shrink-0 items-center justify-center pt-safe-top">
          <button
            type="button"
            onClick={requestClose}
            aria-label="닫기"
            className="press absolute top-0 left-safe-left-or-2 flex size-11 items-center justify-center text-fg"
          >
            <span className="icon-[ci--close-md] size-6" aria-hidden="true" />
          </button>
          <h2 className="text-body-l-semibold text-fg">{title}</h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-6">
          <p className="text-title-s-semibold text-fg">{placeName}</p>
          <p className="mt-1 text-body-m-regular text-fg-secondary">다녀온 이야기를 남겨주세요</p>

          <div className="mt-7">
            <StarRatingInput value={f.rating} onChange={f.pickRating} />
            {f.ratingError ? (
              <p role="alert" className="mt-1 text-caption-l-regular text-brand-fg">
                {f.ratingError}
              </p>
            ) : f.rating > 0 ? (
              <p className="mt-1 text-caption-l-regular text-fg-secondary tabular-nums">{f.rating}점</p>
            ) : (
              <p className="mt-1 text-caption-l-regular text-fg-tertiary">별점을 골라주세요</p>
            )}
          </div>

          <div className="mt-5">
            <label htmlFor={textId} className="block text-caption-l-regular text-fg-secondary">
              후기 (선택)
            </label>
            <div className="mt-1.5 rounded-8 bg-bg-sunken px-4 pt-3 pb-2">
              <textarea
                id={textId}
                value={f.text}
                maxLength={REVIEW_TEXT_MAX}
                onChange={(e) => {
                  f.setText(e.target.value);
                }}
                placeholder="예: 새우가 실하고 머리버터구이는 꼭 시키세요"
                rows={5}
                className="block min-h-30 w-full resize-none bg-transparent text-body-l-regular text-fg outline-none placeholder:text-fg-placeholder"
              />
              <p className="text-right text-caption-l-regular text-fg-tertiary tabular-nums">
                {f.text.length}/{REVIEW_TEXT_MAX}
              </p>
            </div>
          </div>

          {!f.editing && (
            <div className="mt-5">
              <p className="text-caption-l-regular text-fg-secondary">사진 (선택)</p>
              <div className="mt-1.5">
                <PhotoPicker
                  files={f.photo ? [f.photo] : []}
                  max={1}
                  onChange={(files) => {
                    f.setPhoto(files[0] ?? null);
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="relative shrink-0 px-5 pt-3 pb-safe-bottom-or-3">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-full h-5 bg-linear-to-t from-bg to-transparent"
          />
          {f.submitError && (
            <p role="alert" className="mb-2 text-caption-l-regular text-brand-fg">
              {f.submitError}
            </p>
          )}
          <Button
            variant="brand"
            size="xl"
            className="w-full"
            disabled={f.pending}
            aria-busy={f.pending}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {f.pending ? (f.editing ? "저장 중…" : "등록 중…") : f.editing ? "저장하기" : "등록하기"}
          </Button>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
