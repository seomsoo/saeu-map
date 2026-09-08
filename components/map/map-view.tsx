"use client";

import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import {
  Container,
  Marker,
  NaverMap,
  useListener,
  useMap,
  useNavermaps,
} from "react-naver-maps";
import type { ClusterItem } from "@/lib/cluster";
import type { BoundsLiteral, LatLng, Place, Viewport } from "@/lib/types";
import { isInactive } from "@/lib/time";
import { markerCategory, primaryMenuLine } from "@/lib/places";
import Image from "next/image";
import { ShrimpIcon } from "@/components/ui/icons/shrimp-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRating } from "@/lib/reviews";
import { cx } from "@/lib/cx";
import {
  PLACE_MARKER_SIZE,
  getClusterIcon,
  getPlaceMarkerIcon,
  getReportPinIcon,
  getUserLocationIcon,
} from "./marker-icons";

type Navermaps = typeof naver.maps;

export interface FitMargin {
  top?: number | undefined;
  right?: number | undefined;
  bottom?: number | undefined;
  left?: number | undefined;
  maxZoom?: number | undefined;
}

/** 지오코더 한 건 — 제보 2단계 주소 검색 행. 표시용이라 상태에 잠깐 들고 있다가 버린다(규칙 2). */
export interface AddressHit {
  roadAddress: string;
  jibunAddress: string;
  lat: number;
  lng: number;
}

/** 주소 검색 결과 상한 (design 화면 3-2: 최대 5행) */
export const GEOCODE_MAX_HITS = 5;

/** 부모가 지도를 움직일 때 쓰는 명령형 핸들. lib에는 naver 객체가 새지 않는다. */
export interface MapHandle {
  /**
   * target을 컨테이너 (screenX, screenY) 픽셀에 오도록 이동. 준 축만 보정하고 나머지는 중앙이다 —
   * 모바일은 시트에 가려 screenY만, 데스크탑은 떠 있는 패널에 가려 screenX만 준다 (design 화면 6 v3).
   * animate:false는 setCenter — 첫 페인트에서 지도가 미끄러지면 안 될 때만.
   */
  panTo(
    target: LatLng,
    options?: {
      screenX?: number | undefined;
      screenY?: number | undefined;
      animate?: boolean | undefined;
    },
  ): void;
  morph(target: LatLng, zoom: number): void;
  /** 줌을 바꾼 뒤(애니메이션 없이) panTo — 제보 2단계가 핀을 시트 위 가시 영역 가운데에 놓을 때 */
  focus(
    target: LatLng,
    zoom: number,
    options?: { screenX?: number | undefined; screenY?: number | undefined },
  ): void;
  fitBounds(bounds: BoundsLiteral, margin?: FitMargin): void;
  /** 줌 한 단계(데스크탑 [+][−]). 애니메이션, min/max 안에서 */
  zoomBy(delta: 1 | -1): void;
  getViewport(): Viewport | null;
  /**
   * 도로명 주소 검색(네이버 지오코더 서브모듈). 지도 중심 근처를 우선한 결과 최대 GEOCODE_MAX_HITS건.
   * 서브모듈이 안 실렸거나 응답이 실패하면 reject — 호출자는 4상태의 '실패'로 보여준다.
   * 결과는 어디에도 저장하지 않는다(규칙 2). 저장되는 것은 사용자가 확정한 핀 좌표뿐.
   */
  geocode(query: string): Promise<AddressHit[]>;
}

/** 마커 hover 툴팁 — 가게 + 컨테이너 픽셀 위치 (design 화면 6). 마우스가 마커에 있는 동안만 산다 */
interface MarkerTooltipState {
  place: Place;
  x: number;
  y: number;
  /** hover 시점의 지도 컨테이너 폭 — 사진 카드가 가장자리에서 잘리지 않게 물리는 데 쓴다 */
  containerWidth: number;
}

