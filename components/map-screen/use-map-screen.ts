"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { MapHandle } from "@/components/map/map-view";
import { sheetVisiblePx, type SheetMode, type SheetSnap } from "@/components/ui/bottom-sheet";
import { buildPlaceIndex, type ClusterItem } from "@/lib/cluster";
import { toggleBookmark as requestToggleBookmark } from "@/lib/data";
import { boundsOf, inBounds, SEOUL_CENTER } from "@/lib/geo";
import { areaLabel as computeAreaLabel, filterPlaces, isSideChip, sortPlaces } from "@/lib/places";
import type {
  ChipKey,
  LatLng,
  Place,
  SortKey,
  TabKey,
  Viewport,
} from "@/lib/types";

export const INITIAL_ZOOM = 12;
const USER_ZOOM = 14;
const SEARCH_FIT_MAX_ZOOM = 16;
/** 서울·근교. 위치가 이 밖이면 거리 정렬에만 쓰고 지도는 옮기지 않는다. */
const SEOUL_AREA = { north: 37.75, south: 37.35, east: 127.3, west: 126.7 };
const NOTICE_MS = 2000;
/** 프로그램적 이동(카드 탭·위치 이동) 뒤 이 시간 안에 온 idle은 정렬 기준점을 갱신하지 않는다 */
const PROGRAMMATIC_MOVE_WINDOW_MS = 1500;
const PLACE_PATH = /^\/place\/([^/]+)\/?$/;

export type MapStatus = "loading" | "ready" | "error";
/** runtime = 스크립트 로드/인증 실패, config = 빌드에 지도 Client ID 없음 (개발자 설정 오류) */
export type MapErrorReason = "runtime" | "config";
/** area = 이 동네에 없음(제보 유도) / bookmarks = 찜 0 / filter = 사이드 칩 조건에 맞는 집 없음(필터 해제 유도) */
export type EmptyKind = "area" | "bookmarks" | "filter";

/** 우리가 pushState로 만든 히스토리 엔트리 표식 — Next가 자기 상태(__NA·tree)를 이 객체에 덧붙여 보존한다 */
interface DetailHistoryState {
  saeuDetail: true;
}

function isDetailHistoryState(state: unknown): state is DetailHistoryState {
  return typeof state === "object" && state !== null && "saeuDetail" in state;
}

export function placeIdFromPath(pathname: string): string | null {
  const match = PLACE_PATH.exec(pathname);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

interface UseMapScreenInput {
  places: Place[];
  bookmarkedIds: string[];
  /** /place/[id]로 들어왔을 때 처음부터 열려 있는 상세 */
  initialPlaceId?: string | undefined;
  /** 지도 명령 핸들 — 화면 컴포넌트가 만들어 MapView에 꽂고, 훅은 핸들러 안에서만 읽는다 */
  mapRef: RefObject<MapHandle | null>;
  /** 상단 스택 DOM — 가시 영역 계산용 */
  topStackRef: RefObject<HTMLDivElement | null>;
}

/** 조용히 위치 요청. 거부·실패·미지원은 전부 null (플랜 결정 1: 거부 시 지도 중심 기준). */
function requestPosition(): Promise<LatLng | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        resolve(null);
      },
      { timeout: 8000, maximumAge: 60_000 },
    );
  });
}

