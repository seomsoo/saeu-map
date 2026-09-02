"use client";

import Image from "next/image";
import { memo, useEffect, useRef } from "react";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TAG_LABELS,
  distanceKm,
  formatPrice,
  markerCategory,
  primaryMenu,
  sideChips,
  unitChipLabel,
} from "@/lib/places";
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

/** 썸네일 타일 — 사진이 없으면 마커 플레이스홀더와 같은 톤(가라앉은 배경 + 카테고리 색점). */
function Thumbnail({ place }: { place: Place }) {
  return (
    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-12 bg-bg-sunken">
      {place.thumbnailUrl ? (
        // next.config images.unoptimized — 업로드 시 리사이즈본을 쓰므로 플랫폼 최적화 없이 그대로 그린다
        <Image
          src={place.thumbnailUrl}
          alt=""
          width={64}
          height={64}
          draggable={false}
          className="size-full object-cover"
        />
      ) : (
        <span
          className={cx("size-2 rounded-max", DOT_CLASS[markerCategory(place.tags)])}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/**
 * 7. 카드 — 왼쪽 썸네일 + 상호 / 카테고리·구·거리 / 대표메뉴+단위+가격(우측) / 사이드 미니칩 / "○일 전 확인".
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
  const meta = [
    place.tags.map((tag) => TAG_LABELS[tag]).join(" · "),
    place.gu,
    distance,
  ]
    .filter(Boolean)
    .join(" · ");

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
          "flex w-full gap-3 px-5 py-3 text-left transition-colors",
          selected ? "bg-bg-sunken" : "active:bg-bg-dim",
        )}
      >
        <Thumbnail place={place} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 truncate text-body-l-semibold text-fg">{place.name}</h3>
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
          <p className="mt-0.5 truncate text-caption-l-regular text-fg-secondary tabular-nums">
            {meta}
          </p>

          {menu && (
            <p className="mt-1.5 flex items-baseline gap-1.5 text-body-m-regular text-fg">
              <span className="min-w-0 truncate">{menu.name}</span>
              {unit && (
                <span className="shrink-0 text-caption-l-regular text-fg-tertiary tabular-nums">
                  {unit}
                </span>
              )}
              {menu.price !== null && (
                <span className="ml-auto shrink-0 text-body-m-semibold tabular-nums">
                  {formatPrice(menu.price)}
                </span>
              )}
            </p>
          )}

          {sides.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1" aria-label="사이드">
              {sides.map((s) => (
                <li key={s.key}>
                  <Chip size="xs" tone="muted">
                    {s.label}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
        </div>
      </button>
    </li>
  );
});

/** 카드 로딩 스켈레톤 — 카드와 같은 높이 리듬. */
export function PlaceCardSkeleton() {
  return (
    <li aria-hidden="true" className="flex gap-3 px-5 py-3">
      <Skeleton className="size-16 shrink-0 rounded-12" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-14" />
        </div>
        <Skeleton className="mt-1.5 h-4 w-1/2" />
        <Skeleton className="mt-2 h-5 w-3/5" />
      </div>
    </li>
  );
}
