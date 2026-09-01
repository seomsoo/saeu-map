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
import { sheetVisiblePx, type SheetSnap } from "@/components/ui/bottom-sheet";
import { buildPlaceIndex, type ClusterItem } from "@/lib/cluster";
import { boundsOf, inBounds, SEOUL_CENTER } from "@/lib/geo";
import { filterPlaces, sortPlaces } from "@/lib/places";
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

export type MapStatus = "loading" | "ready" | "error";
/** runtime = 스크립트 로드/인증 실패, config = 빌드에 지도 Client ID 없음 (개발자 설정 오류) */
export type MapErrorReason = "runtime" | "config";
export type EmptyKind = "area" | "bookmarks";

interface UseMapScreenInput {
  places: Place[];
  bookmarkedIds: string[];
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
  places,
  bookmarkedIds,
  mapRef,
  topStackRef,
}: UseMapScreenInput) {
  const [tab, setTab] = useState<TabKey>("all");
  const [chips, setChips] = useState<ChipKey[]>([]);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [sort, setSort] = useState<SortKey>("distance");
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const origin = userLocation ?? sortOrigin ?? viewport?.center ?? null;
  const sorted = useMemo(
    () => sortPlaces(inView, sort, origin),
    [inView, sort, origin],
  );

  const status: MapStatus = mapError ? "error" : viewport ? "ready" : "loading";
  const userInSeoul = userLocation !== null && inBounds(userLocation, SEOUL_AREA);
  const emptyKind: EmptyKind =
    chips.includes("bookmarked") && bookmarked.size === 0 ? "bookmarks" : "area";

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

  /* ── 상단 스택 ~ 시트 사이 가시 영역의 세로 중앙 (카드 탭 시 지도 이동 목표) ── */
  const visibleStripCenterY = useCallback(() => {
    const top = topStackRef.current?.getBoundingClientRect().bottom ?? 0;
    const vh = window.innerHeight;
    const bottom = vh - sheetVisiblePx(snap, vh);
    return top + Math.max(0, bottom - top) / 2;
  }, [snap, topStackRef]);

  /* ── 상호작용 ── */
  const selectFromMarker = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const selectFromCard = useCallback(
    (id: string) => {
      setSelectedId(id);
      const place = places.find((p) => p.id === id);
      if (!place || !mapRef.current) return;
      programmaticMoveAt.current = performance.now();
      mapRef.current.panTo(place, { screenY: visibleStripCenterY() });
    },
    [places, visibleStripCenterY, mapRef],
  );

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
    const bottom = sheetVisiblePx(snap, window.innerHeight) + 16;
    mapRef.current.fitBounds(bounds, {
      top,
      bottom,
      left: 24,
      right: 24,
      maxZoom: SEARCH_FIT_MAX_ZOOM,
    });
  }, [places, tab, chips, query, bookmarked, snap, mapRef, topStackRef]);

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

  return {
    // 상태
    tab,
    chips,
    query,
    sort,
    selectedId: selectedPlace?.id ?? null,
    snap,
    notice,
    userLocation,
    eventDismissed,
    status,
    mapErrorReason: mapError,
    emptyKind,
    // 파생
    items,
    sorted,
    inViewCount: inView.length,
    // 위치가 SDK보다 먼저 왔을 때: 서울 근교일 때만 그 위치·줌 14로 시작 (밖이면 서울 중심 — 결정 "위치 폴백")
    initialCenter: userInSeoul ? userLocation : SEOUL_CENTER,
    initialZoom: userInSeoul ? USER_ZOOM : INITIAL_ZOOM,
    // 액션
    setTab,
    toggleChip,
    setQuery,
    clearQuery,
    submitSearch,
    setSort,
    setSnap,
    selectFromMarker,
    selectFromCard,
    handleClusterClick,
    handleViewportChange,
    handleMapError,
    handleMissingConfig,
    dismissEvent,
    showNotice,
  };
}

export type MapScreenState = ReturnType<typeof useMapScreen>;
