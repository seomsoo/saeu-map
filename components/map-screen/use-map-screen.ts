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
import type { ActivityTab, LoadStatus } from "@/components/activity/use-activity";
import { useSession } from "@/components/auth/session-provider";
import type { MapHandle } from "@/components/map/map-view";
import { previousReportStep, type ReportStep } from "@/components/report/types";
import {
  sheetViewportHeight,
  sheetVisiblePx,
  type SheetMode,
  type SheetSnap,
} from "@/components/ui/bottom-sheet";
import { buildPlaceIndex, type ClusterItem } from "@/lib/cluster";
import {
  getBookmarkedPlaceIds,
  getGuOfPoint,
  toggleBookmark as requestToggleBookmark,
} from "@/lib/data";
import {
  isDetailHistoryState,
  isMeHistoryState,
  isReportHistoryState,
  type SaeuHistoryState,
} from "@/lib/history-state";
import { boundsOf, inBounds, SEOUL_CENTER } from "@/lib/geo";
import { isDesktopViewport, PANEL_OCCLUSION_PX } from "@/lib/layout";
import {
  areaLabel as computeAreaLabel,
  densestPoint,
  filterPlaces,
  isSideChip,
  sortPlaces,
} from "@/lib/places";
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
/** /gu/[name]: 가게가 없는 구는 구 중심을 이 줌으로(구 하나가 화면에 든다). 가게가 있으면 fitBounds(최대 15) */
const GU_ZOOM = 13;
const GU_FIT_MAX_ZOOM = 15;
/** 제보 2단계: 핀을 맞추는 줌 (건물 단위) */
const REPORT_ZOOM = 17;
const SEARCH_FIT_MAX_ZOOM = 16;
/** 서울·근교. 위치가 이 밖이면 거리 정렬에만 쓰고 지도는 옮기지 않는다. */
const SEOUL_AREA = { north: 37.75, south: 37.35, east: 127.3, west: 126.7 };
const NOTICE_MS = 2000;
/** 익명 찜 이 개수째에 로그인 넛지 한 번 (spec 5 "벽은 아님") */
const BOOKMARK_NUDGE_AT = 3;
export const BOOKMARK_NUDGE_NOTICE = "로그인하면 찜이 기기가 바뀌어도 남아요";
/** 프로그램적 이동(카드 탭·위치 이동) 뒤 이 시간 안에 온 idle은 정렬 기준점을 갱신하지 않는다 */
const PROGRAMMATIC_MOVE_WINDOW_MS = 1500;
/** id 문자 화이트리스트 — 디코딩이 필요 없고, 이상한 %시퀀스로 popstate가 터지지 않는다 (security-reviewer 2026-09-02) */
const PLACE_PATH = /^\/place\/([A-Za-z0-9_-]+)\/?$/;

export type MapStatus = "loading" | "ready" | "error";
/** runtime = 스크립트 로드/인증 실패, config = 빌드에 지도 Client ID 없음 (개발자 설정 오류) */
export type MapErrorReason = "runtime" | "config";
/** area = 이 동네에 없음(제보 유도) / bookmarks = 찜 0 / filter = 켜 둔 사이드 칩에 맞는 집 없음(필터 해제 유도) */
export type EmptyKind = "area" | "bookmarks" | "filter";

export function placeIdFromPath(pathname: string): string | null {
  const match = PLACE_PATH.exec(pathname);
  return match?.[1] ?? null;
}

/** /gu/[name] 진입 — 그 구 가게로 지도를 맞추고, 지도가 뜨기 전엔 그 구 가게가 목록(SSR)이다 */
export interface InitialGu {
  name: string;
  /** 구 경계 박스 중심 — 가게가 0곳일 때 지도를 여기로 */
  center: LatLng;
}

interface UseMapScreenInput {
  places: Place[];
  bookmarkedIds: string[];
  /** /place/[id]로 들어왔을 때 처음부터 열려 있는 상세 */
  initialPlaceId?: string | undefined;
  /** /gu/[name]로 들어왔을 때 (decisions 2026-09-07) */
  initialGu?: InitialGu | undefined;
  /** 지도 명령 핸들 — 화면 컴포넌트가 만들어 MapView에 꽂고, 훅은 핸들러 안에서만 읽는다 */
  mapRef: RefObject<MapHandle | null>;
  /** 상단 스택 DOM — 가시 영역 계산용 */
  topStackRef: RefObject<HTMLDivElement | null>;
}

