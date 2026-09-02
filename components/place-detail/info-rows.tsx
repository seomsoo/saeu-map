import { Button } from "@/components/ui/button";
import type { Place } from "@/lib/types";

/** 4. 주소 — 도로명 / 지번 + [복사] 작은 아웃라인. */
export function AddressRow({ place, onCopy }: { place: Place; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <span className="icon-[ci--map-pin] size-5 shrink-0 text-fg-tertiary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-body-m-regular text-fg">{place.addressRoad}</p>
        {place.addressJibun && (
          <p className="text-caption-l-regular text-fg-tertiary">{place.addressJibun}</p>
        )}
      </div>
      <Button size="sm" onClick={onCopy} aria-label="주소 복사">
        복사
      </Button>
    </div>
  );
}

/** 5. 영업시간 — 메모 그대로. 없으면 이 행이 입력 입구("영업시간을 알려주세요" ›). "영업 중" 판정은 없다. */
export function HoursRow({ hoursNote, onSuggest }: { hoursNote: string | null; onSuggest: () => void }) {
  if (hoursNote) {
    return (
      <div className="flex items-center gap-3 px-5 py-3">
        <span className="icon-[ci--clock] size-5 shrink-0 text-fg-tertiary" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-body-m-regular text-fg">{hoursNote}</p>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onSuggest}
      className="press flex w-full items-center gap-3 px-5 py-3 text-left"
    >
      <span className="icon-[ci--clock] size-5 shrink-0 text-fg-tertiary" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-body-m-regular text-fg-secondary">
        영업시간을 알려주세요
      </span>
      <span className="icon-[ci--chevron-right] size-4 shrink-0 text-fg-placeholder" aria-hidden="true" />
    </button>
  );
}
