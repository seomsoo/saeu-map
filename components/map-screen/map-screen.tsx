"use client";

import { useCallback, useRef } from "react";
import { SessionProvider, useSession } from "@/components/auth/session-provider";
import { MapView, type MapHandle } from "@/components/map/map-view";
import NaverMapProvider from "@/components/map/naver-map-provider";
import { PlaceDetail } from "@/components/place-detail/place-detail";
import { ReportPanel } from "@/components/report/report-panel";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ErrorState } from "@/components/ui/error-state";
import { Toast } from "@/components/ui/toast";
import type {
  EventCard as EventCardData,
  LatLng,
  Place,
  PlaceDetail as PlaceDetailData,
  SeasonStats,
} from "@/lib/types";
import { CategoryDropdown } from "./category-dropdown";
import { FabRow } from "./fab-row";
import { FilterChips } from "./filter-chips";
import { PlaceSheet } from "./place-sheet";
import { ProfileButton } from "./profile-button";
import { SearchBar } from "./search-bar";
import { useMapScreen } from "./use-map-screen";

export interface MapScreenProps {
  /** 서버 렌더 시각(ISO). 모든 상대 시간 계산의 기준 — 클라이언트에서 new Date() 금지. */
  now: string;
  places: Place[];
  stats: SeasonStats;
  eventCard: EventCardData | null;
  bookmarkedIds: string[];
  /** /place/[id]로 들어왔을 때 처음부터 열려 있는 상세 */
  initialPlaceId?: string | undefined;
  /** 서버가 함께 내려준 상세(리뷰 포함) — SSR HTML에 상세가 들어가고 클라이언트 재요청이 없다 */
  initialDetail?: PlaceDetailData | undefined;
}

function reloadPage() {
  window.location.reload();
}

/**
 * 화면 1 — 풀스크린 지도 + 지도 위 두 층(검색 블록·칩 행) + 바텀시트. 카드·마커를 탭하면 같은 시트가 화면 2(상세)로,
 * [＋ 제보]를 누르면 화면 3(제보)으로 바뀐다. 로고·제보·카운터·이벤트는 지도 위에 두지 않는다 (docs/design.md 화면 1, 2026-09-02 리디자인).
 * 세션(익명/카카오)과 로그인 시트는 SessionProvider가 갖고, 화면 훅은 `useSession()`으로 읽는다(화면 5).
 */
export default function MapScreen(props: MapScreenProps) {
  return (
    <SessionProvider>
      <MapScreenBody {...props} />
    </SessionProvider>
  );
}

