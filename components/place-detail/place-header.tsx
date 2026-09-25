import { isSeoulGu } from "@/lib/gu";
import { checkLabel, TAG_LABELS } from "@/lib/places";
import type { PlaceSummary } from "@/lib/types";

/**
 * 2. 상호 — 상호(20 semibold) / "새우구이 · 생새우회 · 마포구"(14) / "어제 확인 · 확인 4회"(12) 세 줄.
 * 위계는 회색 계층으로만 만든다 — 아이콘도 보더도 없다. 닫기 ✕는 시트 헤더에, 확인 버튼은 기여 블록에 있다.
 */
export function PlaceHeader({ place, now }: { place: PlaceSummary; now: string }) {
  const categories = place.tags.map((tag) => TAG_LABELS[tag]).join(" · ");
  return (
    <div className="px-5 pb-5">
      <h2 className="text-title-s-semibold text-fg">{place.name}</h2>
      <p className="mt-0.5 text-body-m-regular text-fg-secondary">
        {categories} ·{" "}
        {/* 구 페이지로 가는 내부 링크(plan seo-crawlability 3) — /gu/는 서울 25구만 있다. 앱 밖 전체 이동이라 next/link가 아니다(로그인 시트의 약관 링크와 같은 문법) */}
        {isSeoulGu(place.gu) ? (
          <a href={`/gu/${encodeURIComponent(place.gu)}`} className="underline">
            {place.gu}
          </a>
        ) : (
          place.gu
        )}
      </p>
      <p className="mt-1 text-caption-l-regular text-fg-tertiary">
        <span>{checkLabel(place, now)}</span>
        {" · "}
        <span className="tabular-nums">확인 {place.checkCount}회</span>
      </p>
    </div>
  );
}
