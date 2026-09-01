import Supercluster from "supercluster";
import type { BoundsLiteral, Place } from "./types";

/**
 * 마커 클러스터링 — supercluster 래퍼. naver 전역을 쓰지 않는 순수 모듈.
 *
 * 네이버 지도 타일은 256px이라 extent 256으로 두면 radius가 화면 px과 1:1이다.
 * maxZoom 16: 그 이상 줌에서는 항상 단독 마커.
 */

export type ClusterItem =
  | { kind: "cluster"; id: number; lat: number; lng: number; count: number }
  | { kind: "place"; place: Place };

export interface PlaceIndex {
  getItems(bounds: BoundsLiteral, zoom: number): ClusterItem[];
  /** 클러스터가 풀리기 시작하는 줌. 클러스터 탭 시 이동 목표. */
  getExpansionZoom(clusterId: number): number;
}

interface PlacePointProps {
  placeId: string;
}

export interface ClusterOptions {
  radius?: number;
  maxZoom?: number;
}

export function buildPlaceIndex(
  places: readonly Place[],
  options: ClusterOptions = {},
): PlaceIndex {
  const byId = new Map(places.map((p) => [p.id, p]));
  const index = new Supercluster<PlacePointProps, Supercluster.AnyProps>({
    radius: options.radius ?? 60,
    maxZoom: options.maxZoom ?? 16,
    extent: 256,
  });
  index.load(
    places.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: { placeId: p.id },
    })),
  );

  return {
    getItems(bounds, zoom) {
      const features = index.getClusters(
        [bounds.west, bounds.south, bounds.east, bounds.north],
        Math.floor(zoom),
      );
      const items: ClusterItem[] = [];
      for (const f of features) {
        const [lng, lat] = f.geometry.coordinates;
        if (lng === undefined || lat === undefined) continue;
        if ("cluster" in f.properties) {
          items.push({
            kind: "cluster",
            id: f.properties.cluster_id,
            lat,
            lng,
            count: f.properties.point_count,
          });
          continue;
        }
        const place = byId.get(f.properties.placeId);
        if (place) items.push({ kind: "place", place });
      }
      return items;
    },
    getExpansionZoom(clusterId) {
      return index.getClusterExpansionZoom(clusterId);
    },
  };
}
