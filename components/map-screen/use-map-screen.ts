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
import { previousReportStep, type ReportStep } from "@/components/report/types";
import { sheetVisiblePx, type SheetMode, type SheetSnap } from "@/components/ui/bottom-sheet";
import { buildPlaceIndex, type ClusterItem } from "@/lib/cluster";
import { getGuOfPoint, toggleBookmark as requestToggleBookmark } from "@/lib/data";
import {
  isDetailHistoryState,
  isReportHistoryState,
  type SaeuHistoryState,
} from "@/lib/history-state";
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
/** 제보 2단계: 핀을 맞추는 줌 (건물 단위) */
const REPORT_ZOOM = 17;
const SEARCH_FIT_MAX_ZOOM = 16;
/** 서울·근교. 위치가 이 밖이면 거리 정렬에만 쓰고 지도는 옮기지 않는다. */
const SEOUL_AREA = { north: 37.75, south: 37.35, east: 127.3, west: 126.7 };
const NOTICE_MS = 2000;
/** 프로그램적 이동(카드 탭·위치 이동) 뒤 이 시간 안에 온 idle은 정렬 기준점을 갱신하지 않는다 */
const PROGRAMMATIC_MOVE_WINDOW_MS = 1500;
/** id 문자 화이트리스트 — 디코딩이 필요 없고, 이상한 %시퀀스로 popstate가 터지지 않는다 (security-reviewer 2026-09-02) */
const PLACE_PATH = /^\/place\/([A-Za-z0-9_-]+)\/?$/;

export type MapStatus = "loading" | "ready" | "error";
/** runtime = 스크립트 로드/인증 실패, config = 빌드에 지도 Client ID 없음 (개발자 설정 오류) */
export type MapErrorReason = "runtime" | "config";
/** area = 이 동네에 없음(제보 유도) / bookmarks = 찜 0 / filter = 사이드 칩 조건에 맞는 집 없음(필터 해제 유도) */
export type EmptyKind = "area" | "bookmarks" | "filter";

