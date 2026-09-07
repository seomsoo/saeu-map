"use client";

import type { ReactNode } from "react";
import { BottomSheet, type SheetMode, type SheetSnap } from "@/components/ui/bottom-sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { DropdownChip } from "@/components/ui/dropdown-chip";
import { OutlineButton } from "@/components/ui/outline-button";
import { Button } from "@/components/ui/button";
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
  /** 거리 기준점 — 내 위치 또는 지도 중심. null이면 거리 숨김 */
  origin: LatLng | null;
  selectedId: string | null;
  /** 찜한 가게 id — 카드 하트 상태 */
  bookmarkedIds: readonly string[];
  sort: SortKey;
  snap: SheetSnap;
  /** list = 목록 / detail = 상세(화면 2) / report = 제보(화면 3). 목록 본문은 그동안 hidden으로 유지된다(스크롤·스냅 복원). */
  mode: SheetMode;
  /** 상세 본문 (mode === "detail"일 때) */
  detail: ReactNode;
  /** 제보 패널 (mode === "report"일 때) */
  report?: ReactNode;
  /** 내 활동 패널 (mode === "me"일 때, 화면 5) */
  me?: ReactNode;
  emptyKind: EmptyKind;
  /** 시트 가장자리 위에 얹히는 FAB 줄 (상세 동안은 없음) */
  aside: ReactNode;
  onSortChange: (sort: SortKey) => void;
  onSnapChange: (snap: SheetSnap) => void;
  onDismissDetail: () => void;
  /** 제보 헤더 ✕ (제보 그만두기, 확인 없음) */
  onDismissReport?: (() => void) | undefined;
  /** 내 활동 헤더 ✕ */
  onDismissMe?: (() => void) | undefined;
  onSelect: (id: string) => void;
  /** 카드 하트 — 익명도 토글된다 */
  onToggleBookmark: (id: string) => void;
  /** 데스크탑 카드 hover → 마커 확대 */
  onHover: (id: string | null) => void;
  onDismissEvent: () => void;
  onClearFilters: () => void;
  onReport: () => void;
  onRetry: () => void;
}

const REPORT_ACTION_ICON = <span className="icon-[ci--add-plus] size-4" aria-hidden="true" />;

/** 빈 상태 3종 — EmptyKind에 케이스가 늘면 여기서 컴파일 에러로 잡힌다. */
function renderEmpty(kind: EmptyKind, onReport: () => void, onClearFilters: () => void) {
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
          action={<OutlineButton onClick={onClearFilters}>필터 해제</OutlineButton>}
        />
      );
    case "area":
      return (
        <EmptyState
          title="이 동네엔 아직 없어요"
          description="아는 새우집이 있다면 제보해주세요"
          action={
            <OutlineButton onClick={onReport} className="pl-3">
              {REPORT_ACTION_ICON}
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
 * 상세·제보 모드에선 같은 시트의 내용만 화면 2·3으로 바뀐다 (헤더는 핸들 + ✕).
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
  bookmarkedIds,
  sort,
  snap,
  mode,
  detail,
  report,
  me,
  emptyKind,
  aside,
  onSortChange,
  onSnapChange,
  onDismissDetail,
  onDismissReport,
  onDismissMe,
  onSelect,
  onToggleBookmark,
  onHover,
  onDismissEvent,
  onClearFilters,
  onReport,
  onRetry,
}: PlaceSheetProps) {
  const isDetail = mode === "detail";
  const isReport = mode === "report";
  const isMe = mode === "me";
  const panel = isDetail || isReport || isMe;
  const header = (
    <div className="flex w-full min-w-0 flex-col gap-0.5">
      <div className="flex items-center justify-between gap-3">
        {status === "ready" ? (
          // 데스크탑은 폭이 남아 헤드라인을 한 단 키운다 (design 화면 6 v3)
          <h2 className="min-w-0 truncate text-title-s-semibold text-fg tabular-nums lg:text-title-m-bold">
            {areaLabel} {count}곳
          </h2>
        ) : (
          <Skeleton className="h-7 w-32" />
        )}
        {/* 정렬 — 모바일은 세로 예산 때문에 텍스트 트리거, 데스크탑은 세 갈래가 한눈에 보이는 세그먼트 */}
        <DropdownChip
          label="정렬"
          value={sort}
          options={SORT_OPTIONS}
          onChange={onSortChange}
          appearance="text"
          align="end"
          className="lg:hidden"
        />
      </div>
      <SeasonCounter stats={stats} />
      <Segmented
        label="정렬"
        value={sort}
        options={SORT_OPTIONS}
        onChange={onSortChange}
        className="mt-3 hidden lg:flex"
      />
    </div>
  );

  return (
    <BottomSheet
      mode={mode}
      snap={snap}
      onSnapChange={onSnapChange}
      onDismiss={isReport ? onDismissReport : isMe ? onDismissMe : onDismissDetail}
      header={header}
      aside={aside}
      label={isReport ? "가게 제보" : isDetail ? "가게 상세" : isMe ? "내 활동" : "가게 목록"}
      handleLabel={
        isReport
          ? "제보 크기 조절"
          : isDetail
            ? "상세 크기 조절"
            : isMe
              ? "내 활동 크기 조절"
              : "목록 크기 조절"
      }
      dismissLabel={isReport ? "제보 그만두기" : isMe ? "내 활동 닫기" : "상세 닫기"}
    >
      {isDetail && detail}
      {isReport && report}
      {isMe && me}

      <div hidden={panel}>
        {eventCard && <EventCard card={eventCard} onDismiss={onDismissEvent} />}

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

        {status === "ready" && places.length === 0 && renderEmpty(emptyKind, onReport, onClearFilters)}

        {status === "ready" && places.length > 0 && (
          <>
            {/* 카드 사이는 헤어라인이 아니라 여백으로 나눈다 (design 화면 1 카드, 2026-09-08) */}
            <ul aria-label="가게 목록" className="pb-safe-bottom-or-3">
              {places.map((place) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  now={now}
                  origin={origin}
                  selected={place.id === selectedId}
                  onSelect={onSelect}
                  onHoverChange={onHover}
                  bookmarked={bookmarkedIds.includes(place.id)}
                  onToggleBookmark={onToggleBookmark}
                />
              ))}
            </ul>
            {/* 목록 끝 제보 CTA — 다 훑고 "여긴 없네" 하는 순간이 제보 동기가 가장 높다.
                데스크탑만: 모바일은 FAB 줄의 [＋ 제보]가 그 자리다(채운 레드는 화면당 한 곳) */}
            <div className="hidden px-5 pt-1 pb-8 lg:block">
              <Button variant="brand" size="xl" className="w-full" onClick={onReport}>
                {REPORT_ACTION_ICON}
                아는 새우집 제보하기
              </Button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
