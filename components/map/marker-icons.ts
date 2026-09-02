import type { PlaceTag } from "@/lib/types";
import { safeAssetPath } from "@/lib/assets";

/**
 * 마커 HtmlIcon 생성 + 캐시.
 *
 * react-naver-maps는 icon prop을 `===`로 비교해 바뀌면 marker.setIcon()으로 DOM을 다시 만든다.
 * 같은 모양이면 같은 객체를 돌려줘 렌더마다 재생성되는 것을 막는다.
 *
 * content는 innerHTML로 들어간다 — 여기엔 우리 클래스명·숫자·검증된 우리 경로만 넣고, 가게 이름 같은
 * 문자열은 절대 삽입하지 않는다(이름은 Marker의 title prop으로). 스타일은 app/globals.css .saeu-marker / .saeu-cluster.
 */

type Navermaps = typeof naver.maps;

export interface PlaceMarkerStyle {
  category: PlaceTag;
  isNew: boolean;
  inactive: boolean;
  selected: boolean;
  /** 우리 스토리지 경로(/…)만. 그 외·null은 플레이스홀더(카테고리 색점). */
  thumbnailUrl: string | null;
}

/** 개별 핀 36px(썸네일 원) / 클러스터 44px(레드 원 + 가게 수). globals.css와 동일해야 한다. */
export const PLACE_MARKER_SIZE = 36;
export const CLUSTER_MARKER_SIZE = 44;

/** innerHTML에 넣어도 되는 이미지 경로 — lib/assets.ts의 공용 가드(상세 사진과 같은 규칙). */
export function safeThumbnailUrl(url: string | null): string | null {
  return safeAssetPath(url);
}

const placeIconCache = new Map<string, naver.maps.HtmlIcon>();
const clusterIconCache = new Map<number, naver.maps.HtmlIcon>();

export function getPlaceMarkerIcon(
  navermaps: Navermaps,
  style: PlaceMarkerStyle,
): naver.maps.HtmlIcon {
  const thumb = safeThumbnailUrl(style.thumbnailUrl);
  const key = [
    style.category,
    style.isNew ? 1 : 0,
    style.inactive ? 1 : 0,
    style.selected ? 1 : 0,
    thumb ?? "",
  ].join("|");
  const cached = placeIconCache.get(key);
  if (cached) return cached;

  const classes = [
    "saeu-marker",
    `saeu-marker--${style.category}`,
    style.isNew && "saeu-marker--new",
    style.inactive && "saeu-marker--inactive",
    style.selected && "saeu-marker--selected",
  ]
    .filter(Boolean)
    .join(" ");
  const inner = thumb
    ? `<img class="saeu-marker__img" src="${thumb}" alt="" draggable="false" />`
    : `<span class="saeu-marker__dot"></span>`;

  const icon: naver.maps.HtmlIcon = {
    content: `<div class="${classes}">${inner}</div>`,
    size: new navermaps.Size(PLACE_MARKER_SIZE, PLACE_MARKER_SIZE),
    anchor: new navermaps.Point(PLACE_MARKER_SIZE / 2, PLACE_MARKER_SIZE / 2),
  };
  placeIconCache.set(key, icon);
  return icon;
}

export function getClusterIcon(
  navermaps: Navermaps,
  count: number,
): naver.maps.HtmlIcon {
  const safeCount = Math.max(0, Math.floor(count));
  const cached = clusterIconCache.get(safeCount);
  if (cached) return cached;

  const icon: naver.maps.HtmlIcon = {
    content: `<div class="saeu-cluster">${safeCount}</div>`,
    size: new navermaps.Size(CLUSTER_MARKER_SIZE, CLUSTER_MARKER_SIZE),
    anchor: new navermaps.Point(CLUSTER_MARKER_SIZE / 2, CLUSTER_MARKER_SIZE / 2),
  };
  clusterIconCache.set(safeCount, icon);
  return icon;
}
