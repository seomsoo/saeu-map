"use client";

import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
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
import { markerCategory } from "@/lib/places";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getClusterIcon,
  getPlaceMarkerIcon,
  getReportPinIcon,
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
   * target을 컨테이너 y=screenY 픽셀(가로는 중앙)에 오도록 이동. 없으면 중앙.
   * animate:false는 setCenter — 첫 페인트에서 지도가 미끄러지면 안 될 때만.
   */
  panTo(
    target: LatLng,
    options?: { screenY?: number | undefined; animate?: boolean | undefined },
  ): void;
  morph(target: LatLng, zoom: number): void;
  /** 줌을 바꾼 뒤(애니메이션 없이) panTo — 제보 2단계가 핀을 시트 위 가시 영역 가운데에 놓을 때 */
  focus(
    target: LatLng,
    zoom: number,
    options?: { screenY?: number | undefined },
  ): void;
  fitBounds(bounds: BoundsLiteral, margin?: FitMargin): void;
  getViewport(): Viewport | null;
  /**
   * 도로명 주소 검색(네이버 지오코더 서브모듈). 지도 중심 근처를 우선한 결과 최대 GEOCODE_MAX_HITS건.
   * 서브모듈이 안 실렸거나 응답이 실패하면 reject — 호출자는 4상태의 '실패'로 보여준다.
   * 결과는 어디에도 저장하지 않는다(규칙 2). 저장되는 것은 사용자가 확정한 핀 좌표뿐.
   */
  geocode(query: string): Promise<AddressHit[]>;
}

export interface MapViewProps {
  items: ClusterItem[];
  selectedId: string | null;
  /** 서버가 내려준 기준 시각(ISO). 6개월 무활동 판정용 — 렌더 중 new Date() 금지. */
  now: string;
  initialCenter: LatLng;
  initialZoom: number;
  handleRef: Ref<MapHandle>;
  onViewportChange: (viewport: Viewport) => void;
  onPlaceClick: (placeId: string) => void;
  onClusterClick: (clusterId: number, center: LatLng) => void;
  /** 제보 2단계의 끌 수 있는 핀. null·undefined면 없음. */
  pin?: LatLng | null | undefined;
  /** 핀을 끌어 놓았을 때의 좌표 */
  onPinChange?: ((point: LatLng) => void) | undefined;
  /** 지도 빈 곳 탭(click·tap) — 제보 2단계가 핀을 그 자리로 옮긴다. 없으면 무시 */
  onMapTap?: ((point: LatLng) => void) | undefined;
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

export function MapView({
  items,
  selectedId,
  now,
  initialCenter,
  initialZoom,
  handleRef,
  onViewportChange,
  onPlaceClick,
  onClusterClick,
  pin,
  onPinChange,
  onMapTap,
  onAuthFailure,
}: MapViewProps) {
  useNaverAuthFailure(onAuthFailure);

  return (
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
        />
        <PlaceMarkers
          items={items}
          selectedId={selectedId}
          now={now}
          onPlaceClick={onPlaceClick}
          onClusterClick={onClusterClick}
        />
        {pin && <ReportPin position={pin} onChange={onPinChange} />}
      </NaverMap>
    </Container>
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
}: {
  handleRef: Ref<MapHandle>;
  onViewportChange: (viewport: Viewport) => void;
  onMapTap: ((point: LatLng) => void) | undefined;
}) {
  const map = useMap();
  const navermaps = useNavermaps();

  const report = useCallback(() => {
    const viewport = readViewport(navermaps, map);
    if (viewport) onViewportChange(viewport);
  }, [map, navermaps, onViewportChange]);

  // idle은 이동이 끝날 때마다. 초기 상태는 idle이 안 올 수 있어 마운트 시 한 번 직접 보고.
  useListener(map, "idle", report);

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
      const screenY = options?.screenY;
      if (screenY === undefined) {
        move(latlng);
        return;
      }
      // target이 (width/2, screenY)에 오도록 중심을 계산해 이동
      const projection = map.getProjection();
      const size = map.getSize();
      const offset = projection.fromCoordToOffset(latlng);
      const centerOffset = new navermaps.Point(
        offset.x,
        size.height / 2 + (offset.y - screenY),
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
  now,
  onPlaceClick,
  onClusterClick,
}: {
  items: ClusterItem[];
  selectedId: string | null;
  now: string;
  onPlaceClick: (placeId: string) => void;
  onClusterClick: (clusterId: number, center: LatLng) => void;
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
            inactive={isInactive(item.place.lastCheckedAt, now)}
            onSelect={onPlaceClick}
          />
        ),
      )}
    </>
  );
});

const PlaceMarker = memo(function PlaceMarker({
  place,
  selected,
  inactive,
  onSelect,
}: {
  place: Place;
  selected: boolean;
  inactive: boolean;
  onSelect: (placeId: string) => void;
}) {
  const navermaps = useNavermaps();
  const icon = getPlaceMarkerIcon(navermaps, {
    category: markerCategory(place.tags),
    isNew: place.isNew,
    inactive,
    selected,
    thumbnailUrl: place.thumbnailUrl,
  });
  const handleClick = useCallback(() => {
    onSelect(place.id);
  }, [onSelect, place.id]);

  return (
    <Marker
      defaultPosition={{ lat: place.lat, lng: place.lng }}
      icon={icon}
      title={place.name}
      zIndex={selected ? 300 : inactive ? 10 : 100}
      onClick={handleClick}
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
