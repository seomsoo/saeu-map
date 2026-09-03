"use client";

import { Button } from "@/components/ui/button";
import { ChipButton } from "@/components/ui/chip";
import { TextField } from "@/components/ui/text-field";
import { MAX_PLACE_PHOTOS } from "@/lib/data";
import { SIDE_KEYS, SIDE_LABELS } from "@/lib/places";
import type { Sides } from "@/lib/types";
import { PhotoPicker } from "./photo-picker";
import { StepFrame } from "./step-frame";

export const HOURS_NOTE_MAX = 80;

interface StepExtrasProps {
  photos: readonly File[];
  sides: Sides;
  hoursNote: string;
  submitting: boolean;
  onPhotosChange: (files: File[]) => void;
  onSidesChange: (sides: Sides) => void;
  onHoursNoteChange: (value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}

/**
 * 4단계 — 선택 항목 한 화면 (design 화면 3-4): 사진 / 사이드 3칩 / 영업시간. CTA는 하나 —
 * 아무것도 안 넣었으면 [건너뛰고 등록], 하나라도 넣었으면 [등록하기] (decisions 2026-09-04).
 */
export function StepExtras({
  photos,
  sides,
  hoursNote,
  submitting,
  onPhotosChange,
  onSidesChange,
  onHoursNoteChange,
  onBack,
  onSubmit,
}: StepExtrasProps) {
  const hasExtras =
    photos.length > 0 || SIDE_KEYS.some((key) => sides[key]) || hoursNote.trim().length > 0;
  const label = submitting ? "등록 중…" : hasExtras ? "등록하기" : "건너뛰고 등록";

  return (
    <StepFrame
      step={4}
      title="더 알려주실 게 있나요?"
      caption="모두 선택 사항이에요"
      onBack={onBack}
      footer={
        <Button
          variant="brand"
          size="xl"
          className="w-full"
          disabled={submitting}
          aria-busy={submitting || undefined}
          onClick={onSubmit}
        >
          {label}
        </Button>
      }
    >
      <div className="flex items-baseline justify-between">
        <p className="text-caption-l-regular text-fg-secondary">사진</p>
        <p className="text-caption-l-regular text-fg-tertiary tabular-nums">
          {photos.length}/{MAX_PLACE_PHOTOS}
        </p>
      </div>
      <PhotoPicker files={photos} max={MAX_PLACE_PHOTOS} onChange={onPhotosChange} />

      <p className="mt-7 text-caption-l-regular text-fg-secondary">사이드</p>
      <div role="group" aria-label="사이드" className="mt-1.5 flex flex-wrap gap-1.5 py-1">
        {SIDE_KEYS.map((key) => (
          <ChipButton
            key={key}
            size="sm"
            pressed={sides[key]}
            onClick={() => {
              onSidesChange({ ...sides, [key]: !sides[key] });
            }}
          >
            {SIDE_LABELS[key]}
          </ChipButton>
        ))}
      </div>

      <TextField
        className="mt-7"
        label="영업시간"
        placeholder="예: 새벽 2시까지, 월 휴무"
        maxLength={HOURS_NOTE_MAX}
        value={hoursNote}
        onChange={(e) => {
          onHoursNoteChange(e.target.value);
        }}
        autoComplete="off"
      />
    </StepFrame>
  );
}
