"use client";

import Image from "next/image";
import { memo, useEffect, useRef, type ReactNode } from "react";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { TAG_LABELS, distanceKm, markerCategory, sideChips } from "@/lib/places";
import { formatDistance } from "@/lib/geo";
import { relativeCheckLabel } from "@/lib/time";
import type { LatLng, Place, PlaceTag } from "@/lib/types";
import { cx } from "@/lib/cx";

interface PlaceCardProps {
  place: Place;
  now: string;
  /** 거리 기준점 — 내 위치, 없으면 지도 중심("가까운순"과 같은 기준). null이면 거리 숨김. */
  origin: LatLng | null;
  selected: boolean;
  onSelect: (id: string) => void;
  /** 카드 오른쪽 세로 중앙에 얹히는 액션(내 활동 찜 탭의 하트). 카드 버튼의 형제라 버튼 안에 버튼이 생기지 않는다. */
  trailing?: ReactNode;
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
 * 7. 카드 — 왼쪽 썸네일 + 상호 / "거리 · 구 · 카테고리" / 사이드 미니칩 / "○일 전 확인".
 * 메뉴·가격은 상세에서(카드는 훑어보기 밀도). 신규(7일 이내)는 확인 텍스트 자리에 "새로 제보됨" 틴트 라벨.
 * 평점은 리뷰 3개 이상일 때만 우측에 붙일 자리 (decisions 2026-09-02, 아직 미구현).
 */
export const PlaceCard = memo(function PlaceCard({
  place,
  now,
  origin,
  selected,
  onSelect,
  trailing,
}: PlaceCardProps) {
  const ref = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const sides = sideChips(place.sides).filter((s) => s.active);
  const distance = origin ? formatDistance(distanceKm(place, origin)) : null;
  const categories = place.tags.map((tag) => TAG_LABELS[tag]).join(" · ");

  return (
    <li ref={ref} data-place-id={place.id} className={cx(trailing !== undefined && "relative")}>
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
          trailing !== undefined && "pr-16",
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
            {distance && (
              <>
                <span className="font-medium text-fg">{distance}</span>
                {" · "}
              </>
            )}
            {place.gu} · {categories}
          </p>

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
      {trailing !== undefined && (
        <div className="absolute top-1/2 right-3 -translate-y-1/2">{trailing}</div>
      )}
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
        <Skeleton className="mt-1.5 h-4 w-3/5" />
        <div className="mt-2 flex gap-1">
          <Skeleton className="h-5 w-16 rounded-max" />
          <Skeleton className="h-5 w-10 rounded-max" />
        </div>
      </div>
    </li>
  );
}
