import { TAG_LABELS } from "@/lib/places";
import type { Place } from "@/lib/types";

/** 2. 상호 — 상호(20 semibold) / "소금구이 · 생새우회 · 마포구" 텍스트 태그(색점 없음). 닫기 ✕는 시트 헤더에 있다. */
export function PlaceHeader({ place }: { place: Place }) {
  const categories = place.tags.map((tag) => TAG_LABELS[tag]).join(" · ");
  return (
    <div className="px-5 pt-1">
      <h2 className="text-title-s-semibold text-fg">{place.name}</h2>
      <p className="mt-0.5 text-body-m-regular text-fg-secondary">
        {categories} · {place.gu}
      </p>
    </div>
  );
}
