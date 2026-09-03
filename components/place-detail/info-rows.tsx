import { Button } from "@/components/ui/button";
import type { Place } from "@/lib/types";
import { EditButton } from "./edit-button";

interface PlaceInfoProps {
  place: Place;
  onCopy: () => void;
  onSuggestHours: () => void;
}

/**
 * 3. 정보 블록 — 도로명(14 fg) / 지번(12 fg-tertiary) / 영업시간(14 fg-secondary) 한 덩어리.
 * 행마다 아이콘 + 헤어라인으로 나누던 걸 합쳤다: 아이콘은 액션에만 쓰고, 위계는 회색 계층으로만 만든다.
 * 영업시간이 없을 때만 눈에 띄는 인라인 입구가 된다("영업 중" 판정은 하지 않는다).
 */
export function PlaceInfo({ place, onCopy, onSuggestHours }: PlaceInfoProps) {
  return (
    <div className="px-5 pb-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-body-m-regular text-fg">{place.addressRoad}</p>
          {place.addressJibun && (
            <p className="mt-0.5 text-caption-l-regular text-fg-tertiary">{place.addressJibun}</p>
          )}
        </div>
        <Button size="sm" onClick={onCopy} aria-label="주소 복사">
          복사
        </Button>
      </div>

      {place.hoursNote ? (
        <div className="mt-1.5 flex items-center gap-3">
          <p className="min-w-0 flex-1 text-body-m-regular text-fg-secondary">{place.hoursNote}</p>
          <EditButton label="영업시간 수정" onClick={onSuggestHours} />
        </div>
      ) : (
        <button
          type="button"
          onClick={onSuggestHours}
          className="press mt-1.5 flex w-full items-center gap-1 text-left"
        >
          <span className="min-w-0 flex-1 text-body-m-regular text-fg-secondary">
            영업시간을 알려주세요
          </span>
          <span
            className="icon-[ci--chevron-right] size-4 shrink-0 text-fg-placeholder"
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  );
}