/**
 * 위치 요청. 실패 이유를 구분한다 — **거부는 다시 눌러도 팝업이 안 뜨므로**(브라우저가 기억한다)
 * "다시 시도" 안내를 주면 사용자가 버튼만 계속 누르게 된다 (decisions 2026-09-04).
 * 조용한 호출자(첫 로드·제보 2단계)는 `ok`만 보고 이유는 무시한다.
 */
type PositionResult =
  | { ok: true; point: LatLng }
  | { ok: false; reason: "denied" | "unavailable" };

function requestPosition(): Promise<PositionResult> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve({ ok: false, reason: "unavailable" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ ok: true, point: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
      },
      (err) => {
        // code 1 = PERMISSION_DENIED. 2(위치 못 구함)·3(타임아웃)은 다시 시도할 만하다.
        resolve({ ok: false, reason: err.code === 1 ? "denied" : "unavailable" });
      },
      { timeout: 8000, maximumAge: 60_000 },
    );
  });
}

export function useMapScreen({
  places: initialPlaces,
  bookmarkedIds: initialBookmarkedIds,
  initialPlaceId,
  initialGu,
  mapRef,
  topStackRef,
}: UseMapScreenInput) {
  const { session, requireLogin } = useSession();
  // 가게·찜은 서버 초기값에서 시작해 클라이언트 state가 진실이 된다 (다녀왔다면·찜 결과를 카드·칩 필터에 반영)
  const [places, setPlaces] = useState(initialPlaces);
  const [bookmarkedIds, setBookmarkedIds] = useState(initialBookmarkedIds);
  /** 찜을 어느 세션까지 읽었나 — 상태(로딩·에러)는 이 값과 현재 세션을 비교해 파생한다(effect 안에서 setState 금지) */
  const [bookmarksLoaded, setBookmarksLoaded] = useState<{ userId: string; ok: boolean } | null>(null);
  /** 익명 찜 넛지는 세션당 한 번 */
  const bookmarkNudgedRef = useRef(false);
  const [tab, setTab] = useState<TabKey>("all");
  const [chips, setChips] = useState<ChipKey[]>([]);
  // /gu/[name]는 검색어를 그 구로 시작한다 — 목록·마커가 그 구로 좁혀지고, 검색 바에 이유가 보이며 ✕ 한 번으로 풀린다
  // (사용자가 "마포구"를 쳐서 얻는 화면과 같다. 지도가 넓은 데스크탑에서 헤더가 "서울 전체"로 새지 않는다)
  const [query, setQuery] = useState(initialGu?.name ?? "");
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
  /** 제보 완료 "리뷰도 남겨볼래요?" — 이 가게 상세가 열리자마자 리뷰 게이트를 세운다(한 번 쓰고 지운다) */
  const [reviewIntentId, setReviewIntentId] = useState<string | null>(null);
  /** 내 활동 패널(화면 5). 상세가 그 위에 열려도 true로 남아, 상세를 닫으면 패널로 돌아온다 */
  const [meOpen, setMeOpen] = useState(false);
  const [meTab, setMeTab] = useState<ActivityTab>("bookmarks");
  /** 내 활동 활성 탭의 가게 id — 열린 동안 지도 마커는 이것만 */
  const [mePlaceIds, setMePlaceIds] = useState<readonly string[]>([]);
  /** 데스크탑: 목록에서 마우스가 올라간 카드 — 그 마커만 확대 (design 화면 6). 목록이 아닌 모드에선 무시 */
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  /** 마지막 프로그램적 이동 시각. 그 직후 idle은 사용자 조작이 아니므로 정렬 기준점(지도 중심)을 갱신하지 않는다. */
  const programmaticMoveAt = useRef(0);
  /** 지도가 지금 내 위치에 맞춰져 있나 — 현위치 FAB의 활성 표시. 사용자가 지도를 밀면 풀린다. */
  const [following, setFollowing] = useState(false);
  const noticeTimer = useRef<number | null>(null);
  /** 상세·제보를 열 때의 목록 시트 높이 — 닫으면 복원 */
  const listSnapRef = useRef<SheetSnap>("half");
  /** popstate·마커 탭 핸들러가 재구독 없이 현재 제보 단계를 읽는다 */
  const reportStepRef = useRef<ReportStep | null>(null);
  useEffect(() => {
    reportStepRef.current = reportStep;
  }, [reportStep]);
  /** popstate가 상세가 열려 있지 않을 때(오버레이 엔트리가 빠질 때 등) 목록 스냅을 건드리지 않게 */
  const detailIdRef = useRef<string | null>(initialPlaceId ?? null);
  useEffect(() => {
    detailIdRef.current = detailId;
  }, [detailId]);
  const meOpenRef = useRef(false);
  useEffect(() => {
    meOpenRef.current = meOpen;
  }, [meOpen]);
  /** 사용자가 핀을 옮긴 뒤에는 늦게 온 위치로 핀을 덮어쓰지 않는다 */
  const pinTouchedRef = useRef(false);
  /** 늦게 온 쓰기 응답이 "아직 그 세션인가"를 볼 수 있게 (CLAUDE.md 비동기 결과 규칙) */
  const sessionRef = useRef<string | null>(null);
  /** 핸들러가 재구독 없이 현재 찜 목록을 읽는다(연타의 방향 판정) */
  const bookmarkedIdsRef = useRef<readonly string[]>(initialBookmarkedIds);
  /**
   * 낙관 토글이 진행 중인 가게 → 그 시점의 희망 상태. 재로드(세션 바뀜)가 이 항목을 되살리거나
   * 지우지 않게 결과에 덮어씌운다 — 성공·실패 **양쪽에서** 표식을 지운다 (CLAUDE.md 낙관 업데이트 규칙).
   */
  const pendingBookmarksRef = useRef(new Map<string, boolean>());
  /** 서버 목록에 진행 중인 낙관 상태를 얹는다 */
  const withPendingBookmarks = useCallback((ids: readonly string[]): string[] => {
    const next = new Set(ids);
    for (const [id, wanted] of pendingBookmarksRef.current) {
      if (wanted) next.add(id);
      else next.delete(id);
    }
    return [...next];
  }, []);
  /** 늦게 오는 위치 응답이 호출 시점의 시트 상태를 봐야 한다 — 클로저 값은 낡는다 */
  const snapRef = useRef<SheetSnap>("half");
  const modeRef = useRef<SheetMode>("list");

  /** 첫 지도 중심: 가게가 가장 몰린 곳. 서버가 준 목록으로만 — 제보로 목록이 늘어도 흔들리지 않는다 */
  const densestCenter = useMemo(() => densestPoint(initialPlaces), [initialPlaces]);

  /* ── 파생 ── */
  const bookmarked = useMemo(() => new Set(bookmarkedIds), [bookmarkedIds]);
  const bookmarkedPlaces = useMemo(
    () => places.filter((p) => bookmarked.has(p.id)),
    [places, bookmarked],
  );

  // 세션이 바뀌면(첫 로드·로그인 승계·로그아웃·탈퇴) 찜은 그 사용자의 것으로 — 목은 lib/data 메모리라 바로 온다.
  // 서버가 준 초기값으로 시작하므로 status는 ready에서 출발하고, 세션이 바뀔 때만 다시 읽는다(내 활동 찜 탭의 4상태).
  const sessionUserId = session?.userId ?? null;
  useEffect(() => {
    sessionRef.current = sessionUserId;
  }, [sessionUserId]);
  useEffect(() => {
    bookmarkedIdsRef.current = bookmarkedIds;
  }, [bookmarkedIds]);
  useEffect(() => {
    if (sessionUserId === null || bookmarksLoaded?.userId === sessionUserId) return;
    let alive = true;
    getBookmarkedPlaceIds().then(
      (ids) => {
        if (!alive) return;
        setBookmarkedIds(withPendingBookmarks(ids));
        setBookmarksLoaded({ userId: sessionUserId, ok: true });
      },
      () => {
        if (alive) setBookmarksLoaded({ userId: sessionUserId, ok: false });
      },
    );
    return () => {
      alive = false;
    };
  }, [sessionUserId, bookmarksLoaded, withPendingBookmarks]);

  /** 내 활동 찜 탭의 4상태 — 아직 이 세션의 찜을 못 읽었으면 로딩, 실패면 에러 */
  const bookmarksStatus: LoadStatus =
    sessionUserId === null || bookmarksLoaded?.userId === sessionUserId
      ? bookmarksLoaded?.ok === false
        ? "error"
        : "ready"
      : "loading";

  /** 찜 탭 [다시 시도] — 읽은 표식을 지우면 위 effect가 다시 돈다 */
  const retryBookmarks = useCallback(() => {
    setBookmarksLoaded(null);
  }, []);

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
  const mode: SheetMode = detailPlace
    ? "detail"
    : reportStep !== null
      ? "report"
      : meOpen
        ? "me"
        : "list";
  useEffect(() => {
    snapRef.current = snap;
    modeRef.current = mode;
  }, [snap, mode]);

  // 제보 중엔 칩·탭·검색어와 무관하게 전부 마커로 — 중복 후보가 필터에 걸려 안 보이면 안 된다(design 화면 3 변형 (a)).
  // 상단 두 층이 숨어 있어 사용자는 필터를 바꿀 수도 없다. 내 활동이 열려 있으면 활성 탭의 가게만(화면 5).
  const meMarkerSet = useMemo(() => new Set(mePlaceIds), [mePlaceIds]);
  const markerPool = useMemo(
    () =>
      reportStep !== null
        ? places
        : meOpen
          ? places.filter((p) => meMarkerSet.has(p.id))
          : filtered,
    [reportStep, places, meOpen, meMarkerSet, filtered],
  );
  /* 선택 핀은 클러스터에서 빼 단독 마커로 보이게 한다(상세가 열린 동안 필터와 무관하게 유지 — Codex PR #4).
     단 내 활동에서는 "활성 탭의 가게만"이 약속이라, 마커 풀에 없는 옛 선택은 끼워 넣지 않는다 (Codex PR #8 #3). */
  const markerSelection = useMemo(
    () =>
      selectedPlace && (!meOpen || meMarkerSet.has(selectedPlace.id)) ? selectedPlace : null,
    [selectedPlace, meOpen, meMarkerSet],
  );
  const index = useMemo(
    () =>
      buildPlaceIndex(
        markerSelection ? markerPool.filter((p) => p.id !== markerSelection.id) : markerPool,
      ),
    [markerPool, markerSelection],
  );

  const items = useMemo<ClusterItem[]>(() => {
    if (!viewport) return [];
    const list = index.getItems(viewport.bounds, viewport.zoom);
    if (markerSelection && inBounds(markerSelection, viewport.bounds)) {
      list.push({ kind: "place", place: markerSelection });
    }
    return list;
  }, [index, viewport, markerSelection]);

  const inView = useMemo(() => {
    if (viewport) return filtered.filter((p) => inBounds(p, viewport.bounds));
    // /gu/[name]: 지도가 첫 idle을 보고하기 전엔 검색어(= 그 구)로 걸러진 가게가 목록이다 — SSR HTML에 상호가 들어간다(크롤러용)
    return initialGu ? filtered : [];
  }, [filtered, viewport, initialGu]);

  const areaLabel = useMemo(
    () =>
      // 가게 0곳인 구의 SSR 헤더는 "이 지역"이 아니라 그 구 이름으로
      !viewport && initialGu && inView.length === 0
        ? initialGu.name
        : computeAreaLabel(inView, places.length),
    [inView, places.length, viewport, initialGu],
  );

  const origin = userLocation ?? sortOrigin ?? viewport?.center ?? null;
  const sorted = useMemo(
    () => sortPlaces(inView, sort, origin),
    [inView, sort, origin],
  );

  // /gu/[name]는 서버가 목록을 채우므로 지도 전에도 ready(스켈레톤이 아니라 상호가 보여야 한다)
  const status: MapStatus = mapError ? "error" : viewport || initialGu ? "ready" : "loading";
  const initialPlace = useMemo(
    () => (initialPlaceId ? (initialPlaces.find((p) => p.id === initialPlaceId) ?? null) : null),
    [initialPlaces, initialPlaceId],
  );
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

  /* 손가락이 지도를 끌기 시작하면 추적 해제. idle로 판정하면 프로그램 이동 창(1500ms) 안에 민 경우를
     놓치고, 그 뒤 idle이 보장되지 않아 FAB이 계속 활성으로 남는다 (Codex PR #7 #4). */
  const handleUserPan = useCallback(() => {
    setFollowing(false);
  }, []);

  /** 스크립트 로드 실패(ErrorBoundary)·NCP 인증 실패(navermap_authFailure) → runtime */
  const handleMapError = useCallback(() => {
    setMapError((prev) => prev ?? "runtime");
  }, []);
  /** 빌드에 NEXT_PUBLIC_NCP_CLIENT_ID 없음 → config (Codex #3: 영원한 로딩 대신 에러 상태) */
  const handleMissingConfig = useCallback(() => {
    setMapError("config");
  }, []);

  /* ── 상단 스택 ~ 시트 사이 가시 영역의 세로 중앙 (카드·마커 탭 시 지도 이동 목표).
     데스크탑은 지도가 패널 옆 컬럼 전체라 가려지는 띠가 없다 — undefined = 컨테이너 중앙 (design 화면 6) ── */
  const visibleStripCenterY = useCallback(
    (sheetSnap: SheetSnap, sheetMode: SheetMode): number | undefined => {
      if (isDesktopViewport()) return undefined;
      const top = topStackRef.current?.getBoundingClientRect().bottom ?? 0;
      const vh = sheetViewportHeight();
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

  /* ── 데스크탑은 떠 있는 패널이 지도 왼쪽을 덮는다 — 가시 영역의 가로 중앙은 그만큼 오른쪽이다.
     모바일은 패널이 없으니 undefined = 컨테이너 중앙 (design 화면 6 v3) ── */
  const stripCenterX = useCallback((): number | undefined => {
    if (!isDesktopViewport()) return undefined;
    return (PANEL_OCCLUSION_PX + window.innerWidth) / 2;
  }, []);

  /** fitBounds 왼쪽 마진 — 패널이 가리는 만큼 더 준다 */
  const panelFitLeft = useCallback((base: number): number => {
    if (!isDesktopViewport()) return base;
    return PANEL_OCCLUSION_PX + base;
  }, []);

  /*
   * 첫 로드에 위치를 묻지 않는다 — 맥락 없이 뜬 권한 팝업은 반사적으로 거부되고, 거부는 되돌리기가
   * 브라우저마다 다른 미로다. 현위치 FAB을 누를 때만 묻는다(그때의 거부는 의도적 선택이다).
   * 대신 첫 화면은 가게가 가장 몰린 곳으로 연다. 거리·정렬은 그때까지 지도 중심 기준(spec 4.1).
   */

  /* ── 첫 화면 위치 맞추기 ──
     SDK는 defaultCenter를 컨테이너 정중앙에 놓는데, 상단 두 층과 시트에 가려
     실제로 보이는 지도의 한가운데는 그보다 위다(702px 기준 246 vs 351 — 105px 어긋남).
     그래서 서울 중심이 시트 쪽으로 치우치고 위쪽 절반은 빈 땅이 됐다 (decisions 2026-09-04).
     /place/[id] 직접 진입은 핀을, 그 외에는 지금 중심을 같은 자리로 옮긴다. */
  const initialPanDone = useRef(false);
  useEffect(() => {
    if (initialPanDone.current || !viewport || !mapRef.current) return;
    // /gu/[name]: 그 구 가게가 다 보이게(모바일은 상단 스택·요약 시트만큼 비운다), 0곳이면 구 중심
    if (initialGu) {
      initialPanDone.current = true;
      programmaticMoveAt.current = performance.now();
      const desktop = isDesktopViewport();
      const bounds = boundsOf(places.filter((p) => p.gu === initialGu.name));
      if (bounds) {
        mapRef.current.fitBounds(bounds, {
          top: desktop ? 40 : (topStackRef.current?.getBoundingClientRect().bottom ?? 0) + 24,
          bottom: desktop ? 40 : sheetVisiblePx("half", sheetViewportHeight(), "list") + 24,
          left: panelFitLeft(40),
          right: 40,
          maxZoom: GU_FIT_MAX_ZOOM,
        });
      } else {
        mapRef.current.focus(initialGu.center, GU_ZOOM, {
          screenX: stripCenterX(),
          screenY: visibleStripCenterY("half", "list"),
        });
      }
      return;
    }
    // 데스크탑도 옮긴다 — v2(붙은 패널)에선 지도 컬럼 중앙이 곧 가시 중앙이었지만,
    // v3의 떠 있는 패널은 지도 위를 덮으므로 가로를 그만큼 밀어야 한다 (design 화면 6 v3)
    if (initialPlaceId) {
      const place = places.find((p) => p.id === initialPlaceId);
      if (!place) return;
      initialPanDone.current = true;
      programmaticMoveAt.current = performance.now();
      mapRef.current.panTo(place, {
        screenX: stripCenterX(),
        screenY: visibleStripCenterY("half", "detail"),
      });
      return;
    }
    initialPanDone.current = true;
    programmaticMoveAt.current = performance.now();
    // 첫 페인트라 애니메이션 없이 — 지도가 뜨자마자 미끄러지면 안 된다
    mapRef.current.panTo(viewport.center, {
      screenX: stripCenterX(),
      screenY: visibleStripCenterY("half", "list"),
      animate: false,
    });
  }, [
    initialPlaceId,
    initialGu,
    viewport,
    places,
    mapRef,
    topStackRef,
    visibleStripCenterY,
    stripCenterX,
    panelFitLeft,
  ]);

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
      // 목록에서 처음 열 때의 높이를 기억 (제보·내 활동은 열 때 이미 기억했다)
      if (!switching && source !== "report" && !meOpenRef.current) listSnapRef.current = snap;
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
        mapRef.current.panTo(place, {
          screenX: stripCenterX(),
          screenY: visibleStripCenterY("half", "detail"),
        });
      }
    },
    [places, snap, detailId, mapRef, visibleStripCenterY, stripCenterX],
  );

  const closeDetail = useCallback((source: "ui" | "history" = "ui") => {
    setDetailId(null);
    // 내 활동 위에 열린 상세였으면 패널(전체)로 돌아온다
    setSnap(meOpenRef.current ? "full" : listSnapRef.current);
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
      const step = reportStepRef.current;
      // 2단계에선 클러스터도 **지도의 그 자리**다 — 여기서 빠져나가면 마커가 덮은 지역을 눌렀을 때
      // 아무 일도 안 일어나 "핀이 안 꽂힌다"가 된다(마커가 지도의 상당 부분을 덮는다, 2026-09-08).
      // 개별 마커는 그대로 중복 의심 후보로 간다(design 화면 3 변형 (a)).
      if (step === 2) {
        pinTouchedRef.current = true;
        setReportPin(center);
        return;
      }
      if (step !== null) return; // 다른 단계에선 클러스터도 보이기만
      const zoom = Math.min(index.getExpansionZoom(clusterId), 19);
      mapRef.current?.focus(center, zoom, { screenX: stripCenterX(), screenY: stripCenterY() });
    },
    [index, mapRef, stripCenterY, stripCenterX],
  );

  const toggleChip = useCallback((chip: ChipKey) => {
    setChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip],
    );
  }, []);

  const clearQuery = useCallback(() => {
    setQuery("");
  }, []);

  /** 필터 빈 상태의 [필터 해제] — 칩·카테고리·검색어를 함께 푼다 */
  const clearFilters = useCallback(() => {
    setChips([]);
    setTab("all");
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
    // 모바일은 상단 스택·시트가 가리는 만큼 비운다. 데스크탑은 가리는 게 없어 네 변 대칭
    const desktop = isDesktopViewport();
    const top = desktop ? 24 : (topStackRef.current?.getBoundingClientRect().bottom ?? 0) + 16;
    const bottom = desktop ? 24 : sheetVisiblePx(snap, sheetViewportHeight(), mode) + 16;
    mapRef.current.fitBounds(bounds, {
      top,
      bottom,
      left: panelFitLeft(24),
      right: 24,
      maxZoom: SEARCH_FIT_MAX_ZOOM,
    });
  }, [places, tab, chips, query, bookmarked, snap, mode, mapRef, topStackRef, panelFitLeft]);

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
        screenX: stripCenterX(),
        screenY: visibleStripCenterY("half", "report"),
      });
    },
    [mapRef, visibleStripCenterY, stripCenterX],
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
      void requestPosition().then((res) => {
        if (!res.ok || !inBounds(res.point, SEOUL_AREA)) return;
        const pos = res.point;
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
      const desktop = isDesktopViewport();
      mapRef.current.fitBounds(bounds, {
        top: desktop ? 40 : 72,
        bottom: desktop ? 40 : sheetVisiblePx("half", sheetViewportHeight(), "report") + 24,
        left: panelFitLeft(40),
        right: 40,
        maxZoom: REPORT_ZOOM,
      });
    },
    [reportPin, mapRef, panelFitLeft],
  );

  /** 1단계 매치·2단계 [이 가게예요]·완료 [내 핀 보러가기]·"리뷰도 남겨볼래요?" — 플로우를 닫고 그 가게 상세로(엔트리 교체) */
  const openDetailFromReport = useCallback(
    (id: string, options?: { review: boolean }) => {
      closeReportFlow();
      openDetail(id, "report");
      if (options?.review) setReviewIntentId(id);
    },
    [closeReportFlow, openDetail],
  );

  const clearReviewIntent = useCallback(() => {
    setReviewIntentId(null);
  }, []);

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

  /** 카드 hover(마우스만) — 카드가 hidden으로 바뀌면 leave가 안 오므로 마커 쪽은 목록 모드에서만 읽는다 */
  const hoverPlace = useCallback((id: string | null) => {
    setHoveredId(id);
  }, []);

  /** 제보 성공으로 생긴 가게를 목록·마커에 추가 */
  const addPlace = useCallback((place: Place) => {
    setPlaces((prev) => [...prev, place]);
  }, []);


  /** 찜 토글 — 목 단계는 클라이언트 메모리(lib/data.ts, 세션별). 확인일은 갱신하지 않는다. 익명 3개째에 넛지 한 번. */
  const toggleBookmark = useCallback(
    (id: string) => {
      // 요청 시점의 세션을 기억한다 — 토글 중 로그아웃·승계·탈퇴가 끼면 늦게 온 이전 사용자의 목록이
      // 새 세션 화면에 앉는다(목은 지연 400ms라 창이 넉넉하고, Phase 6 왕복에선 더 넓다).
      const requestedFor = session?.userId ?? null;
      // 연타에도 방향이 맞게: 진행 중인 낙관 상태가 있으면 그것을, 없으면 화면 목록을 기준으로 뒤집는다
      const now = pendingBookmarksRef.current.get(id) ?? bookmarkedIdsRef.current.includes(id);
      const wanted = !now;
      pendingBookmarksRef.current.set(id, wanted);
      // 낙관 업데이트 — 하트는 누르는 즉시 바뀐다(쓰기는 상태 변화까지, UI 완성 기준)
      setBookmarkedIds((prev) =>
        wanted ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id),
      );
      requestToggleBookmark(id).then(
        (ids) => {
          pendingBookmarksRef.current.delete(id);
          if (requestedFor !== null && requestedFor !== sessionRef.current) return;
          setBookmarkedIds(withPendingBookmarks(ids));
          if (
            session?.provider === "anonymous" &&
            ids.length === BOOKMARK_NUDGE_AT &&
            ids.includes(id) &&
            !bookmarkNudgedRef.current
          ) {
            bookmarkNudgedRef.current = true;
            showNotice(BOOKMARK_NUDGE_NOTICE);
          }
        },
        () => {
          pendingBookmarksRef.current.delete(id);
          if (requestedFor !== null && requestedFor !== sessionRef.current) return;
          // 롤백 — 되돌릴 때 이미 들어와 있는지 보고 중복을 만들지 않는다
          setBookmarkedIds((prev) =>
            wanted ? prev.filter((x) => x !== id) : prev.includes(id) ? prev : [...prev, id],
          );
          showNotice("찜을 저장하지 못했어요");
        },
      );
    },
    [session, showNotice, withPendingBookmarks],
  );

  /* ── 내 활동 패널 (화면 5): 시트 me 모드, 히스토리 엔트리 하나(URL은 /) ── */
  /** 검색 바 프로필 버튼 — 익명이면 로그인 시트가 먼저 서고, 로그인하면 바로 열린다 */
  const openMe = useCallback(() => {
    void requireLogin("me").then((ok) => {
      if (!ok || meOpenRef.current) return;
      const state: SaeuHistoryState = { saeuMe: true };
      if (detailIdRef.current !== null) {
        // 상세 위에서 눌렀다: back()을 기다렸다 push하면 순서가 꼬이므로 엔트리를 바꾼다.
        // 목록에서 연 상세면 그 엔트리를 패널로(뒤로 한 번에 목록), 직접 진입(/place/[id])이면
        // 목록 엔트리로 만든 뒤 패널을 얹는다 — 안 그러면 닫기의 back()이 이 사이트 밖으로 나간다
        setDetailId(null);
        if (isDetailHistoryState(window.history.state)) {
          window.history.replaceState(state, "", "/");
        } else {
          window.history.replaceState(null, "", "/");
          window.history.pushState(state, "", "/");
        }
      } else {
        listSnapRef.current = snapRef.current;
        window.history.pushState(state, "", "/");
      }
      setMeOpen(true);
      setSnap("full");
    });
  }, [requireLogin]);

  const closeMe = useCallback((source: "ui" | "history" = "ui") => {
    setMeOpen(false);
    setMePlaceIds([]);
    setMeTab("bookmarks"); // 다음에 열 때도 기본은 찜 (design 화면 5-2)
    setSnap(listSnapRef.current);
    if (source === "ui" && isMeHistoryState(window.history.state)) window.history.back();
  }, []);

  /** 로그아웃·탈퇴 — 패널을 닫고 알린다. 찜은 세션 effect가 새 사용자 것으로 바꾼다 */
  const handleSignedOut = useCallback(() => {
    closeMe();
    showNotice("로그아웃했어요");
  }, [closeMe, showNotice]);
  const handleAccountDeleted = useCallback(() => {
    closeMe();
    showNotice("탈퇴했어요");
  }, [closeMe, showNotice]);

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
      const state: unknown = window.history.state;
      const id = placeIdFromPath(window.location.pathname);
      if (id) {
        openDetail(id, "history");
        return;
      }
      if (detailIdRef.current !== null) closeDetail("history");
      // 내 활동: 표식 없는 엔트리로 돌아왔으면 닫고(오버레이 엔트리는 표식을 안고 있다), 표식이 있는데 닫혀 있으면 연다(앞으로 가기)
      if (meOpenRef.current && !isMeHistoryState(state)) {
        closeMe("history");
      } else if (!meOpenRef.current && isMeHistoryState(state)) {
        setMeOpen(true);
        setSnap("full");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [openDetail, closeDetail, closeReportFlow, goToReportStep, closeMe]);

  /** 데스크탑 줌 컨트롤 (design 화면 6). 프로그램 이동으로 표시해 정렬 기준점을 흔들지 않는다 */
  const zoomIn = useCallback(() => {
    programmaticMoveAt.current = performance.now();
    mapRef.current?.zoomBy(1);
  }, [mapRef]);
  const zoomOut = useCallback(() => {
    programmaticMoveAt.current = performance.now();
    mapRef.current?.zoomBy(-1);
  }, [mapRef]);

  /** 현위치 버튼: 명시적 요청이라 서울 밖이어도 그 위치로 간다. 실패는 안내만. */
  const locateMe = useCallback(() => {
    void requestPosition().then((res) => {
      if (!res.ok) {
        // 거부는 다시 눌러도 팝업이 안 뜬다 — "다시 시도"로 읽히면 버튼만 계속 누르게 된다
        showNotice(
          res.reason === "denied"
            ? "위치 권한이 꺼져 있어요. 브라우저 설정에서 허용해주세요"
            : "위치를 가져올 수 없어요",
        );
        return;
      }
      setUserLocation(res.point);
      if (!mapRef.current) return;
      programmaticMoveAt.current = performance.now();
      mapRef.current.focus(res.point, USER_ZOOM, {
        screenX: stripCenterX(),
        screenY: stripCenterY(),
      });
      setFollowing(true);
    });
  }, [mapRef, showNotice, stripCenterY, stripCenterX]);

  return {
    // 상태
    places,
    hoveredId: mode === "list" ? hoveredId : null,
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
    reviewIntentId,
    meOpen,
    meTab,
    bookmarkedPlaces,
    userLocation,
    following,
    /** 거리 표시·"가까운순" 기준점: 내 위치 → 없으면 지도 중심 (결정 2026-09-02, 플랜 결정 1 갱신) */
    origin,
    eventDismissed,
    status,
    mapErrorReason: mapError,
    emptyKind,
    bookmarksStatus,
    // 파생
    items,
    sorted,
    inViewCount: inView.length,
    areaLabel,
    // /place/[id] 직접 진입은 그 핀·줌 14(현위치 줌과 동일)에서 시작해 공유 링크로 핀이 바로 보인다.
    // 아니면: 위치가 SDK보다 먼저 왔을 때 서울 근교일 때만 그 위치·줌 14 (밖이면 서울 중심 — 결정 "위치 폴백")
    initialCenter: initialPlace ?? initialGu?.center ?? densestCenter ?? SEOUL_CENTER,
    initialZoom: initialPlace ? USER_ZOOM : initialGu ? GU_ZOOM : INITIAL_ZOOM,
    // 액션
    setTab,
    toggleChip,
    clearFilters,
    setQuery,
    clearQuery,
    submitSearch,
    setSort,
    setSnap,
    selectFromMarker,
    selectFromCard,
    hoverPlace,
    closeDetail,
    patchPlace,
    markChecked,
    toggleBookmark,
    handleClusterClick,
    handleViewportChange,
    handleUserPan,
    handleMapError,
    handleMissingConfig,
    dismissEvent,
    showNotice,
    locateMe,
    zoomIn,
    zoomOut,
    openMe,
    closeMe,
    setMeTab,
    setMePlaceIds,
    handleSignedOut,
    handleAccountDeleted,
    retryBookmarks,
    openReport,
    cancelReport,
    backReportStep,
    goToReportStep,
    moveReportPin,
    clearReportCandidate,
    showReportPair,
    openDetailFromReport,
    clearReviewIntent,
    addPlace,
  };
}

export type MapScreenState = ReturnType<typeof useMapScreen>;