export function useMapScreen({
  places: initialPlaces,
  bookmarkedIds: initialBookmarkedIds,
  initialPlaceId,
  mapRef,
  topStackRef,
}: UseMapScreenInput) {
  // 가게·찜은 서버 초기값에서 시작해 클라이언트 state가 진실이 된다 (다녀왔다면·찜 결과를 카드·칩 필터에 반영)
  const [places, setPlaces] = useState(initialPlaces);
  const [bookmarkedIds, setBookmarkedIds] = useState(initialBookmarkedIds);
  const [tab, setTab] = useState<TabKey>("all");
  const [chips, setChips] = useState<ChipKey[]>([]);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [sort, setSort] = useState<SortKey>("distance");
  const [selectedId, setSelectedId] = useState<string | null>(initialPlaceId ?? null);
  /** 열린 상세. null이면 목록 시트 */
  const [detailId, setDetailId] = useState<string | null>(initialPlaceId ?? null);
  /** 이 세션에서 "다녀왔다면"을 누른 가게 — 핀당 하루 1회 (속도 제한 자리, 지속은 Phase 6) */
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [sortOrigin, setSortOrigin] = useState<LatLng | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [mapError, setMapError] = useState<MapErrorReason | null>(null);
  const [eventDismissed, setEventDismissed] = useState(false);
  const [snap, setSnap] = useState<SheetSnap>("half");
  const [notice, setNotice] = useState<string | null>(null);

  /** 마지막 프로그램적 이동 시각. 그 직후 idle은 사용자 조작이 아니므로 정렬 기준점(지도 중심)을 갱신하지 않는다. */
  const programmaticMoveAt = useRef(0);
  const noticeTimer = useRef<number | null>(null);
  /** 상세를 열 때의 목록 시트 높이 — 닫으면 복원 */
  const listSnapRef = useRef<SheetSnap>("half");

  /* ── 파생 ── */
  const bookmarked = useMemo(() => new Set(bookmarkedIds), [bookmarkedIds]);

  const filtered = useMemo(
    () =>
      filterPlaces(places, {
        tab,
        chips,
        query: deferredQuery,
        bookmarkedIds: bookmarked,
      }),
    [places, tab, chips, deferredQuery, bookmarked],
  );

  // 필터에서 빠진 가게는 선택 해제된 것으로 본다
  const selectedPlace = useMemo(
    () => filtered.find((p) => p.id === selectedId) ?? null,
    [filtered, selectedId],
  );

  // 상세는 필터와 무관 (칩을 바꿔도 열린 상세는 유지)
  const detailPlace = useMemo(
    () => (detailId ? (places.find((p) => p.id === detailId) ?? null) : null),
    [places, detailId],
  );
  const mode: SheetMode = detailPlace ? "detail" : "list";

  // 선택된 가게는 클러스터에서 빼서 항상 단독 마커로 보이게
  const index = useMemo(
    () =>
      buildPlaceIndex(
        selectedPlace ? filtered.filter((p) => p.id !== selectedPlace.id) : filtered,
      ),
    [filtered, selectedPlace],
  );

  const items = useMemo<ClusterItem[]>(() => {
    if (!viewport) return [];
    const list = index.getItems(viewport.bounds, viewport.zoom);
    if (selectedPlace && inBounds(selectedPlace, viewport.bounds)) {
      list.push({ kind: "place", place: selectedPlace });
    }
    return list;
  }, [index, viewport, selectedPlace]);

  const inView = useMemo(
    () => (viewport ? filtered.filter((p) => inBounds(p, viewport.bounds)) : []),
    [filtered, viewport],
  );

  const areaLabel = useMemo(
    () => computeAreaLabel(inView, places.length),
    [inView, places.length],
  );

  const origin = userLocation ?? sortOrigin ?? viewport?.center ?? null;
  const sorted = useMemo(
    () => sortPlaces(inView, sort, origin),
    [inView, sort, origin],
  );

  const status: MapStatus = mapError ? "error" : viewport ? "ready" : "loading";
  const userInSeoul = userLocation !== null && inBounds(userLocation, SEOUL_AREA);
  const emptyKind: EmptyKind =
    chips.includes("bookmarked") && bookmarked.size === 0
      ? "bookmarks"
      : chips.some(isSideChip)
        ? "filter"
        : "area";

  /* ── 지도 이벤트 ── */
  const handleViewportChange = useCallback((next: Viewport) => {
    setViewport(next);
    if (performance.now() - programmaticMoveAt.current < PROGRAMMATIC_MOVE_WINDOW_MS) {
      return;
    }
    setSortOrigin(next.center);
  }, []);

  /** 스크립트 로드 실패(ErrorBoundary)·NCP 인증 실패(navermap_authFailure) → runtime */
  const handleMapError = useCallback(() => {
    setMapError((prev) => prev ?? "runtime");
  }, []);
  /** 빌드에 NEXT_PUBLIC_NCP_CLIENT_ID 없음 → config (Codex #3: 영원한 로딩 대신 에러 상태) */
  const handleMissingConfig = useCallback(() => {
    setMapError("config");
  }, []);

  /* ── 위치: 첫 로드 시 조용히 ── */
  useEffect(() => {
    let cancelled = false;
    void requestPosition().then((pos) => {
      if (cancelled || !pos) return;
      setUserLocation(pos);
      // 지도가 이미 떠 있으면 이동, 아직이면 initialCenter/initialZoom이 같은 조건으로 처리한다
      if (inBounds(pos, SEOUL_AREA) && mapRef.current) {
        programmaticMoveAt.current = performance.now();
        mapRef.current.morph(pos, USER_ZOOM);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mapRef]);

  /* ── 상단 스택 ~ 시트 사이 가시 영역의 세로 중앙 (카드·마커 탭 시 지도 이동 목표) ── */
  const visibleStripCenterY = useCallback(
    (sheetSnap: SheetSnap, sheetMode: SheetMode) => {
      const top = topStackRef.current?.getBoundingClientRect().bottom ?? 0;
      const vh = window.innerHeight;
      const bottom = vh - sheetVisiblePx(sheetSnap, vh, sheetMode);
      return top + Math.max(0, bottom - top) / 2;
    },
    [topStackRef],
  );

  /* ── 상세 열기/닫기 (화면 2: 탭=요약, 스와이프=닫기) + URL 동기화 ── */
  const openDetail = useCallback(
    (id: string, source: "card" | "marker" | "history") => {
      const place = places.find((p) => p.id === id);
      if (!place) return;
      setSelectedId(id);
      setDetailId((prev) => {
        if (prev === null) listSnapRef.current = snap; // 목록에서 처음 열 때의 높이를 기억
        return id;
      });
      setSnap("half");
      if (source !== "history") {
        // 이벤트 핸들러 안에서만 호출 — Next의 History 패치가 상태(__NA·tree)를 덧붙여 popstate가 클라이언트에서 처리된다
        const state: DetailHistoryState = { saeuDetail: true };
        window.history.pushState(state, "", `/place/${encodeURIComponent(id)}`);
      }
      if (mapRef.current) {
        programmaticMoveAt.current = performance.now();
        mapRef.current.panTo(place, { screenY: visibleStripCenterY("half", "detail") });
      }
    },
    [places, snap, mapRef, visibleStripCenterY],
  );

  const closeDetail = useCallback((source: "ui" | "history" = "ui") => {
    setDetailId(null);
    setSnap(listSnapRef.current);
    if (source === "history") return;
    if (isDetailHistoryState(window.history.state)) {
      window.history.back(); // 우리가 push한 엔트리 → 뒤로. popstate가 다시 closeDetail("history")를 부르지만 멱등.
    } else {
      window.history.replaceState(null, "", "/"); // /place/[id] 직접 진입
    }
  }, []);

  // 브라우저 뒤로/앞으로 → 경로를 읽어 열기/닫기. id 출처는 pathname (useParams는 / 트리를 보고한다)
  useEffect(() => {
    const onPopState = () => {
      const id = placeIdFromPath(window.location.pathname);
      if (id) openDetail(id, "history");
      else closeDetail("history");
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [openDetail, closeDetail]);

  /* ── 상호작용 ── */
  const selectFromMarker = useCallback(
    (id: string) => {
      openDetail(id, "marker");
    },
    [openDetail],
  );

  const selectFromCard = useCallback(
    (id: string) => {
      openDetail(id, "card");
    },
    [openDetail],
  );

  /** 다녀왔다면 성공 등으로 갱신된 가게를 목록·마커에 반영 */
  const patchPlace = useCallback((updated: Place) => {
    setPlaces((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  const markChecked = useCallback((id: string) => {
    setCheckedIds((prev) => new Set(prev).add(id));
  }, []);

  /** 찜 토글 — 목 단계는 클라이언트 메모리(lib/data.ts). 확인일은 갱신하지 않는다. */
  const toggleBookmark = useCallback((id: string) => {
    void requestToggleBookmark(id).then(setBookmarkedIds);
  }, []);

  const handleClusterClick = useCallback(
    (clusterId: number, center: LatLng) => {
      const zoom = Math.min(index.getExpansionZoom(clusterId), 19);
      mapRef.current?.morph(center, zoom);
    },
    [index, mapRef],
  );

  const toggleChip = useCallback((chip: ChipKey) => {
    setChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip],
    );
  }, []);

  const clearQuery = useCallback(() => {
    setQuery("");
  }, []);

  /** 필터 빈 상태의 [필터 해제] — 칩 전부 해제 */
  const clearChips = useCallback(() => {
    setChips([]);
  }, []);

  /** 검색 확정(Enter/돋보기): 결과가 다 보이게 지도 이동 */
  const submitSearch = useCallback(() => {
    const matches = filterPlaces(places, {
      tab,
      chips,
      query,
      bookmarkedIds: bookmarked,
    });
    const bounds = boundsOf(matches);
    if (!bounds || !mapRef.current) return;
    const top = (topStackRef.current?.getBoundingClientRect().bottom ?? 0) + 16;
    const bottom = sheetVisiblePx(snap, window.innerHeight, mode) + 16;
    mapRef.current.fitBounds(bounds, {
      top,
      bottom,
      left: 24,
      right: 24,
      maxZoom: SEARCH_FIT_MAX_ZOOM,
    });
  }, [places, tab, chips, query, bookmarked, snap, mode, mapRef, topStackRef]);

  const dismissEvent = useCallback(() => {
    setEventDismissed(true);
  }, []);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => {
      setNotice(null);
    }, NOTICE_MS);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    },
    [],
  );

  /** 현위치 버튼: 명시적 요청이라 서울 밖이어도 그 위치로 간다. 실패는 안내만. */
  const locateMe = useCallback(() => {
    void requestPosition().then((pos) => {
      if (!pos) {
        showNotice("위치를 가져올 수 없어요");
        return;
      }
      setUserLocation(pos);
      if (!mapRef.current) return;
      programmaticMoveAt.current = performance.now();
      mapRef.current.morph(pos, USER_ZOOM);
    });
  }, [mapRef, showNotice]);

  return {
    // 상태
    tab,
    chips,
    query,
    sort,
    selectedId: selectedPlace?.id ?? null,
    detailPlace,
    mode,
    bookmarkedIds,
    checkedIds,
    snap,
    notice,
    userLocation,
    /** 거리 표시·"가까운순" 기준점: 내 위치 → 없으면 지도 중심 (결정 2026-09-02, 플랜 결정 1 갱신) */
    origin,
    eventDismissed,
    status,
    mapErrorReason: mapError,
    emptyKind,
    // 파생
    items,
    sorted,
    inViewCount: inView.length,
    areaLabel,
    // 위치가 SDK보다 먼저 왔을 때: 서울 근교일 때만 그 위치·줌 14로 시작 (밖이면 서울 중심 — 결정 "위치 폴백")
    initialCenter: userInSeoul ? userLocation : SEOUL_CENTER,
    initialZoom: userInSeoul ? USER_ZOOM : INITIAL_ZOOM,
    // 액션
    setTab,
    toggleChip,
    clearChips,
    setQuery,
    clearQuery,
    submitSearch,
    setSort,
    setSnap,
    selectFromMarker,
    selectFromCard,
    closeDetail,
    patchPlace,
    markChecked,
    toggleBookmark,
    handleClusterClick,
    handleViewportChange,
    handleMapError,
    handleMissingConfig,
    dismissEvent,
    showNotice,
    locateMe,
  };
}

export type MapScreenState = ReturnType<typeof useMapScreen>;