export interface MapViewProps {
  items: ClusterItem[];
  selectedId: string | null;
  /** 데스크탑: 목록에서 hover 중인 가게 — 그 마커만 확대. null이면 없음 */
  hoveredId?: string | null | undefined;
  /** 서버가 내려준 기준 시각(ISO). 6개월 무활동 판정용 — 렌더 중 new Date() 금지. */
  now: string;
  initialCenter: LatLng;
  initialZoom: number;
  handleRef: Ref<MapHandle>;
  onViewportChange: (viewport: Viewport) => void;
  onPlaceClick: (placeId: string) => void;
  onClusterClick: (clusterId: number, center: LatLng) => void;
  /** 내 위치(파란 점). 권한이 없거나 아직 모르면 null — 마커를 안 그린다. */
  userLocation?: LatLng | null | undefined;
  /** 제보 2단계의 끌 수 있는 핀. null·undefined면 없음. */
  pin?: LatLng | null | undefined;
  /** 핀을 끌어 놓았을 때의 좌표 */
  onPinChange?: ((point: LatLng) => void) | undefined;
  /** 지도 빈 곳 탭(click·tap) — 제보 2단계가 핀을 그 자리로 옮긴다. 없으면 무시 */
  onMapTap?: ((point: LatLng) => void) | undefined;
  /** 사용자가 지도를 끌기 시작했다. idle과 달리 프로그램 이동과 절대 섞이지 않는다 — 현위치 추적 해제용 */
  onUserPan?: (() => void) | undefined;
  /**
   * NCP 인증 실패(키 오류·미등록 도메인). 스크립트는 정상 로드되고 SDK가 window.navermap_authFailure를
   * 부를 뿐이라 ErrorBoundary로는 잡히지 않는다 — 여기서 에러 상태로 넘긴다.
   */
  onAuthFailure: () => void;
}

type WindowWithNaverAuth = Window & {
  navermap_authFailure?: (() => void) | undefined;
};

function useNaverAuthFailure(onAuthFailure: () => void): void {
  useEffect(() => {
    const w = window as WindowWithNaverAuth;
    const previous = w.navermap_authFailure;
    w.navermap_authFailure = () => {
      onAuthFailure();
    };
    return () => {
      w.navermap_authFailure = previous;
    };
  }, [onAuthFailure]);
}

const MIN_ZOOM = 10;
const MAX_ZOOM = 19;

/* 마커 hover 프리뷰 (design 화면 6 v3) — 진입은 지연, 이탈은 유예. 지연이 없으면 지도를 가로지르는 동안
   프리뷰가 줄줄이 번쩍이고, 유예가 없으면 마커 사이를 옮길 때마다 깜빡인다. */
const HOVER_ENTER_MS = 150;
const HOVER_LEAVE_MS = 300;
/** 프리뷰 카드 폭·사진 높이 — 가장자리 플립 계산에 쓰므로 CSS(w-62·h-27.5)와 같아야 한다 */
const PREVIEW_WIDTH = 248;
const PREVIEW_HEIGHT = 176;
/** 사진 없는 집의 2줄 텍스트 툴팁 높이(대략) */
const TOOLTIP_HEIGHT = 56;
const PREVIEW_GAP = 8;