function MapScreenBody({
  now,
  places,
  stats,
  eventCard,
  bookmarkedIds,
  initialPlaceId,
  initialDetail,
}: MapScreenProps) {
  const mapRef = useRef<MapHandle | null>(null);
  const topStackRef = useRef<HTMLDivElement | null>(null);
  const { session } = useSession();
  const s = useMapScreen({ places, bookmarkedIds, initialPlaceId, mapRef, topStackRef });

  const detailPlace = s.detailPlace;
  /** 제보 2단계: 지도 빈 곳 탭 = 핀 이동 (드래그는 미세 조정). 다른 단계에선 무시 */
  const { moveReportPin } = s;
  const tapReportPin = useCallback(
    (point: LatLng) => {
      moveReportPin(point, "tap");
    },
    [moveReportPin],
  );
  /** 제보 2단계 주소 검색 — 지도 핸들 경유(표시용, 저장 안 함). 지도가 아직 없으면 실패 상태로 */
  const geocode = useCallback(
    (query: string) =>
      mapRef.current?.geocode(query) ?? Promise.reject(new Error("map not ready")),
    [],
  );

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg-dim">
      {/* 워드마크는 화면에서 뺐다 — 문서 제목·접근성용으로만 */}
      <h1 className="sr-only">새우맵</h1>

      {/* 8. 지도 — 스크립트 실패(ErrorBoundary)·인증 실패(navermap_authFailure) 모두 같은 에러 상태.
          에러 시 지도를 언마운트하지 않고 위에 덮는다: 인증 실패 뒤 SDK의 map.destroy()가 내부에서 throw해
          라우트 에러로 번지기 때문(workerd 프리뷰 :8788에서 재현).
          z-0: 스태킹 컨텍스트를 만들어 SDK의 로고·컨트롤(높은 z-index)이 시트 위로 새지 않게 한다. */}
      <div className="absolute inset-0 z-0">
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
              userLocation={s.userLocation}
              pin={s.reportStep === 2 ? s.reportPin : null} // 핀은 2단계에만 보인다 (좌표는 단계를 오가도 남는다)
              onPinChange={(point) => {
                s.moveReportPin(point, "drag");
              }}
              onMapTap={s.reportStep === 2 ? tapReportPin : undefined}
              onUserPan={s.handleUserPan}
              onAuthFailure={s.handleMapError}
            />
          </NaverMapProvider>
        </ErrorBoundary>
        {s.status === "error" && (
          <div className="absolute inset-0 z-1 bg-bg">
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

      {/* 1~2. 지도 위 상단 스택: 검색 블록 + 칩 행. 빈 곳은 지도 터치가 통과한다.
          제보 중엔 두 층을 숨긴다 — 지도는 핀을 맞추는 용도뿐이고 우리 DB 검색과 주소 검색이 같이 보이면 안 된다(design 화면 3) */}
      <div
        ref={topStackRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2.5 [&>*]:pointer-events-auto"
      >
        {s.mode !== "report" && (
          <>
            <div className="pt-safe-top-or-3 pl-safe-left-or-5 pr-safe-right-or-5">
              <SearchBar
                value={s.query}
                onChange={s.setQuery}
                onClear={s.clearQuery}
                onSubmit={s.submitSearch}
                trailing={<ProfileButton session={session} onClick={s.openMe} />}
              />
            </div>
            {/* 칩 행 전체가 함께 가로 스크롤 — 드롭다운 목록은 포털이라 잘리지 않는다 */}
            <div className="no-scrollbar flex touch-pan-x gap-1.5 overflow-x-auto overflow-y-hidden pb-1 pl-safe-left-or-5 pr-safe-right-or-5">
              <CategoryDropdown tab={s.tab} onChange={s.setTab} />
              <FilterChips chips={s.chips} onToggle={s.toggleChip} />
            </div>
          </>
        )}
        <Toast message={s.notice} />
      </div>

      {/* 3~7. 바텀시트 (+ FAB 줄). 상세·제보가 열리면 FAB는 숨긴다 — 채운 레드는 시트 안 한 곳뿐 */}
      <PlaceSheet
        status={s.status}
        places={s.sorted}
        count={s.inViewCount}
        areaLabel={s.areaLabel}
        stats={stats}
        eventCard={eventCard && !s.eventDismissed ? eventCard : null}
        now={now}
        origin={s.origin}
        selectedId={s.selectedId}
        sort={s.sort}
        snap={s.snap}
        mode={s.mode}
        detail={
          detailPlace && (
            <PlaceDetail
              key={detailPlace.id}
              place={detailPlace}
              now={now}
              bookmarked={s.bookmarkedIds.includes(detailPlace.id)}
              checked={s.checkedIds.has(detailPlace.id)}
              initialReviews={
                initialDetail?.place.id === detailPlace.id ? initialDetail.reviews : undefined
              }
              onPatchPlace={s.patchPlace}
              onChecked={s.markChecked}
              onToggleBookmark={() => {
                s.toggleBookmark(detailPlace.id);
              }}
              onNotice={s.showNotice}
            />
          )
        }
        report={
          s.reportStep !== null && (
            <ReportPanel
              step={s.reportStep}
              places={s.places}
              now={now}
              pin={s.reportPin}
              geocode={geocode}
              onBack={s.backReportStep}
              onStepChange={s.goToReportStep}
              onPinChange={(point) => {
                s.moveReportPin(point, "search");
              }}
              onShowCandidate={s.showReportPair}
              tappedPlaceId={s.reportCandidateId}
              onClearTapped={s.clearReportCandidate}
              onOpenExisting={s.openDetailFromReport}
              onCreated={s.addPlace}
              onNotice={s.showNotice}
            />
          )
        }
        emptyKind={s.emptyKind}
        aside={
          s.mode === "list" ? (
            <FabRow onLocate={s.locateMe} onReport={s.openReport} following={s.following} />
          ) : undefined
        }
        onSortChange={s.setSort}
        onSnapChange={s.setSnap}
        onDismissDetail={s.closeDetail}
        onDismissReport={s.cancelReport}
        onSelect={s.selectFromCard}
        onDismissEvent={s.dismissEvent}
        onClearChips={s.clearChips}
        onReport={s.openReport}
        onRetry={reloadPage}
      />
    </div>
  );
}
