"use client";

import { Button } from "@/components/ui/button";
import { ChipButton } from "@/components/ui/chip";
import { TextField } from "@/components/ui/text-field";
import { MAX_PLACE_PHOTOS } from "@/lib/data";
import { isAllowedNaverPlaceUrl } from "@/lib/naver-links";
import { SIDE_KEYS, SIDE_LABELS } from "@/lib/places";
import type { Sides } from "@/lib/types";
import { PhotoPicker } from "./photo-picker";
import { StepFrame } from "./step-frame";

export const HOURS_NOTE_MAX = 80;
/** 붙여넣기 링크 상한 — naver.me 단축·place 전체 URL 모두 넉넉히 들어간다 */
export const NAVER_URL_MAX = 200;
export const NAVER_URL_ERROR = "네이버 지도 링크만 넣을 수 있어요";

interface StepExtrasProps {
  photos: readonly File[];
  sides: Sides;
  hoursNote: string;
  /** 사용자가 붙여넣은 네이버 지도 링크(선택) */
  naverPlaceUrl: string;
  submitting: boolean;
  onPhotosChange: (files: File[]) => void;
  onSidesChange: (sides: Sides) => void;
  onHoursNoteChange: (value: string) => void;
  onNaverPlaceUrlChange: (value: string) => void;
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
  naverPlaceUrl,
  submitting,
  onPhotosChange,
  onSidesChange,
  onHoursNoteChange,
  onNaverPlaceUrlChange,
  onBack,
  onSubmit,
}: StepExtrasProps) {
  const naverUrl = naverPlaceUrl.trim();
  // 붙여넣는 즉시 알려준다 — 등록 버튼까지 갔다가 실패하면 어디가 틀렸는지 모른다
  const naverUrlError = naverUrl !== "" && !isAllowedNaverPlaceUrl(naverUrl) ? NAVER_URL_ERROR : null;
  const hasExtras =
    photos.length > 0 ||
    SIDE_KEYS.some((key) => sides[key]) ||
    hoursNote.trim().length > 0 ||
    naverUrl !== "";
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
          disabled={submitting || naverUrlError !== null}
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

      {/* 사용자가 붙여넣은 링크만 저장한다 — 좌표로 주소·플레이스를 받아오는 건 지도 API 약관이 막는다
          (규칙 2, decisions 2026-09-08). 이 값이 있으면 상세에 "네이버에서 사진 보기"가 살아난다 */}
      <TextField
        className="mt-7"
        label="네이버 지도 링크"
        placeholder="네이버 지도 → 공유 → 링크 복사"
        inputMode="url"
        maxLength={NAVER_URL_MAX}
        value={naverPlaceUrl}
        error={naverUrlError}
        onChange={(e) => {
          onNaverPlaceUrlChange(e.target.value);
        }}
        autoComplete="off"
      />
      <p className="mt-1.5 text-caption-l-regular text-fg-tertiary">
        넣어주시면 상세에서 네이버 사진을 바로 볼 수 있어요
      </p>
    </StepFrame>
  );
}