export function MapView({
  items,
  selectedId,
  hoveredId = null,
  now,
  initialCenter,
  initialZoom,
  handleRef,
  onViewportChange,
  onPlaceClick,
  onClusterClick,
  pin,
  userLocation,
  onPinChange,
  onMapTap,
  onUserPan,
  onAuthFailure,
}: MapViewProps) {
  useNaverAuthFailure(onAuthFailure);

  // 마커 hover 프리뷰 (마우스만 — 터치는 mouseover가 안 온다). 지도를 끌거나 줌하면 닫힌다.
  const [tooltip, setTooltip] = useState<MarkerTooltipState | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const enterTimer = useRef<number | null>(null);
  const leaveTimer = useRef<number | null>(null);
  const clearTimers = useCallback(() => {
    if (enterTimer.current !== null) window.clearTimeout(enterTimer.current);
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    enterTimer.current = null;
    leaveTimer.current = null;
  }, []);

  // 렌더 중 ref 쓰기 금지(react-hooks/refs) — effect로 동기화한다. 리포의 다른 훅과 같은 문법이다
  const selectedIdRef = useRef(selectedId);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const handleMarkerHover = useCallback(
    (place: Place, offset: { x: number; y: number } | null) => {
      // 선택된 핀은 패널이 이미 상세다 — 프리뷰를 겹쳐 그리지 않는다 (design 화면 7)
      if (offset && place.id === selectedIdRef.current) return;
      if (offset) {
        if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
        if (enterTimer.current !== null) window.clearTimeout(enterTimer.current);
        enterTimer.current = window.setTimeout(() => {
          setTooltip({
            place,
            x: offset.x,
            y: offset.y,
            containerWidth: wrapperRef.current?.clientWidth ?? 0,
          });
        }, HOVER_ENTER_MS);
        return;
      }
      if (enterTimer.current !== null) window.clearTimeout(enterTimer.current);
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
      leaveTimer.current = window.setTimeout(() => {
        // 닫기는 "그 가게의 프리뷰일 때만" — 마커가 리클러스터로 사라지며 부르는 정리가 다른 프리뷰를 지우지 않게
        setTooltip((prev) => (prev?.place.id === place.id ? null : prev));
      }, HOVER_LEAVE_MS);
    },
    [],
  );
  const clearTooltip = useCallback(() => {
    clearTimers();
    setTooltip(null);
  }, [clearTimers]);
  /**
   * 마커를 누르면 **이미 떠 있는 프리뷰도 닫는다**. hover 가드는 앞으로의 진입만 막는데, 마우스를 안 움직인 채
   * 클릭하면 mouseout이 없고 `panTo`는 drag·zoom 이벤트를 내지 않아 프리뷰가 상세 위에 남는다 (Codex PR #10 #3).
   * effect가 아니라 클릭에 붙인다 — 트리거는 선택 상태가 아니라 사용자의 행동이다(effect 안 setState 금지).
   */
  const handlePlaceClick = useCallback(
    (placeId: string) => {
      clearTooltip();
      onPlaceClick(placeId);
    },
    [clearTooltip, onPlaceClick],
  );
  useEffect(() => clearTimers, [clearTimers]);

  return (
    <div ref={wrapperRef} className="relative h-full w-full">
      <Container
        style={{ position: "relative", width: "100%", height: "100%" }}
        fallback={
          <Skeleton
            className="h-full w-full rounded-none"
            data-testid="map-skeleton"
          />
        }
      >
        <NaverMap
          defaultCenter={initialCenter}
          defaultZoom={initialZoom}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          zoomControl={false}
          scaleControl={false}
          mapDataControl={false}
        >
          <MapController
            handleRef={handleRef}
            onViewportChange={onViewportChange}
            onMapTap={onMapTap}
            onUserPan={onUserPan}
            onMoveStart={clearTooltip}
          />
          <PlaceMarkers
            items={items}
            selectedId={selectedId}
            hoveredId={hoveredId}
            now={now}
            onPlaceClick={handlePlaceClick}
            onClusterClick={onClusterClick}
            onPlaceHover={handleMarkerHover}
          />
          {userLocation && <UserLocationMarker position={userLocation} />}
          {pin && <ReportPin position={pin} onChange={onPinChange} />}
        </NaverMap>
      </Container>
      {tooltip && <MarkerPreview {...tooltip} />}
    </div>
  );
}

/**
 * 마커 위 프리뷰 (design 화면 6 v3): **사진 있는 집은 사진 카드**(폭 248, 사진 110), 없으면 2줄 텍스트 툴팁.
 * 마커 위 8px에 뜨고, 위가 좁으면 아래로 뒤집는다. 사진 카드는 좌우가 잘리지 않게 컨테이너 안으로 물린다.
 * React가 그린다 — 마커 innerHTML(marker-icons)에는 여전히 이름을 넣지 않는다(XSS 가드 유지).
 * 포인터는 통과시킨다: 프리뷰는 읽는 것이고 클릭 대상은 마커·카드다.
 */
