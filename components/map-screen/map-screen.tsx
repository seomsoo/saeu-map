"use client";

import { useRef } from "react";
import { MapView, type MapHandle } from "@/components/map/map-view";
import NaverMapProvider from "@/components/map/naver-map-provider";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ErrorState } from "@/components/ui/error-state";
import type { EventCard as EventCardData, Place, SeasonStats } from "@/lib/types";
import { EventCard } from "./event-card";
import { FilterChips } from "./filter-chips";
import { FilterTabs } from "./filter-tabs";
import { PlaceSheet } from "./place-sheet";
import { SearchBar } from "./search-bar";
import { SeasonCounter } from "./season-counter";
import { TopBar } from "./top-bar";
import { useMapScreen } from "./use-map-screen";

export interface MapScreenProps {
  /** 서버 렌더 시각(ISO). 모든 상대 시간 계산의 기준 — 클라이언트에서 new Date() 금지. */
  now: string;
  places: Place[];
  stats: SeasonStats;
  eventCard: EventCardData | null;
  bookmarkedIds: string[];
}

const REPORT_NOTICE = "제보는 준비 중이에요";

function reloadPage() {
  window.location.reload();
}

/** 화면 1 — 풀스크린 지도 + 위에 얹힌 UI + 바텀시트 (design 화면 1의 1~9). */
export default function MapScreen({
  now,
  places,
  stats,
  eventCard,
  bookmarkedIds,
}: MapScreenProps) {
  const mapRef = useRef<MapHandle | null>(null);
  const topStackRef = useRef<HTMLDivElement | null>(null);
  const s = useMapScreen({ places, bookmarkedIds, mapRef, topStackRef });

  const handleReport = () => {
    s.showNotice(REPORT_NOTICE);
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-surface-dim">
      {/* 7. 지도 — 스크립트 실패(ErrorBoundary)·인증 실패(navermap_authFailure) 모두 같은 에러 상태.
          에러 시 지도를 언마운트하지 않고 위에 덮는다: 인증 실패 뒤 SDK의 map.destroy()가 내부에서 throw해
          라우트 에러로 번지기 때문(workerd 프리뷰 :8788에서 재현). */}
      <div className="absolute inset-0">
        <ErrorBoundary onError={s.handleMapError} fallback={() => null}>
          <NaverMapProvider onMissingConfig={s.handleMissingConfig}>
            <MapView
              items={s.items}
              selectedId={s.selectedId}
              now={now}
              initialCenter={s.initialCenter}
              initialZoom={s.initialZoom}
              handleRef={mapRef}
              onViewportChange={s.handleViewportChange}
              onPlaceClick={s.selectFromMarker}
              onClusterClick={s.handleClusterClick}
              onAuthFailure={s.handleMapError}
            />
          </NaverMapProvider>
        </ErrorBoundary>
        {s.status === "error" && (
          <div className="absolute inset-0 z-[1] bg-surface">
            {s.mapErrorReason === "config" ? (
              <ErrorState
                className="h-full"
                title="지도 설정이 없어요"
                description="NEXT_PUBLIC_NCP_CLIENT_ID가 빌드에 없습니다. .env.local(또는 CI 변수)을 확인해주세요."
              />
            ) : (
              <ErrorState
                className="h-full"
                title="지도를 불러오지 못했어요"
                description="네트워크 상태를 확인한 뒤 다시 시도해주세요."
                onRetry={reloadPage}
              />
            )}
          </div>
        )}
      </div>

      {/* 1~6. 지도 위 상단 스택 — 빈 곳은 지도 터치가 통과한다 */}
      <div
        ref={topStackRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-1.5 px-3 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))] [&>*]:pointer-events-auto"
      >
        <TopBar onReport={handleReport} />
        {s.notice && (
          <p
            role="status"
            className="self-end rounded-control bg-ink px-3 py-1.5 text-xs font-medium text-on-ink shadow-[0_2px_8px_var(--color-shadow)]"
          >
            {s.notice}
          </p>
        )}
        <SearchBar
          value={s.query}
          onChange={s.setQuery}
          onClear={s.clearQuery}
          onSubmit={s.submitSearch}
        />
        <SeasonCounter stats={stats} />
        {eventCard && !s.eventDismissed && (
          <EventCard card={eventCard} onDismiss={s.dismissEvent} />
        )}
        <FilterTabs tab={s.tab} onChange={s.setTab} />
        <FilterChips chips={s.chips} onToggle={s.toggleChip} />
      </div>

      {/* 8~9. 바텀시트 + 카드 */}
      <PlaceSheet
        status={s.status}
        places={s.sorted}
        count={s.inViewCount}
        now={now}
        userLocation={s.userLocation}
        selectedId={s.selectedId}
        sort={s.sort}
        snap={s.snap}
        emptyKind={s.emptyKind}
        onSortChange={s.setSort}
        onSnapChange={s.setSnap}
        onSelect={s.selectFromCard}
        onReport={handleReport}
        onRetry={reloadPage}
      />
    </div>
  );
}
