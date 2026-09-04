"use client";

import { Button } from "@/components/ui/button";
import { TAG_LABELS, formatPrice, primaryMenu, unitChipLabel } from "@/lib/places";
import type { Place } from "@/lib/types";
import { StepFrame } from "./step-frame";

interface StepDoneProps {
  place: Place;
  onOpen: () => void;
  onShare: () => void;
  onReview: () => void;
}

/** 대표 메뉴 한 줄 — "왕새우 소금구이 1kg 35,000원" */
function menuLine(place: Place): string | null {
  const menu = primaryMenu(place);
  if (!menu) return null;
  return [menu.name, unitChipLabel(menu), menu.price !== null ? `${formatPrice(menu.price)}원` : null]
    .filter(Boolean)
    .join(" ");
}

/** 완료 (design 화면 3-5): 요약 카드 + [공유] 아이콘, CTA [내 핀 보러가기], 리뷰 유도 링크(Phase 4까지 준비 중). */
export function StepDone({ place, onOpen, onShare, onReview }: StepDoneProps) {
  const menu = menuLine(place);
  return (
    <StepFrame
      step="done"
      title="등록됐어요!"
      caption="지도에 바로 보여요. 7일간 '새로 제보됨' 표시가 붙어요"
      footer={
        <>
          <button
            type="button"
            onClick={onReview}
            className="press mx-auto mb-3 block text-body-m-regular text-fg-secondary"
          >
            리뷰도 남겨볼래요?
          </button>
          <Button variant="brand" size="xl" className="w-full" onClick={onOpen}>
            내 핀 보러가기
          </Button>
        </>
      }
    >
      <div
        aria-label="등록한 가게"
        className="flex items-start gap-3 rounded-12 border border-line-hairline p-4"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-l-semibold text-fg">{place.name}</p>
          <p className="mt-0.5 truncate text-caption-l-regular text-fg-tertiary">
            {[place.gu, ...place.tags.map((t) => TAG_LABELS[t])].join(" · ")}
          </p>
          {menu && <p className="mt-2 text-body-m-regular text-fg tabular-nums">{menu}</p>}
        </div>
        <button
          type="button"
          onClick={onShare}
          aria-label="공유"
          className="press -mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center text-fg-secondary"
        >
          <span className="icon-[ci--share-outline] size-5" aria-hidden="true" />
        </button>
      </div>
    </StepFrame>
  );
}
