"use client";

import { memo, useEffect, useRef } from "react";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { distanceKm, formatPrice, primaryMenu, sideChips, unitChipLabel } from "@/lib/places";
import { formatDistance } from "@/lib/geo";
import { relativeCheckLabel } from "@/lib/time";
import type { LatLng, Place, PlaceTag } from "@/lib/types";
import { cx } from "@/lib/cx";

interface PlaceCardProps {
  place: Place;
  now: string;
  /** 사용자 위치. 없으면 거리는 숨기고 구만 보여준다 (플랜 결정 1). */
  userLocation: LatLng | null;
  selected: boolean;
  onSelect: (id: string) => void;
}

const DOT_CLASS: Record<PlaceTag, string> = {
  grill: "bg-coral-500",
  raw: "bg-teal-500",
};

/**
 * 7. 카드 — 색점+상호 / 구·거리 / 대표메뉴+단위칩+가격(우측) / 사이드 미니칩 / "○일 전 확인".
 * 신규(7일 이내)는 확인 텍스트 자리에 "새로 제보됨" 틴트 라벨.
 */
export const PlaceCard = memo(function PlaceCard({
  place,
  now,
  userLocation,
  selected,
  onSelect,
}: PlaceCardProps) {
  const ref = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const menu = primaryMenu(place);
  const unit = menu ? unitChipLabel(menu) : null;
  const sides = sideChips(place.sides).filter((s) => s.active);
  const distance = userLocation
    ? formatDistance(distanceKm(place, userLocation))
    : null;

  return (
    <li ref={ref} data-place-id={place.id}>
      <button
        type="button"
        onClick={() => {
          onSelect(place.id);
        }}
        aria-current={selected ? "true" : undefined}
        aria-label={`${place.name}, ${place.gu}`}
        className={cx(
          "block w-full px-5 py-3.5 text-left transition-colors",
          selected ? "bg-bg-sunken" : "active:bg-bg-dim",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="flex shrink-0 items-center gap-0.5" aria-hidden="true">
                {place.tags.map((tag) => (
                  <span
                    key={tag}
                    className={cx("size-1.5 rounded-max", DOT_CLASS[tag])}
                  />
                ))}
              </span>
              <h3 className="truncate text-body-l-semibold text-fg">{place.name}</h3>
            </div>
            <p className="mt-0.5 text-body-m-medium text-fg-secondary tabular-nums">
              {place.gu}
              {distance && ` · ${distance}`}
            </p>
          </div>
          <span className="shrink-0 pt-0.5 text-caption-l-medium text-fg-tertiary">
            {place.isNew ? (
              <Chip size="xs" tone="active">
                새로 제보됨
              </Chip>
            ) : (
              relativeCheckLabel(place.lastCheckedAt, now)
            )}
          </span>
        </div>

        {menu && (
          <p className="mt-2 flex items-center gap-1.5 text-body-m-medium text-fg">
            <span className="min-w-0 truncate">{menu.name}</span>
            {unit && (
              <Chip size="xs" tone="subtle" className="tabular-nums">
                {unit}
              </Chip>
            )}
            {menu.price !== null && (
              <span className="ml-auto shrink-0 text-body-l-semibold tabular-nums">
                {formatPrice(menu.price)}
              </span>
            )}
          </p>
        )}

        {sides.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1" aria-label="사이드">
            {sides.map((s) => (
              <li key={s.key}>
                <Chip size="xs" tone="muted">
                  {s.label}
                </Chip>
              </li>
            ))}
          </ul>
        )}
      </button>
    </li>
  );
});

/** 카드 로딩 스켈레톤 — 카드와 같은 높이 리듬. */
export function PlaceCardSkeleton() {
  return (
    <li aria-hidden="true" className="px-5 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-1/4" />
        </div>
        <Skeleton className="h-4 w-14" />
      </div>
      <Skeleton className="mt-2.5 h-5 w-3/5" />
      <div className="mt-2.5 flex gap-1">
        <Skeleton className="h-5 w-16 rounded-max" />
        <Skeleton className="h-5 w-10 rounded-max" />
      </div>
    </li>
  );
}
