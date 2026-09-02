import { TAG_LABELS } from "@/lib/places";
import type { Place } from "@/lib/types";

/** 2. 상호 행 — 상호(20 semibold) / "소금구이 · 생새우회 · 마포구" 텍스트 태그(색점 없음) / 오른쪽 닫기 ×. */
export function PlaceHeader({ place, onClose }: { place: Place; onClose: () => void }) {
  const categories = place.tags.map((tag) => TAG_LABELS[tag]).join(" · ");
  return (
    <div className="flex items-start gap-3 px-5 pt-4 pb-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-title-s-semibold text-fg">{place.name}</h2>
        <p className="mt-0.5 text-body-m-regular text-fg-secondary">
          {categories} · {place.gu}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="상세 닫기"
        className="-mt-1 -mr-2 flex size-8 shrink-0 items-center justify-center text-fg-tertiary hit-44"
      >
        <span className="icon-[ci--close-md] size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
