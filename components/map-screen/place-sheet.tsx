"use client";

import type { ReactNode } from "react";
import { BottomSheet, type SheetMode, type SheetSnap } from "@/components/ui/bottom-sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { DropdownChip } from "@/components/ui/dropdown-chip";
import { OutlineButton } from "@/components/ui/outline-button";
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
  /** 거리 기준점 — 내 위치 또는 지도 중심. null이면 거리 숨김 */
  origin: LatLng | null;
  selectedId: string | null;
  sort: SortKey;
  snap: SheetSnap;
  /** list = 목록 / detail = 상세(화면 2). 목록 본문은 상세 동안 hidden으로 유지된다(스크롤·스냅 복원). */
  mode: SheetMode;
  /** 상세 본문 (mode === "detail"일 때) */
  detail: ReactNode;
  emptyKind: EmptyKind;
  /** 시트 가장자리 위에 얹히는 FAB 줄 (상세 동안은 없음) */
  aside: ReactNode;
  onSortChange: (sort: SortKey) => void;
  onSnapChange: (snap: SheetSnap) => void;
  onDismissDetail: () => void;
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

/**
 * 4~7. 바텀시트 — 핸들 / 제목 "지역 N곳" + 정렬 트리거 / 캡션 시즌 카운터 / 이벤트 배너 / 카드 리스트(4상태).
 * 상세 모드에선 같은 시트의 내용만 화면 2로 바뀐다 (헤더는 핸들만).
 */
export function PlaceSheet({
  status,
  places,
  count,
  areaLabel,
  stats,
  eventCard,
  now,
  origin,
  selectedId,
  sort,
  snap,
  mode,
  detail,
  emptyKind,
  aside,
  onSortChange,
  onSnapChange,
  onDismissDetail,
  onSelect,
  onDismissEvent,
  onClearChips,
  onReport,
  onRetry,
}: PlaceSheetProps) {
  const isDetail = mode === "detail";
  const header = (
    <div className="flex w-full min-w-0 flex-col gap-0.5">
      <div className="flex items-center justify-between gap-3">
        {status === "ready" ? (
          <h2 className="min-w-0 truncate text-title-s-semibold text-fg tabular-nums">
            {areaLabel} {count}곳
          </h2>
        ) : (
          <Skeleton className="h-7 w-32" />
        )}
        <DropdownChip
          label="정렬"
          value={sort}
          options={SORT_OPTIONS}
          onChange={onSortChange}
          appearance="text"
          align="end"
        />
      </div>
      <SeasonCounter stats={stats} />
    </div>
  );

  return (
    <BottomSheet
      mode={mode}
      snap={snap}
      onSnapChange={onSnapChange}
      onDismiss={onDismissDetail}
      header={header}
      aside={aside}
      label={isDetail ? "가게 상세" : "가게 목록"}
      handleLabel={isDetail ? "상세 크기 조절" : "목록 크기 조절"}
    >
      {isDetail && detail}

      <div hidden={isDetail}>
        {eventCard && <EventCard card={eventCard} onDismiss={onDismissEvent} />}

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
                origin={origin}
                selected={place.id === selectedId}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </div>
    </BottomSheet>
  );
}
