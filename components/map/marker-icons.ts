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
/** 제보 핀: 44px 히트 박스 안에 레드 머리 28 + 줄기 14, 앵커는 바닥 중앙(핀 끝이 좌표). */
export const REPORT_PIN_SIZE = 44;
/** 내 위치: 파란 점 16px, 앵커는 한가운데(점이 곧 좌표). 탭 대상이 아니라 히트 박스를 키우지 않는다. */
export const LOCATOR_SIZE = 16;

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

let reportPinIcon: naver.maps.HtmlIcon | null = null;

/**
 * 제보 2단계의 끌 수 있는 위치 핀 (design 화면 3-2). 전용 에셋 전까지 CSS 도형 — decisions "커스텀 에셋 필요 목록".
 * 모양이 하나뿐이라 아이콘 객체도 하나다(icon prop이 `===`로 비교된다).
 */
let locatorIcon: naver.maps.HtmlIcon | null = null;

/** 내 위치 표시. 가게 마커와 달리 상태가 없어 캐시가 하나면 된다. */
export function getUserLocationIcon(navermaps: Navermaps): naver.maps.HtmlIcon {
  locatorIcon ??= {
    content: '<div class="saeu-locator"></div>',
    size: new navermaps.Size(LOCATOR_SIZE, LOCATOR_SIZE),
    anchor: new navermaps.Point(LOCATOR_SIZE / 2, LOCATOR_SIZE / 2),
  };
  return locatorIcon;
}

export function getReportPinIcon(navermaps: Navermaps): naver.maps.HtmlIcon {
  reportPinIcon ??= {
    content:
      '<div class="saeu-report-pin"><span class="saeu-report-pin__head"></span><span class="saeu-report-pin__stem"></span></div>',
    size: new navermaps.Size(REPORT_PIN_SIZE, REPORT_PIN_SIZE),
    anchor: new navermaps.Point(REPORT_PIN_SIZE / 2, REPORT_PIN_SIZE),
  };
  return reportPinIcon;
}
