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

export type MapStatus = "loading" | "ready" | "error";
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
  const [mapFailed, setMapFailed] = useState(false);
  const [eventDismissed, setEventDismissed] = useState(false);
  const [snap, setSnap] = useState<SheetSnap>("half");
  const [notice, setNotice] = useState<string | null>(null);

  /** 카드 탭 등 프로그램적 이동 뒤의 idle에서는 정렬 기준점을 갱신하지 않는다 (탭한 카드가 손가락 밑에서 이동 방지) */
  const skipNextOriginUpdate = useRef(false);
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

  const status: MapStatus = mapFailed ? "error" : viewport ? "ready" : "loading";
  const emptyKind: EmptyKind =
    chips.includes("bookmarked") && bookmarked.size === 0 ? "bookmarks" : "area";

  /* ── 지도 이벤트 ── */
  const handleViewportChange = useCallback((next: Viewport) => {
    setViewport(next);
    if (skipNextOriginUpdate.current) {
      skipNextOriginUpdate.current = false;
      return;
    }
    setSortOrigin(next.center);
  }, []);

  const handleMapError = useCallback(() => {
    setMapFailed(true);
  }, []);

  /* ── 위치: 첫 로드 시 조용히 ── */
  useEffect(() => {
    let cancelled = false;
    void requestPosition().then((pos) => {
      if (cancelled || !pos) return;
      setUserLocation(pos);
      if (inBounds(pos, SEOUL_AREA) && mapRef.current) {
        skipNextOriginUpdate.current = true;
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
      skipNextOriginUpdate.current = true;
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
    emptyKind,
    // 파생
    items,
    sorted,
    inViewCount: inView.length,
    initialCenter: userLocation ?? SEOUL_CENTER,
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
    dismissEvent,
    showNotice,
  };
}

export type MapScreenState = ReturnType<typeof useMapScreen>;
