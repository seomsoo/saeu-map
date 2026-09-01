"use client";

import { BottomSheet, type SheetSnap } from "@/components/ui/bottom-sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { LatLng, Place, SortKey } from "@/lib/types";
import { PlaceCard, PlaceCardSkeleton } from "./place-card";
import { SortMenu } from "./sort-menu";
import type { EmptyKind, MapStatus } from "./use-map-screen";

interface PlaceSheetProps {
  status: MapStatus;
  places: Place[];
  count: number;
  now: string;
  userLocation: LatLng | null;
  selectedId: string | null;
  sort: SortKey;
  snap: SheetSnap;
  emptyKind: EmptyKind;
  onSortChange: (sort: SortKey) => void;
  onSnapChange: (snap: SheetSnap) => void;
  onSelect: (id: string) => void;
  onReport: () => void;
  onRetry: () => void;
}

/** 8. 바텀시트 — 핸들 / "지도 내 N곳" / 정렬 / 카드 리스트(4상태). */
export function PlaceSheet({
  status,
  places,
  count,
  now,
  userLocation,
  selectedId,
  sort,
  snap,
  emptyKind,
  onSortChange,
  onSnapChange,
  onSelect,
  onReport,
  onRetry,
}: PlaceSheetProps) {
  const header = (
    <div className="flex w-full items-center justify-between">
      {status === "ready" ? (
        <h2 className="text-[15px] font-semibold text-ink tabular-nums">
          지도 내 {count}곳
        </h2>
      ) : (
        <Skeleton className="h-4 w-20" />
      )}
      <SortMenu value={sort} onChange={onSortChange} />
    </div>
  );

  return (
    <BottomSheet snap={snap} onSnapChange={onSnapChange} header={header} label="가게 목록">
      {status === "loading" && (
        <ul aria-busy="true" aria-label="가게 목록 불러오는 중">
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

      {status === "ready" && places.length === 0 && emptyKind === "bookmarks" && (
        <EmptyState
          title="아직 찜한 곳이 없어요"
          description="가게 상세의 하트로 찜할 수 있어요"
        />
      )}

      {status === "ready" && places.length === 0 && emptyKind === "area" && (
        <EmptyState
          title="이 동네엔 아직 없어요"
          description="아는 새우집이 있다면 제보해주세요"
          action={
            <button
              type="button"
              onClick={onReport}
              className="inline-flex h-10 items-center gap-0.5 rounded-control border border-border-strong bg-surface pl-3 pr-4 text-sm font-medium text-ink"
            >
              <span className="icon-[ci--add-plus] size-4" aria-hidden="true" />
              제보
            </button>
          }
        />
      )}

      {status === "ready" && places.length > 0 && (
        <ul aria-label="가게 목록">
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
