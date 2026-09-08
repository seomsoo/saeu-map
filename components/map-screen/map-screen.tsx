"use client";

import Image from "next/image";
import { useCallback, useRef } from "react";
import { ActivityPanel } from "@/components/activity/activity-panel";
import { SessionProvider, useSession } from "@/components/auth/session-provider";
import { MapControls } from "@/components/map/map-controls";
import { MapView, type MapHandle } from "@/components/map/map-view";
import NaverMapProvider from "@/components/map/naver-map-provider";
import { PlaceDetail } from "@/components/place-detail/place-detail";
import { ReportPanel } from "@/components/report/report-panel";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ErrorState } from "@/components/ui/error-state";
import { Toast } from "@/components/ui/toast";
import { useMediaQuery } from "@/components/ui/use-media-query";
import { DESKTOP_MEDIA_QUERY } from "@/lib/layout";
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
import { useMapScreen, type InitialGu } from "./use-map-screen";

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
  /** /gu/[name]로 들어왔을 때 — 그 구 가게로 지도를 맞추고 목록을 서버에서 채운다 */
  initialGu?: InitialGu | undefined;
}

function reloadPage() {
  window.location.reload();
}

/**
 * 화면 1 — 풀스크린 지도 + 지도 위 두 층(검색 블록·칩 행) + 바텀시트. 카드·마커를 탭하면 같은 시트가 화면 2(상세)로,
 * [＋ 제보]를 누르면 화면 3(제보)으로 바뀐다. 로고·제보·카운터·이벤트는 지도 위에 두지 않는다 (docs/design.md 화면 1, 2026-09-02 리디자인).
 * 세션(익명/카카오)과 로그인 시트는 SessionProvider가 갖고, 화면 훅은 `useSession()`으로 읽는다(화면 5).
 *
 * **데스크탑(1024~, 화면 6~9)은 같은 DOM의 그릇만 CSS로 바꾼다**: 상단 스택 + 시트를 감싼 래퍼가 모바일에선
 * `display: contents`(있는 듯 없는 듯), lg에선 지도 위에 떠 있는 420px 패널이 되고 지도는 두 그릇 모두 풀블리드다. 시트의 fixed·transform은
 * globals.css 데스크탑 블록이 지운다. JS(`isDesktop`)는 데스크탑에만 있는 요소(브랜드 줄 [＋ 제보]·줌 컨트롤·토스트 자리)만 가른다.
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
  initialGu,
}: MapScreenProps) {
  const mapRef = useRef<MapHandle | null>(null);
  const topStackRef = useRef<HTMLDivElement | null>(null);
  const { session } = useSession();
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);
  const s = useMapScreen({ places, bookmarkedIds, initialPlaceId, initialGu, mapRef, topStackRef });

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
      {/* 8. 지도 — 스크립트 실패(ErrorBoundary)·인증 실패(navermap_authFailure) 모두 같은 에러 상태.
          에러 시 지도를 언마운트하지 않고 위에 덮는다: 인증 실패 뒤 SDK의 map.destroy()가 내부에서 throw해
          라우트 에러로 번지기 때문(workerd 프리뷰 :8788에서 재현).
          z-0: 스태킹 컨텍스트를 만들어 SDK의 로고·컨트롤(높은 z-index)이 시트 위로 새지 않게 한다.
          데스크탑도 같은 풀블리드다 — 패널이 그 위에 떠 있다 (design 화면 6 v3, decisions 2026-09-08). */}
      <div className="absolute inset-0 z-0">
        <ErrorBoundary onError={s.handleMapError} fallback={() => null}>
          <NaverMapProvider onMissingConfig={s.handleMissingConfig}>
            <MapView
              items={s.items}
              selectedId={s.selectedId}
              hoveredId={s.hoveredId}
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
        {/* 데스크탑 지도 컨트롤 (design 화면 6): 줌 ± + 현위치. 모바일은 FAB 줄·핀치가 대신한다 */}
        {isDesktop && s.status !== "error" && (
          <MapControls
            onZoomIn={s.zoomIn}
            onZoomOut={s.zoomOut}
            onLocate={s.locateMe}
            following={s.following}
          />
        )}
      </div>

      {/* 패널 래퍼 — 모바일: display contents(상단 스택은 absolute, 시트는 fixed 그대로).
          데스크탑: 지도 위에 떠 있는 카드(여백 16·폭 420·라운드 20·shadow-panel).
          폭·여백은 lib/layout.ts의 PANEL_* 상수와 같아야 한다 — 지도 기하가 그 값으로 보정한다 */}
      <div className="contents lg:absolute lg:inset-y-4 lg:left-4 lg:z-10 lg:flex lg:w-105 lg:flex-col lg:overflow-hidden lg:rounded-20 lg:bg-bg lg:shadow-panel">
        {/* 1~2. 지도 위 상단 스택: 검색 블록 + 칩 행. 빈 곳은 지도 터치가 통과한다.
            제보 중엔 두 층을 숨긴다 — 지도는 핀을 맞추는 용도뿐이고 우리 DB 검색과 주소 검색이 같이 보이면 안 된다(design 화면 3).
            내 활동 패널이 열린 동안도 숨긴다(화면 5). 데스크탑에선 패널 안 정적 블록이다 */}
        <div
          ref={topStackRef}
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2.5 [&>*]:pointer-events-auto lg:static lg:shrink-0"
        >
          {/* 브랜드 줄 (design 화면 6 v3): 모바일에선 sr-only h1만(워드마크는 화면에서 뺐다),
              데스크탑에선 워드마크 + [＋ 제보] **아웃라인**. 채운 레드는 목록 끝 CTA 한 곳이다 —
              워드마크와 레드 버튼이 한 줄에서 경쟁하지 않게 (decisions 2026-09-08) */}
          <div className="sr-only lg:not-sr-only lg:flex lg:h-13 lg:items-center lg:justify-between lg:pl-safe-left-or-5 lg:pr-safe-right-or-5">
            <h1 className="text-title-s-semibold text-fg">
              {/* 워드마크 에셋(사용자 제작 원본 색 그대로 — 브랜드 레드로 맞추면 그림이 죽는다, 2026-09-08).
                  모바일에선 h1이 sr-only라 alt가 곧 이름이다 */}
              <Image
                src="/wordmark.webp"
                alt="새우맵"
                width={137}
                height={60}
                priority
                draggable={false}
                className="h-6.5 w-auto"
              />
            </h1>
            {isDesktop && s.mode === "list" && (
              <Button variant="outline" size="pill" onClick={s.openReport}>
                <span className="icon-[ci--add-plus] size-4" aria-hidden="true" />
                제보
              </Button>
            )}
          </div>
          {s.mode !== "report" && s.mode !== "me" && (
            <>
              <div className="pt-safe-top-or-3 pl-safe-left-or-5 pr-safe-right-or-5 lg:pt-0">
                <SearchBar
                  value={s.query}
                  onChange={s.setQuery}
                  onClear={s.clearQuery}
                  onSubmit={s.submitSearch}
                  trailing={<ProfileButton session={session} onClick={s.openMe} />}
                />
              </div>
              {/* 칩 행 전체가 함께 가로 스크롤 — 드롭다운 목록은 포털이라 잘리지 않는다.
                  **데스크탑은 지도 위 한 층**(design 화면 6 v3): DOM은 패널 안에 두고 `lg:fixed`로 지도 위로 올린다.
                  fixed는 조상 overflow에 잘리지 않으므로 패널의 overflow-hidden을 통과한다 —
                  단 패널에 transform이 생기면 기준이 패널로 바뀐다(그래서 패널은 transform을 갖지 않는다).
                  left는 PANEL_OCCLUSION(436) + 20 = 456 = lg:left-114 */}
              <div className="no-scrollbar flex touch-pan-x gap-1.5 overflow-x-auto overflow-y-hidden pb-1 pl-safe-left-or-5 pr-safe-right-or-5 lg:fixed lg:top-5 lg:left-114 lg:z-20 lg:max-w-160 lg:flex-wrap lg:gap-2 lg:overflow-visible lg:p-0 lg:[&_button]:shadow-float">
                <CategoryDropdown tab={s.tab} onChange={s.setTab} />
                <FilterChips chips={s.chips} onToggle={s.toggleChip} />
              </div>
            </>
          )}
          {/* 토스트(모바일) — 스택 마지막 층. 없을 땐 래퍼도 없다: 빈 래퍼가 gap을 먹는다.
              데스크탑 토스트는 셸 루트에 따로 단다 — 떠 있는 패널이 absolute라 그 안에 두면
              "화면 아래 가운데"가 패널 기준이 되어 패널 안에 뜬다 */}
          {!isDesktop && s.notice && <Toast message={s.notice} />}
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
          bookmarkedIds={s.bookmarkedIds}
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
                autoReview={s.reviewIntentId === detailPlace.id}
                onAutoReviewConsumed={s.clearReviewIntent}
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
          me={
            s.mode === "me" && (
              <ActivityPanel
                now={now}
                tab={s.meTab}
                onTabChange={s.setMeTab}
                bookmarkedPlaces={s.bookmarkedPlaces}
                bookmarksStatus={s.bookmarksStatus}
                onRetryBookmarks={s.retryBookmarks}
                origin={s.origin}
                onOpenPlace={s.selectFromCard}
                onToggleBookmark={s.toggleBookmark}
                onPlaceIdsChange={s.setMePlaceIds}
                onSignedOut={s.handleSignedOut}
                onAccountDeleted={s.handleAccountDeleted}
                onNotice={s.showNotice}
              />
            )
          }
          emptyKind={s.emptyKind}
          aside={
            s.mode === "list" && !isDesktop ? (
              <FabRow onLocate={s.locateMe} onReport={s.openReport} following={s.following} />
            ) : undefined
          }
          onSortChange={s.setSort}
          onSnapChange={s.setSnap}
          onDismissDetail={s.closeDetail}
          onDismissReport={s.cancelReport}
          onDismissMe={s.closeMe}
          onSelect={s.selectFromCard}
          onToggleBookmark={s.toggleBookmark}
          onHover={s.hoverPlace}
          onDismissEvent={s.dismissEvent}
          onClearFilters={s.clearFilters}
          onReport={s.openReport}
          onRetry={reloadPage}
        />
      </div>

      {/* 토스트(데스크탑) — 화면 가운데가 아니라 **패널 바로 오른쪽 아래**(left = PANEL_OCCLUSION + 20).
          안내는 대부분 패널에서 한 행동의 결과라 그 옆에 서야 눈이 따라가고, 우하단 줌·현위치 스택과도
          겹치지 않는다. 지도 위에 뜨므로 그림자를 주고(공통 블록), 폭은 내용만큼 잡는다 */}
      {isDesktop && s.notice && (
        <div className="pointer-events-none absolute bottom-4 left-114 z-30">
          <Toast
            message={s.notice}
            className="saeu-toast-in mx-0 inline-block max-w-100 py-2.5 text-body-m-medium shadow-card"
          />
        </div>
      )}
    </div>
  );
}