export function placeIdFromPath(pathname: string): string | null {
  const match = PLACE_PATH.exec(pathname);
  return match?.[1] ?? null;
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
  /** 제보 플로우 단계(화면 3). null이면 닫힘. 입력값은 패널이 갖고 여기는 단계·핀·히스토리만 안다 */
  const [reportStep, setReportStep] = useState<ReportStep | null>(null);
  /** 제보 2단계의 핀 — MapView가 그리고 패널이 확정한다 */
  const [reportPin, setReportPin] = useState<LatLng | null>(null);
  /** 2단계에서 탭한 기존 마커 — 패널이 그 가게로 중복 의심 패널을 연다 */
  const [reportCandidateId, setReportCandidateId] = useState<string | null>(null);

  /** 마지막 프로그램적 이동 시각. 그 직후 idle은 사용자 조작이 아니므로 정렬 기준점(지도 중심)을 갱신하지 않는다. */
  const programmaticMoveAt = useRef(0);
  const noticeTimer = useRef<number | null>(null);
  /** 상세·제보를 열 때의 목록 시트 높이 — 닫으면 복원 */
  const listSnapRef = useRef<SheetSnap>("half");
  /** popstate·마커 탭 핸들러가 재구독 없이 현재 제보 단계를 읽는다 */
  const reportStepRef = useRef<ReportStep | null>(null);
  useEffect(() => {
    reportStepRef.current = reportStep;
  }, [reportStep]);
  /** 사용자가 핀을 옮긴 뒤에는 늦게 온 위치로 핀을 덮어쓰지 않는다 */
  const pinTouchedRef = useRef(false);
  /** 늦게 오는 위치 응답이 호출 시점의 시트 상태를 봐야 한다 — 클로저 값은 낡는다 */
  const snapRef = useRef<SheetSnap>("half");
  const modeRef = useRef<SheetMode>("list");

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

  // 필터에서 빠진 가게는 선택 해제된 것으로 본다. 단 상세가 열려 있으면 그 핀은 필터와 무관하게 유지 (Codex #4)
  const selectedPlace = useMemo(() => {
    const pool = detailId ? places : filtered;
    return pool.find((p) => p.id === selectedId) ?? null;
  }, [places, filtered, selectedId, detailId]);

  // 상세는 필터와 무관 (칩을 바꿔도 열린 상세는 유지)
  const detailPlace = useMemo(
    () => (detailId ? (places.find((p) => p.id === detailId) ?? null) : null),
    [places, detailId],
  );
  const mode: SheetMode = detailPlace ? "detail" : reportStep !== null ? "report" : "list";
  useEffect(() => {
    snapRef.current = snap;
    modeRef.current = mode;
  }, [snap, mode]);

  // 제보 중엔 칩·탭·검색어와 무관하게 전부 마커로 — 중복 후보가 필터에 걸려 안 보이면 안 된다(design 화면 3 변형 (a)).
  // 상단 두 층이 숨어 있어 사용자는 필터를 바꿀 수도 없다.
  const markerPool = reportStep !== null ? places : filtered;
  // 선택된 가게는 클러스터에서 빼서 항상 단독 마커로 보이게
  const index = useMemo(
    () =>
      buildPlaceIndex(
        selectedPlace ? markerPool.filter((p) => p.id !== selectedPlace.id) : markerPool,
      ),
    [markerPool, selectedPlace],
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
  const initialPlace = useMemo(
    () => (initialPlaceId ? (initialPlaces.find((p) => p.id === initialPlaceId) ?? null) : null),
    [initialPlaces, initialPlaceId],
  );
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

  /** 지금 보이는 지도의 한가운데 y. 늦게 도착한 콜백도 호출 시점 상태로 계산한다 */
  const stripCenterY = useCallback(
    () => visibleStripCenterY(snapRef.current, modeRef.current),
    [visibleStripCenterY],
  );

  /* ── 위치: 첫 로드 시 조용히 ── */
  useEffect(() => {
    let cancelled = false;
    void requestPosition().then((pos) => {
      if (cancelled || !pos) return;
      setUserLocation(pos);
      // 권한 프롬프트 뒤 늦게 왔는데 제보 중이면 위치만 기억한다 — 2단계에서 맞춘 핀이 화면 밖으로 밀리면 안 된다 (Codex PR #6 #5)
      if (reportStepRef.current !== null) return;
      // 지도가 이미 떠 있으면 이동, 아직이면 initialCenter/initialZoom이 같은 조건으로 처리한다.
      // /place/[id] 직접 진입은 핀이 우선 — 위치로 옮기지 않는다 (거리 정렬 기준으로만 쓴다)
      if (!initialPlaceId && inBounds(pos, SEOUL_AREA) && mapRef.current) {
        programmaticMoveAt.current = performance.now();
        mapRef.current.focus(pos, USER_ZOOM, { screenY: stripCenterY() });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mapRef, initialPlaceId, stripCenterY]);

  /* ── 첫 화면 위치 맞추기 ──
     SDK는 defaultCenter를 컨테이너 정중앙에 놓는데, 상단 두 층과 시트에 가려
     실제로 보이는 지도의 한가운데는 그보다 위다(702px 기준 246 vs 351 — 105px 어긋남).
     그래서 서울 중심이 시트 쪽으로 치우치고 위쪽 절반은 빈 땅이 됐다 (decisions 2026-09-04).
     /place/[id] 직접 진입은 핀을, 그 외에는 지금 중심을 같은 자리로 옮긴다. */
  const initialPanDone = useRef(false);
  useEffect(() => {
    if (initialPanDone.current || !viewport || !mapRef.current) return;
    if (initialPlaceId) {
      const place = places.find((p) => p.id === initialPlaceId);
      if (!place) return;
      initialPanDone.current = true;
      programmaticMoveAt.current = performance.now();
      mapRef.current.panTo(place, { screenY: visibleStripCenterY("half", "detail") });
      return;
    }
    initialPanDone.current = true;
    programmaticMoveAt.current = performance.now();
    // 첫 페인트라 애니메이션 없이 — 지도가 뜨자마자 미끄러지면 안 된다
    mapRef.current.panTo(viewport.center, {
      screenY: visibleStripCenterY("half", "list"),
      animate: false,
    });
  }, [initialPlaceId, viewport, places, mapRef, visibleStripCenterY]);

  /* ── 상세 열기/닫기 (화면 2: 탭=요약, 스와이프=닫기) + URL 동기화 ── */
  const openDetail = useCallback(
    (id: string, source: "card" | "marker" | "history" | "report") => {
      const place = places.find((p) => p.id === id);
      if (!place) return;
      // 이미 열려 있는 그 가게면 아무것도 하지 않는다. 사진 뷰어가 URL 그대로 엔트리를 쌓으므로
      // 뷰어를 닫는 popstate가 여기까지 오는데, 그때 setSnap("half")가 돌면 펼쳐 둔 시트가 요약으로 튄다.
      if (detailId === id) return;
      setSelectedId(id);
      const switching = detailId !== null; // 상세가 열린 채 다른 마커를 탭
      if (!switching && source !== "report") listSnapRef.current = snap; // 목록에서 처음 열 때의 높이를 기억 (제보는 열 때 이미 기억했다)
      setDetailId(id);
      setSnap("half");
      if (source !== "history") {
        // 이벤트 핸들러 안에서만 호출 — Next의 History 패치가 상태(__NA·tree)를 덧붙여 popstate가 클라이언트에서 처리된다
        const state: SaeuHistoryState = { saeuDetail: true };
        const url = `/place/${encodeURIComponent(id)}`;
        if (source === "report") {
          // 제보에서 넘어옴: 우리가 push한 제보 엔트리를 상세로 교체 — 닫기·뒤로 한 번에 목록 (design 화면 3)
          window.history.replaceState(state, "", url);
        } else if (switching) {
          // 상세 → 다른 상세는 엔트리를 교체해 닫기 한 번에 목록으로 간다 (Codex #4). 직접 진입이면 표식 없이 교체해 닫기 = replace "/" 유지
          window.history.replaceState(isDetailHistoryState(window.history.state) ? state : null, "", url);
        } else {
          window.history.pushState(state, "", url);
        }
      }
      if (mapRef.current) {
        programmaticMoveAt.current = performance.now();
        mapRef.current.panTo(place, { screenY: visibleStripCenterY("half", "detail") });
      }
    },
    [places, snap, detailId, mapRef, visibleStripCenterY],
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

  /** 다녀왔다면 성공 등으로 갱신된 가게를 목록·마커에 반영 */
  const patchPlace = useCallback((updated: Place) => {
    setPlaces((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  const markChecked = useCallback((id: string) => {
    setCheckedIds((prev) => new Set(prev).add(id));
  }, []);

  const handleClusterClick = useCallback(
    (clusterId: number, center: LatLng) => {
      if (reportStepRef.current !== null) return; // 제보 중엔 클러스터도 보이기만 (마커와 같은 규칙)
      const zoom = Math.min(index.getExpansionZoom(clusterId), 19);
      mapRef.current?.focus(center, zoom, { screenY: stripCenterY() });
    },
    [index, mapRef, stripCenterY],
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

  /* ── 제보 플로우 (화면 3): 단계·핀·히스토리만. 입력값은 components/report가 갖는다 ── */
  const focusReportPin = useCallback(
    (point: LatLng) => {
      if (!mapRef.current) return;
      programmaticMoveAt.current = performance.now();
      mapRef.current.focus(point, REPORT_ZOOM, {
        screenY: visibleStripCenterY("half", "report"),
      });
    },
    [mapRef, visibleStripCenterY],
  );

  /** 단계 이동 + 스냅(2단계만 요약). 2단계 첫 진입에 핀을 세운다: 현 위치 → 보던 지도 중심 → 서울 중심 */
  const goToReportStep = useCallback(
    (step: ReportStep) => {
      // 닫힌 플로우는 움직이지 않는다 — 등록·확정 검사가 ✕ 뒤에 끝나면 created 없는 빈 시트로 다시 열렸다 (Codex PR #6 #2·#3)
      if (reportStepRef.current === null) return;
      setReportStep(step);
      setReportCandidateId(null);
      setSnap(step === 2 ? "half" : "full");
      if (step !== 2 || reportPin !== null) return;
      const start = userLocation ?? viewport?.center ?? SEOUL_CENTER;
      setReportPin(start);
      focusReportPin(start);
      // 경계 파일(서울 60KB, 밖이면 +180KB)을 지금 받아 두면 [여기가 맞아요]에서 기다리지 않는다 — 모듈 캐시라 한 번뿐 (Codex PR #6 #4)
      void getGuOfPoint(start).catch(() => undefined);
      if (userLocation !== null) return;
      // 위치를 아직 모르면 한 번 조용히 묻고, 사용자가 핀을 건드리기 전이면 그리로 옮긴다
      void requestPosition().then((pos) => {
        if (!pos || !inBounds(pos, SEOUL_AREA)) return;
        setUserLocation(pos);
        if (pinTouchedRef.current || reportStepRef.current !== 2) return;
        setReportPin(pos);
        focusReportPin(pos);
      });
    },
    [reportPin, userLocation, viewport, focusReportPin],
  );

  /** 제보 열기 (FAB·빈 상태 [제보]). 2단계가 지도라 지도 에러면 막는다 */
  const openReport = useCallback(() => {
    if (mapError) {
      showNotice("지도를 불러오지 못해 제보할 수 없어요");
      return;
    }
    listSnapRef.current = snap;
    pinTouchedRef.current = false;
    setReportPin(null);
    setReportStep(1);
    setSnap("full");
    // URL은 그대로, 엔트리 하나가 플로우 전체 — popstate가 한 단계씩 내린다 (design 화면 3)
    const state: SaeuHistoryState = { saeuReport: true };
    window.history.pushState(state, "");
  }, [mapError, snap, showNotice]);

  const closeReportFlow = useCallback(() => {
    setReportStep(null);
    setReportPin(null);
    setReportCandidateId(null);
    setSnap(listSnapRef.current);
  }, []);

  /** 중복 의심 패널의 ‹ — 탭한 마커 후보를 비운다(핀 화면으로) */
  const clearReportCandidate = useCallback(() => {
    setReportCandidateId(null);
  }, []);

  /** 헤더 ✕ — 확인 없이 그만둔다. 우리가 push한 엔트리면 뒤로 가서 popstate가 마저 닫는다(멱등) */
  const cancelReport = useCallback(() => {
    closeReportFlow();
    if (isReportHistoryState(window.history.state)) window.history.back();
  }, [closeReportFlow]);

  /** 패널의 ‹ — 브라우저 뒤로가기와 같은 길(popstate가 한 단계 내린다). 엔트리가 없으면 직접 내린다 */
  const backReportStep = useCallback(() => {
    if (isReportHistoryState(window.history.state)) {
      window.history.back();
      return;
    }
    const step = reportStepRef.current;
    const prev = step === null ? null : previousReportStep(step);
    if (prev === null) closeReportFlow();
    else goToReportStep(prev);
  }, [closeReportFlow, goToReportStep]);

  /** 핀 이동 — 탭·드래그는 이미 보이는 자리라 지도를 두고, 주소 검색은 핀이 보이게 옮긴다 */
  const moveReportPin = useCallback(
    (point: LatLng, source: "tap" | "drag" | "search") => {
      pinTouchedRef.current = true;
      setReportPin(point);
      if (source === "search") focusReportPin(point);
    },
    [focusReportPin],
  );

  /** 2단계 중복 의심: 핀과 후보가 둘 다 요약 시트 위에 보이게 (design 화면 3 변형 (a)) */
  const showReportPair = useCallback(
    (candidate: LatLng) => {
      if (!reportPin || !mapRef.current) return;
      const bounds = boundsOf([reportPin, candidate]);
      if (!bounds) return;
      programmaticMoveAt.current = performance.now();
      mapRef.current.fitBounds(bounds, {
        top: 72,
        bottom: sheetVisiblePx("half", window.innerHeight, "report") + 24,
        left: 40,
        right: 40,
        maxZoom: REPORT_ZOOM,
      });
    },
    [reportPin, mapRef],
  );

  /** 1단계 매치·2단계 [이 가게예요]·완료 [내 핀 보러가기] — 플로우를 닫고 그 가게 상세로(엔트리 교체) */
  const openDetailFromReport = useCallback(
    (id: string) => {
      closeReportFlow();
      openDetail(id, "report");
    },
    [closeReportFlow, openDetail],
  );

  /* ── 상호작용 ── */
  const selectFromMarker = useCallback(
    (id: string) => {
      const step = reportStepRef.current;
      if (step === 2) {
        // 2단계: 이미 있는 마커를 누른 건 "여기 있는 이 가게" — 중복 의심 패널로 (design 화면 3 변형 (a))
        const place = places.find((p) => p.id === id);
        if (!place) return;
        setReportCandidateId(id);
        showReportPair(place);
        return;
      }
      if (step !== null) return; // 다른 단계에선 기존 마커가 보이기만 한다
      openDetail(id, "marker");
    },
    [openDetail, places, showReportPair],
  );

  const selectFromCard = useCallback(
    (id: string) => {
      openDetail(id, "card");
    },
    [openDetail],
  );

  /** 제보 성공으로 생긴 가게를 목록·마커에 추가 */
  const addPlace = useCallback((place: Place) => {
    setPlaces((prev) => [...prev, place]);
  }, []);

  // 브라우저 뒤로/앞으로. 제보 중이면 한 단계 뒤로 + 엔트리 재장전(1단계·완료에선 닫힘),
  // 아니면 경로를 읽어 상세 열기/닫기. id 출처는 pathname (useParams는 / 트리를 보고한다)
  useEffect(() => {
    const onPopState = () => {
      const step = reportStepRef.current;
      if (step !== null) {
        const prev = previousReportStep(step);
        if (prev === null) {
          closeReportFlow();
          return;
        }
        goToReportStep(prev);
        const state: SaeuHistoryState = { saeuReport: true };
        window.history.pushState(state, "");
        return;
      }
      const id = placeIdFromPath(window.location.pathname);
      if (id) openDetail(id, "history");
      else closeDetail("history");
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [openDetail, closeDetail, closeReportFlow, goToReportStep]);

  /** 찜 토글 — 목 단계는 클라이언트 메모리(lib/data.ts). 확인일은 갱신하지 않는다. */
  const toggleBookmark = useCallback(
    (id: string) => {
      requestToggleBookmark(id).then(setBookmarkedIds, () => {
        showNotice("찜을 저장하지 못했어요");
      });
    },
    [showNotice],
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
      mapRef.current.focus(pos, USER_ZOOM, { screenY: stripCenterY() });
    });
  }, [mapRef, showNotice, stripCenterY]);

  return {
    // 상태
    places,
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
    reportStep,
    reportPin,
    reportCandidateId,
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
    // /place/[id] 직접 진입은 그 핀·줌 14(현위치 줌과 동일)에서 시작해 공유 링크로 핀이 바로 보인다.
    // 아니면: 위치가 SDK보다 먼저 왔을 때 서울 근교일 때만 그 위치·줌 14 (밖이면 서울 중심 — 결정 "위치 폴백")
    initialCenter: initialPlace ?? (userInSeoul ? userLocation : SEOUL_CENTER),
    initialZoom: initialPlace || userInSeoul ? USER_ZOOM : INITIAL_ZOOM,
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
    openReport,
    cancelReport,
    backReportStep,
    goToReportStep,
    moveReportPin,
    clearReportCandidate,
    showReportPair,
    openDetailFromReport,
    addPlace,
  };
}

export type MapScreenState = ReturnType<typeof useMapScreen>;