function MarkerPreview({ place, x, y, containerWidth }: MarkerTooltipState) {
  const menu = primaryMenuLine(place);
  const photo = place.thumbnailUrl;
  const height = photo ? PREVIEW_HEIGHT : TOOLTIP_HEIGHT;
  const anchor = PLACE_MARKER_SIZE / 2 + PREVIEW_GAP;
  const above = y - anchor - height >= 0;
  // 사진 카드는 폭을 알기에 가장자리에서 물린다. 텍스트 툴팁은 내용 폭이라 마커 중앙에 그대로 둔다.
  const left = photo
    ? Math.min(Math.max(x, PREVIEW_WIDTH / 2 + PREVIEW_GAP), containerWidth - PREVIEW_WIDTH / 2 - PREVIEW_GAP)
    : x;

  return (
    <div
      role="tooltip"
      className={cx(
        "pointer-events-none absolute z-10 -translate-x-1/2 overflow-hidden rounded-12 border border-line-hairline bg-bg shadow-card",
        above ? "-translate-y-full" : "translate-y-0",
        photo ? "w-62" : "whitespace-nowrap rounded-8 px-3 py-2",
      )}
      style={{ left, top: above ? y - anchor : y + anchor }}
    >
      {photo && (
        <Image
          src={photo}
          alt=""
          width={248}
          height={110}
          draggable={false}
          className="h-27.5 w-full object-cover"
        />
      )}
      <div className={cx(photo && "px-3 py-2.5")}>
        <p className="truncate text-body-m-semibold text-fg">{place.name}</p>
        <div className="flex items-center gap-1.5">
          {menu && (
            <p className="truncate text-caption-l-regular text-fg-secondary tabular-nums">{menu}</p>
          )}
          {place.rating && (
            <span className="flex shrink-0 items-center gap-0.5 text-caption-l-semibold text-fg tabular-nums">
              <ShrimpIcon className="size-3 translate-y-px text-brand-fg" />
              {formatRating(place.rating.average)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** 내 위치 파란 점. 탭 대상이 아니고(마커 탭은 가게만) 가게 마커보다 아래에 깔린다. */
function UserLocationMarker({ position }: { position: LatLng }) {
  const navermaps = useNavermaps();
  return (
    <Marker
      position={position}
      icon={getUserLocationIcon(navermaps)}
      title="내 위치"
      clickable={false}
      zIndex={5}
    />
  );
}

/* ────────────────────────── 뷰포트 보고 · 명령형 핸들 ────────────────────────── */

function toLatLng(navermaps: Navermaps, coord: naver.maps.Coord): LatLng {
  if (coord instanceof navermaps.LatLng) {
    return { lat: coord.lat(), lng: coord.lng() };
  }
  return { lat: coord.y, lng: coord.x };
}

function readViewport(
  navermaps: Navermaps,
  map: naver.maps.Map,
): Viewport | null {
  const bounds = map.getBounds();
  if (!(bounds instanceof navermaps.LatLngBounds)) return null;
  const ne = bounds.getNE();
  const sw = bounds.getSW();
  return {
    bounds: {
      north: ne.lat(),
      east: ne.lng(),
      south: sw.lat(),
      west: sw.lng(),
    },
    zoom: map.getZoom(),
    center: toLatLng(navermaps, map.getCenter()),
  };
}

function MapController({
  handleRef,
  onViewportChange,
  onMapTap,
  onUserPan,
  onMoveStart,
}: {
  handleRef: Ref<MapHandle>;
  onViewportChange: (viewport: Viewport) => void;
  onMapTap: ((point: LatLng) => void) | undefined;
  onUserPan: (() => void) | undefined;
  /** 지도가 움직이기 시작할 때(끌기) — 마커 툴팁을 닫는다 */
  onMoveStart: () => void;
}) {
  const map = useMap();
  const navermaps = useNavermaps();

  const report = useCallback(() => {
    const viewport = readViewport(navermaps, map);
    if (viewport) onViewportChange(viewport);
  }, [map, navermaps, onViewportChange]);

  // idle은 이동이 끝날 때마다. 초기 상태는 idle이 안 올 수 있어 마운트 시 한 번 직접 보고.
  useListener(map, "idle", report);

  /* dragstart는 손가락이 지도를 끌 때만 온다 — 프로그램 이동(panTo·morph·focus)은 안 낸다.
     idle로 사용자 조작을 가려내면 시간 창에 기대야 하고, 창 안에서 민 경우를 놓친다 (Codex PR #7 #4). */
  const handleUserPan = useCallback(() => {
    onUserPan?.();
    onMoveStart();
  }, [onUserPan, onMoveStart]);
  useListener(map, "dragstart", handleUserPan);
  // 줌이 바뀌면 마커가 옮겨 앉으므로 프리뷰도 닫는다(위치가 어긋난 채 남지 않게)
  useListener(map, "zoom_changed", onMoveStart);

  // 데스크탑은 click, 터치는 tap — 둘 다 같은 좌표라 두 번 와도 무해. 마커 위 탭은 마커가 받는다.
  const handleTap = useCallback(
    (...args: unknown[]) => {
      const e = args[0] as naver.maps.PointerEvent | undefined; // useListener는 인자를 unknown으로 넘긴다
      if (!e) return;
      onMapTap?.(toLatLng(navermaps, e.coord));
    },
    [navermaps, onMapTap],
  );
  useListener(map, "click", handleTap);
  useListener(map, "tap", handleTap);
  useEffect(() => {
    report();
  }, [report]);

  useImperativeHandle(handleRef, () => {
    const panTo: MapHandle["panTo"] = (target, options) => {
      const latlng = new navermaps.LatLng(target.lat, target.lng);
      const move = (coord: naver.maps.Coord) => {
        if (options?.animate === false) map.setCenter(coord);
        else map.panTo(coord);
      };
      const { screenX, screenY } = options ?? {};
      if (screenX === undefined && screenY === undefined) {
        move(latlng);
        return;
      }
      // target이 (screenX ?? 가로중앙, screenY ?? 세로중앙)에 오도록 중심을 계산해 이동
      const projection = map.getProjection();
      const size = map.getSize();
      const offset = projection.fromCoordToOffset(latlng);
      const centerOffset = new navermaps.Point(
        screenX === undefined ? offset.x : size.width / 2 + (offset.x - screenX),
        screenY === undefined ? offset.y : size.height / 2 + (offset.y - screenY),
      );
      move(projection.fromOffsetToCoord(centerOffset));
    };
    return {
      panTo,
      morph(target, zoom) {
        map.morph(new navermaps.LatLng(target.lat, target.lng), zoom);
      },
      focus(target, zoom, options) {
        // 줌은 즉시(effect=false) — 애니메이션 중에는 투영이 옛 줌이라 screenY 계산이 어긋난다
        if (map.getZoom() !== zoom) map.setZoom(zoom, false);
        panTo(target, options);
      },
      fitBounds(bounds, margin) {
        const latLngBounds = new navermaps.LatLngBounds(
          new navermaps.LatLng(bounds.south, bounds.west),
          new navermaps.LatLng(bounds.north, bounds.east),
        );
        const options: naver.maps.FitBoundsOptions = {
          ...(margin?.top !== undefined && { top: margin.top }),
          ...(margin?.right !== undefined && { right: margin.right }),
          ...(margin?.bottom !== undefined && { bottom: margin.bottom }),
          ...(margin?.left !== undefined && { left: margin.left }),
          ...(margin?.maxZoom !== undefined && { maxZoom: margin.maxZoom }),
        };
        map.fitBounds(latLngBounds, options);
      },
      zoomBy(delta) {
        map.setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, map.getZoom() + delta)), true);
      },
      getViewport() {
        return readViewport(navermaps, map);
      },
      geocode(query) {
        return new Promise<AddressHit[]>((resolve, reject) => {
          // 서브모듈이 안 실렸으면(차단·네트워크) Service 자체가 없다
          const service = (navermaps as { Service?: typeof naver.maps.Service })
            .Service;
          if (!service) {
            reject(new Error("geocoder unavailable"));
            return;
          }
          const center = toLatLng(navermaps, map.getCenter());
          service.geocode(
            {
              query,
              coordinate: `${center.lng},${center.lat}`,
              count: GEOCODE_MAX_HITS,
            },
            (status, response) => {
              if (status !== service.Status.OK) {
                reject(new Error("geocode failed"));
                return;
              }
              resolve(
                response.v2.addresses
                  .slice(0, GEOCODE_MAX_HITS)
                  .flatMap((a) => {
                    const lat = Number(a.y);
                    const lng = Number(a.x);
                    if (!Number.isFinite(lat) || !Number.isFinite(lng))
                      return [];
                    return [
                      {
                        roadAddress: a.roadAddress,
                        jibunAddress: a.jibunAddress,
                        lat,
                        lng,
                      },
                    ];
                  }),
              );
            },
          );
        });
      },
    };
  }, [map, navermaps]);

  return null;
}

/* ────────────────────────── 마커 ────────────────────────── */

const PlaceMarkers = memo(function PlaceMarkers({
  items,
  selectedId,
  hoveredId,
  now,
  onPlaceClick,
  onClusterClick,
  onPlaceHover,
}: {
  items: ClusterItem[];
  selectedId: string | null;
  hoveredId: string | null;
  now: string;
  onPlaceClick: (placeId: string) => void;
  onClusterClick: (clusterId: number, center: LatLng) => void;
  onPlaceHover: (place: Place, offset: { x: number; y: number } | null) => void;
}) {
  return (
    <>
      {items.map((item) =>
        item.kind === "cluster" ? (
          <ClusterMarker
            // 인덱스 재구성 시 supercluster ID가 다른 중심으로 재사용될 수 있어 좌표까지 key에 넣어 리마운트 (Codex #1)
            key={`cluster-${item.id}-${item.lat.toFixed(5)}-${item.lng.toFixed(5)}`}
            id={item.id}
            lat={item.lat}
            lng={item.lng}
            count={item.count}
            onClick={onClusterClick}
          />
        ) : (
          <PlaceMarker
            key={item.place.id}
            place={item.place}
            selected={item.place.id === selectedId}
            hovered={item.place.id === hoveredId}
            inactive={isInactive(item.place.lastCheckedAt, now)}
            onSelect={onPlaceClick}
            onHover={onPlaceHover}
          />
        ),
      )}
    </>
  );
});

const PlaceMarker = memo(function PlaceMarker({
  place,
  selected,
  hovered,
  inactive,
  onSelect,
  onHover,
}: {
  place: Place;
  selected: boolean;
  hovered: boolean;
  inactive: boolean;
  onSelect: (placeId: string) => void;
  onHover: (place: Place, offset: { x: number; y: number } | null) => void;
}) {
  const navermaps = useNavermaps();
  const map = useMap();
  const icon = getPlaceMarkerIcon(navermaps, {
    category: markerCategory(place.tags),
    isNew: place.isNew,
    inactive,
    selected,
    hovered,
    thumbnailUrl: place.thumbnailUrl,
  });
  const handleClick = useCallback(() => {
    onSelect(place.id);
  }, [onSelect, place.id]);
  // 툴팁 위치는 마커 좌표를 컨테이너 픽셀로 (panTo와 같은 투영). 마우스 위치가 아니라 마커 위에 고정
  const handleMouseover = useCallback(() => {
    const offset = map
      .getProjection()
      .fromCoordToOffset(new navermaps.LatLng(place.lat, place.lng));
    onHover(place, { x: offset.x, y: offset.y });
  }, [map, navermaps, place, onHover]);
  const handleMouseout = useCallback(() => {
    onHover(place, null);
  }, [place, onHover]);
  // 리클러스터로 마커가 사라지면 mouseout이 안 온다 — 내 툴팁이면 정리
  useEffect(
    () => () => {
      onHover(place, null);
    },
    [place, onHover],
  );

  return (
    <Marker
      defaultPosition={{ lat: place.lat, lng: place.lng }}
      icon={icon}
      title={place.name}
      zIndex={selected ? 300 : hovered ? 250 : inactive ? 10 : 100}
      onClick={handleClick}
      onMouseover={handleMouseover}
      onMouseout={handleMouseout}
    />
  );
});

const ClusterMarker = memo(function ClusterMarker({
  id,
  lat,
  lng,
  count,
  onClick,
}: {
  id: number;
  lat: number;
  lng: number;
  count: number;
  onClick: (clusterId: number, center: LatLng) => void;
}) {
  const navermaps = useNavermaps();
  const icon = getClusterIcon(navermaps, count);
  const handleClick = useCallback(() => {
    onClick(id, { lat, lng });
  }, [onClick, id, lat, lng]);

  return (
    <Marker
      defaultPosition={{ lat, lng }}
      icon={icon}
      title={`${count}곳`}
      zIndex={200}
      onClick={handleClick}
    />
  );
});

/* ────────────────────────── 제보 핀 ────────────────────────── */

/** 제보 2단계: 끌 수 있는 핀 하나. 위치는 부모 상태(주소 검색으로도 옮겨진다), 끌어 놓으면 좌표를 올린다. */
function ReportPin({
  position,
  onChange,
}: {
  position: LatLng;
  onChange: ((point: LatLng) => void) | undefined;
}) {
  const navermaps = useNavermaps();
  const handleDragend = useCallback(
    (e: naver.maps.PointerEvent) => {
      onChange?.(toLatLng(navermaps, e.coord));
    },
    [navermaps, onChange],
  );

  return (
    <Marker
      position={position}
      draggable
      icon={getReportPinIcon(navermaps)}
      title="제보 위치"
      zIndex={400}
      onDragend={handleDragend}
    />
  );
}
