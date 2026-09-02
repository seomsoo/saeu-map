"use client";

import type { ReactNode } from "react";
import { BottomSheet, type SheetSnap } from "@/components/ui/bottom-sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { OutlineButton } from "@/components/ui/outline-button";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { assertNever } from "@/lib/assert-never";
import { SORT_KEYS, SORT_LABELS } from "@/lib/places";
import type {
  EventCard as EventCardData,
  LatLng,
  Place,
  SeasonStats,
  SortKey,
} from "@/lib/types";
import { EventCard } from "./event-card";
import { PlaceCard, PlaceCardSkeleton } from "./place-card";
import { SeasonCounter } from "./season-counter";
import type { EmptyKind, MapStatus } from "./use-map-screen";

const SORT_OPTIONS = SORT_KEYS.map((key) => ({ key, label: SORT_LABELS[key] }));

interface PlaceSheetProps {
  status: MapStatus;
  places: Place[];
  count: number;
  /** 보고 있는 지역 — "마포구 일대" / "서울 전체" */
  areaLabel: string;
  stats: SeasonStats;
  eventCard: EventCardData | null;
  now: string;
  userLocation: LatLng | null;
  selectedId: string | null;
  sort: SortKey;
  snap: SheetSnap;
  emptyKind: EmptyKind;
  /** 시트 가장자리 위에 얹히는 FAB 줄 */
  aside: ReactNode;
  onSortChange: (sort: SortKey) => void;
  onSnapChange: (snap: SheetSnap) => void;
  onSelect: (id: string) => void;
  onDismissEvent: () => void;
  onClearChips: () => void;
  onReport: () => void;
  onRetry: () => void;
}

/** 빈 상태 3종 — EmptyKind에 케이스가 늘면 여기서 컴파일 에러로 잡힌다. */
function renderEmpty(kind: EmptyKind, onReport: () => void, onClearChips: () => void) {
  switch (kind) {
    case "bookmarks":
      return (
        <EmptyState
          title="아직 찜한 곳이 없어요"
          description="가게 상세의 하트로 찜할 수 있어요"
        />
      );
    case "filter":
      return (
        <EmptyState
          title="조건에 맞는 집이 없어요"
          description="칩을 풀거나 지도를 옮겨보세요"
          action={<OutlineButton onClick={onClearChips}>필터 해제</OutlineButton>}
        />
      );
    case "area":
      return (
        <EmptyState
          title="이 동네엔 아직 없어요"
          description="아는 새우집이 있다면 제보해주세요"
          action={
            <OutlineButton onClick={onReport} className="pl-3">
              <span className="icon-[ci--add-plus] size-4" aria-hidden="true" />
              제보
            </OutlineButton>
          }
        />
      );
    default:
      return assertNever(kind);
  }
}

/** 4~7. 바텀시트 — 핸들 / 제목 "지역 N곳" + 부제 시즌 카운터 / 이벤트 카드 / 정렬 세그먼트 / 카드 리스트(4상태). */
export function PlaceSheet({
  status,
  places,
  count,
  areaLabel,
  stats,
  eventCard,
  now,
  userLocation,
  selectedId,
  sort,
  snap,
  emptyKind,
  aside,
  onSortChange,
  onSnapChange,
  onSelect,
  onDismissEvent,
  onClearChips,
  onReport,
  onRetry,
}: PlaceSheetProps) {
  const header = (
    <div className="flex w-full min-w-0 flex-col gap-0.5">
      {status === "ready" ? (
        <h2 className="truncate text-title-s-semibold text-fg tabular-nums">
          {areaLabel} {count}곳
        </h2>
      ) : (
        <Skeleton className="h-7 w-32" />
      )}
      <SeasonCounter stats={stats} />
    </div>
  );

  return (
    <BottomSheet
      snap={snap}
      onSnapChange={onSnapChange}
      header={header}
      aside={aside}
      label="가게 목록"
    >
      {eventCard && <EventCard card={eventCard} onDismiss={onDismissEvent} />}

      <div className="px-5 pt-3 pb-1">
        <Segmented label="정렬" value={sort} options={SORT_OPTIONS} onChange={onSortChange} />
      </div>

      {status === "loading" && (
        <ul aria-busy="true" aria-label="가게 목록 불러오는 중" className="divide-y divide-line-hairline">
          <PlaceCardSkeleton />
          <PlaceCardSkeleton />
          <PlaceCardSkeleton />
        </ul>
      )}

      {status === "error" && (
        <ErrorState
          title="지도를 불러오지 못했어요"
          description="네트워크 상태를 확인한 뒤 다시 시도해주세요."
          onRetry={onRetry}
        />
      )}

      {status === "ready" && places.length === 0 && renderEmpty(emptyKind, onReport, onClearChips)}

      {status === "ready" && places.length > 0 && (
        <ul aria-label="가게 목록" className="divide-y divide-line-hairline pb-safe-bottom-or-3">
          {places.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              now={now}
              userLocation={userLocation}
              selected={place.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </BottomSheet>
  );
}
