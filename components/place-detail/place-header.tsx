import { TAG_LABELS } from "@/lib/places";
import { relativeCheckLabel } from "@/lib/time";
import type { Place } from "@/lib/types";

/**
 * 2. 상호 — 상호(20 semibold) / "소금구이 · 생새우회 · 마포구"(14) / "어제 확인 · 확인 4회"(12) 세 줄.
 * 위계는 회색 계층으로만 만든다 — 아이콘도 보더도 없다. 닫기 ✕는 시트 헤더에, 확인 버튼은 기여 블록에 있다.
 */
export function PlaceHeader({ place, now }: { place: Place; now: string }) {
  const categories = place.tags.map((tag) => TAG_LABELS[tag]).join(" · ");
  return (
    <div className="px-5 pt-1 pb-5">
      <h2 className="text-title-s-semibold text-fg">{place.name}</h2>
      <p className="mt-0.5 text-body-m-regular text-fg-secondary">
        {categories} · {place.gu}
      </p>
      <p className="mt-1 text-caption-l-regular text-fg-tertiary">
        <span>{relativeCheckLabel(place.lastCheckedAt, now)}</span>
        {" · "}
        <span className="tabular-nums">확인 {place.checkCount}회</span>
      </p>
    </div>
  );
}
