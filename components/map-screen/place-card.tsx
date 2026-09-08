"use client";

import Image from "next/image";
import { memo, useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { SubwayBadge } from "@/components/place-detail/subway-badge";
import { numericLines } from "@/components/place-detail/station-line";
import { Chip } from "@/components/ui/chip";
import { ShrimpIcon } from "@/components/ui/icons/shrimp-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { TAG_LABELS, distanceKm, primaryMenuParts, sideChips } from "@/lib/places";
import { formatDistance } from "@/lib/geo";
import { formatRating } from "@/lib/reviews";
import { relativeCheckLabel } from "@/lib/time";
import type { LatLng, Place } from "@/lib/types";
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
  /** 데스크탑 hover ↔ 마커 확대 (design 화면 6). 마우스만 — 터치 탭이 내는 에뮬레이션 hover는 무시. null = 떠남 */
  onHoverChange?: ((id: string | null) => void) | undefined;
  /** 목록 카드의 찜 하트. 익명도 토글된다(3개째에 로그인 넛지만 뜬다 — spec 5 "벽은 아님") */
  bookmarked?: boolean | undefined;
  onToggleBookmark?: ((id: string) => void) | undefined;
}

/** 썸네일 타일 72px — 사진 없는 집(콤팩트 행)만 쓴다. 마커 플레이스홀더와 같은 톤(가라앉은 배경 + 새우). */
export function PlaceThumbnail({ place }: { place: Place }) {
  return (
    <div className="flex size-18 shrink-0 items-center justify-center overflow-hidden rounded-12 bg-bg-sunken">
      {place.thumbnailUrl ? (
        // next.config images.unoptimized — 업로드 시 리사이즈본을 쓰므로 플랫폼 최적화 없이 그대로 그린다
        <Image
          src={place.thumbnailUrl}
          alt=""
          width={72}
          height={72}
          draggable={false}
          className="size-full object-cover"
        />
      ) : (
        // 사진 없음 — 새우 플레이스홀더. 카테고리는 카드 메타 줄이, 마커에선 바깥 링이 말한다
        <Image src="/shrimp.webp" alt="" width={44} height={44} draggable={false} aria-hidden="true" />
      )}
    </div>
  );
}

/** 오른쪽 끝 상태 — 신규 라벨 또는 "○일 전 확인" */
function CheckLabel({ place, now }: { place: Place; now: string }) {
  return place.isNew ? (
    <Chip size="xs" tone="active">
      새로 제보됨
    </Chip>
  ) : (
    <span className="shrink-0 pt-0.5 text-caption-l-medium text-fg-tertiary">
      {relativeCheckLabel(place.lastCheckedAt, now)}
    </span>
  );
}

/** 평점 — 리뷰 3개 이상일 때만 채워진다(lib/data가 집계). 마크는 별이 아니라 새우다. */
function Rating({ place }: { place: Place }) {
  if (!place.rating) return null;
  return (
    <span
      className="flex items-center gap-1 text-caption-l-semibold text-fg tabular-nums"
      aria-label={`별점 ${formatRating(place.rating.average)}점, 리뷰 ${String(place.rating.count)}개`}
    >
      <ShrimpIcon className="size-3.5 translate-y-px text-brand-fg" />
      {formatRating(place.rating.average)}
      <span className="font-normal text-fg-tertiary">({place.rating.count})</span>
    </span>
  );
}

/** "850m · 마포구 · 새우구이 │ 〔2〕당산역 200m" — 거리와 역이 훑어보기의 두 축이다. */
function MetaLine({ place, origin }: { place: Place; origin: LatLng | null }) {
  const distance = origin ? formatDistance(distanceKm(place, origin)) : null;
  const categories = place.tags.map((tag) => TAG_LABELS[tag]).join(" · ");
  const station = place.nearestStation;
  return (
    <p className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-caption-l-regular text-fg-secondary tabular-nums">
      <span className="truncate">
        {distance && <span className="font-medium text-fg">{distance} · </span>}
        {place.gu} · {categories}
      </span>
      {station && (
        // 구분 헤어라인은 역 묶음 **안**에 둔다 — 형제로 두면 줄이 접힐 때 앞줄 끝에 홀로 남는다
        <span className="flex shrink-0 items-center gap-1">
          <span className="mr-0.5 h-2.5 w-px bg-line-strong" aria-hidden="true" />
          {numericLines(station.lines).map((line) => (
            <SubwayBadge key={line} line={line} />
          ))}
          {station.name} {formatDistance(station.distanceM / 1000)}
        </span>
      )}
    </p>
  );
}

/** 대표 메뉴 — 가격을 앞세우고 이름은 보조로. 가격 미상이면 줄 자체가 없다. */
function PriceLine({ place, compact }: { place: Place; compact?: boolean }) {
  const menu = primaryMenuParts(place);
  if (!menu) return null;
  return (
    <p
      className={cx(
        "mt-2 truncate tabular-nums text-fg",
        compact ? "text-body-m-semibold" : "text-body-l-semibold",
      )}
    >
      {menu.price}
      <span className="ml-1.5 text-caption-l-regular font-normal text-fg-secondary">{menu.name}</span>
    </p>
  );
}

