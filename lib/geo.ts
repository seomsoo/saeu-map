import type { BoundsLiteral, LatLng } from "./types";

/** 서울시청. 위치 권한 없을 때의 초기 중심. */
export const SEOUL_CENTER: LatLng = { lat: 37.5665, lng: 126.978 };

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 두 좌표 사이 대권거리(km). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 거리 표시: 1km 미만은 10m 단위 "850m", 10km 미만은 "1.2km", 그 이상 "12km". */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)}m`;
  if (km < 10) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}

/** 좌표가 bounds 안인지. 날짜변경선은 고려하지 않는다(서울 전용). */
export function inBounds(point: LatLng, bounds: BoundsLiteral): boolean {
  return (
    point.lat <= bounds.north &&
    point.lat >= bounds.south &&
    point.lng <= bounds.east &&
    point.lng >= bounds.west
  );
}

/** 좌표 목록을 감싸는 bounds. 빈 목록이면 null. */
export function boundsOf(points: LatLng[]): BoundsLiteral | null {
  const first = points[0];
  if (!first) return null;
  const b: BoundsLiteral = {
    north: first.lat,
    south: first.lat,
    east: first.lng,
    west: first.lng,
  };
  for (const p of points) {
    if (p.lat > b.north) b.north = p.lat;
    if (p.lat < b.south) b.south = p.lat;
    if (p.lng > b.east) b.east = p.lng;
    if (p.lng < b.west) b.west = p.lng;
  }
  return b;
}