function SideChips({ place }: { place: Place }) {
  const sides = sideChips(place.sides).filter((s) => s.active);
  if (sides.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="사이드">
      {sides.map((s) => (
        <li key={s.key}>
          <Chip size="xs" tone="muted">
            {s.label}
          </Chip>
        </li>
      ))}
    </ul>
  );
}

/**
 * 7. 카드 — **사진 유무로 두 벌**(design 화면 1, 2026-09-08). 사진이 있으면 16:9 사진 카드로 올라오고,
 * 없으면 썸네일 72 콤팩트 행이다. 사진이 쌓이면 리스트는 레이아웃 변경 없이 화보가 된다.
 * 두 벌 모두 상호 / 거리·구·카테고리·역 / 대표 메뉴 가격 / 사이드 칩 + 평점을 같은 순서로 담는다.
 * 카드 사이는 헤어라인이 아니라 여백으로 나뉜다.
 */
export const PlaceCard = memo(function PlaceCard({
  place,
  now,
  origin,
  selected,
  onSelect,
  trailing,
  onHoverChange,
  bookmarked = false,
  onToggleBookmark,
}: PlaceCardProps) {
  const ref = useRef<HTMLLIElement | null>(null);
  const hover = (id: string | null) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse") onHoverChange?.(id);
  };

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const photo = place.thumbnailUrl;
  const cardClass = cx(
    "block w-full rounded-16 p-2 text-left transition-colors",
    selected ? "bg-bg-sunken" : "hover:bg-bg-dim active:bg-bg-dim",
  );

  return (
    <li ref={ref} data-place-id={place.id} className="relative px-3 py-1">
      <button
        type="button"
        onClick={() => {
          onSelect(place.id);
        }}
        aria-current={selected ? "true" : undefined}
        aria-label={`${place.name}, ${place.gu}`}
        onPointerEnter={onHoverChange && hover(place.id)}
        onPointerLeave={onHoverChange && hover(null)}
        className={cx(
          cardClass,
          trailing !== undefined && "pr-14",
          // 콤팩트 행의 하트는 글자와 같은 줄에 겹친다 — 하트(32) + 간격(8)만큼 자리를 비운다.
          // 사진 카드의 하트는 사진 위에 있어 글자를 침범하지 않는다.
          !photo && onToggleBookmark && "pr-10",
        )}
      >
        {photo ? (
          <>
            <span className="block aspect-video overflow-hidden rounded-12 bg-bg-sunken">
              <Image
                src={photo}
                alt=""
                width={392}
                height={220}
                draggable={false}
                className="size-full object-cover"
              />
            </span>
            <span className="mt-3 flex items-start justify-between gap-3">
              <h3 className="min-w-0 truncate text-body-l-semibold text-fg">{place.name}</h3>
              <CheckLabel place={place} now={now} />
            </span>
            <MetaLine place={place} origin={origin} />
            <PriceLine place={place} />
            <span className="mt-2.5 flex items-center gap-2">
              <SideChips place={place} />
              <Rating place={place} />
            </span>
          </>
        ) : (
          <span className="flex gap-3.5">
            <PlaceThumbnail place={place} />
            <span className="min-w-0 flex-1">
              <span className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 truncate text-body-l-semibold text-fg">{place.name}</h3>
                <CheckLabel place={place} now={now} />
              </span>
              <MetaLine place={place} origin={origin} />
              <PriceLine place={place} compact />
              <span className="mt-2 flex items-center gap-2">
                <SideChips place={place} />
                <Rating place={place} />
              </span>
            </span>
          </span>
        )}
      </button>
      {trailing !== undefined && (
        <div className="absolute top-1/2 right-5 -translate-y-1/2">{trailing}</div>
      )}
      {/* 하트는 카드 버튼의 **형제**다 — 버튼 안에 버튼을 넣지 않는다.
          자리는 카드 여백에서 계산한다: li px-3(12) + 카드 p-2(8) = 사진 모서리, 거기서 8 안쪽 */}
      {onToggleBookmark && (
        <button
          type="button"
          aria-label={`${place.name} ${bookmarked ? "찜 해제" : "찜하기"}`}
          aria-pressed={bookmarked}
          onClick={() => {
            onToggleBookmark(place.id);
          }}
          className={cx(
            "absolute z-1 flex size-8 items-center justify-center rounded-max",
            photo ? "top-5 right-7 bg-bg shadow-float" : "top-1/2 right-5 -translate-y-1/2",
          )}
        >
          <span
            className={cx(
              "size-4.5",
              bookmarked
                ? "icon-[ci--heart-fill] text-brand"
                : "icon-[ci--heart-outline] text-fg-tertiary",
            )}
            aria-hidden="true"
          />
        </button>
      )}
    </li>
  );
});

/** 카드 로딩 스켈레톤 — 콤팩트 행과 같은 높이 리듬. */
export function PlaceCardSkeleton() {
  return (
    <li aria-hidden="true" className="px-3 py-1">
      <div className="flex gap-3.5 p-2">
        <Skeleton className="size-18 shrink-0 rounded-12" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-4 w-14" />
          </div>
          <Skeleton className="mt-2 h-4 w-3/5" />
          <Skeleton className="mt-2.5 h-5 w-2/5" />
        </div>
      </div>
    </li>
  );
}
