import type {
  ChipKey,
  LatLng,
  Menu,
  Place,
  PlaceTag,
  Sides,
  SortKey,
  TabKey,
} from "./types";
import { haversineKm } from "./geo";
import { assertNever } from "./assert-never";
import { toMs } from "./time";

/* ────────────────────────── 필터 ────────────────────────── */

export interface PlaceListFilter {
  tab: TabKey;
  chips: readonly ChipKey[];
  query: string;
  bookmarkedIds: ReadonlySet<string>;
}

/** 검색어 정규화: 공백 제거 + 소문자. "마포 구" ≈ "마포구". */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, "");
}

/** 우리 데이터 내 검색: 상호 · 구 · 동(지번) · 도로명. */
export function matchesQuery(place: Place, normalized: string): boolean {
  if (!normalized) return true;
  const haystack = [
    place.name,
    place.gu,
    place.addressJibun ?? "",
    place.addressRoad ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, "");
  return haystack.includes(normalized);
}

/** 탭 = 다중 태그 매칭 (구이+회 가게는 두 탭 모두에 나옴). */
export function matchesTab(place: Place, tab: TabKey): boolean {
  if (tab === "all") return true;
  return place.tags.includes(tab);
}

/** 사이드 3종 — 순서 고정 (칩 행·카드 미니칩·상세가 같은 순서) */
export const SIDE_KEYS: readonly (keyof Sides)[] = ["headButter", "ramen", "friedRice"];

/** 사이드 라벨 단일 출처 — 필터 칩과 카드 미니칩이 같은 문자열을 쓴다 */
export const SIDE_LABELS: Record<keyof Sides, string> = {
  headButter: "머리버터구이",
  ramen: "라면",
  friedRice: "볶음밥",
};

export function isSideChip(chip: ChipKey): chip is keyof Sides {
  return chip === "headButter" || chip === "ramen" || chip === "friedRice";
}

/** 칩은 AND — 켜진 칩 조건을 전부 만족해야 남는다. */
export function matchesChips(
  place: Place,
  chips: readonly ChipKey[],
  bookmarkedIds: ReadonlySet<string>,
): boolean {
  for (const chip of chips) {
    switch (chip) {
      case "new":
        if (!place.isNew) return false;
        break;
      case "bookmarked":
        if (!bookmarkedIds.has(place.id)) return false;
        break;
      case "headButter":
      case "ramen":
      case "friedRice":
        if (!place.sides[chip]) return false;
        break;
      default:
        return assertNever(chip);
    }
  }
  return true;
}

export function filterPlaces(
  places: readonly Place[],
  filter: PlaceListFilter,
): Place[] {
  const q = normalizeQuery(filter.query);
  return places.filter(
    (p) =>
      matchesTab(p, filter.tab) &&
      matchesChips(p, filter.chips, filter.bookmarkedIds) &&
      matchesQuery(p, q),
  );
}

/* ────────────────────────── 정렬 ────────────────────────── */

const collator = new Intl.Collator("ko");

function byName(a: Place, b: Place): number {
  return collator.compare(a.name, b.name);
}

function byRecent(a: Place, b: Place): number {
  return b.lastCheckedAt.localeCompare(a.lastCheckedAt);
}

export function distanceKm(place: Place, origin: LatLng): number {
  return haversineKm(origin, { lat: place.lat, lng: place.lng });
}

/**
 * 정렬 3종. 동률 규칙(42/50이 checkCount 0이라 필수):
 * - distance: 거리↑ → 이름
 * - recent:   lastCheckedAt↓ → 이름
 * - checks:   checkCount↓ → lastCheckedAt↓ → 이름
 * origin이 없으면 distance는 입력 순서를 유지한다(호출자가 지도 중심을 넘긴다).
 */
export function sortPlaces(
  places: readonly Place[],
  sort: SortKey,
  origin: LatLng | null,
): Place[] {
  const copy = [...places];
  switch (sort) {
    case "distance": {
      if (!origin) return copy;
      const dist = new Map(copy.map((p) => [p.id, distanceKm(p, origin)]));
      return copy.sort(
        (a, b) =>
          (dist.get(a.id) ?? 0) - (dist.get(b.id) ?? 0) || byName(a, b),
      );
    }
    case "recent":
      return copy.sort((a, b) => byRecent(a, b) || byName(a, b));
    case "checks":
      return copy.sort(
        (a, b) =>
          b.checkCount - a.checkCount || byRecent(a, b) || byName(a, b),
      );
  }
}

/** 신규 패널(화면 4): 등록일 내림차순, 등록일이 없으면 확인일. 동률은 이름. 원본 불변. */
export function sortByCreatedDesc(places: readonly Place[]): Place[] {
  const stamp = (p: Place) => toMs(p.createdAt ?? p.lastCheckedAt);
  return [...places].sort((a, b) => stamp(b) - stamp(a) || byName(a, b));
}

export const SORT_LABELS: Record<SortKey, string> = {
  distance: "가까운순",
  recent: "최근 확인순",
  checks: "확인 많은 순",
};

export const SORT_KEYS: readonly SortKey[] = ["distance", "recent", "checks"];

/* ────────────────────────── 카드 표시용 ────────────────────────── */

/** 대표 메뉴: 가격 있는 첫 메뉴 → 없으면 첫 메뉴 → 메뉴 없으면 null. */
export function primaryMenu(place: Place): Menu | null {
  return place.menus.find((m) => m.price !== null) ?? place.menus[0] ?? null;
}

/** 단위 칩 텍스트. unit_raw에 접미를 붙인다. none은 칩 없음. */
export function unitChipLabel(menu: Menu): string | null {
  const raw = menu.unit_raw?.trim();
  switch (menu.unit) {
    case "kg":
      return raw ? `${raw}kg` : null;
    case "g":
      return raw ? `${raw}g` : null;
    case "pan":
    case "count":
    case "serving":
      return raw ?? null;
    case "size":
      return raw ?? null;
    case "none":
      return null;
  }
}

/** 대표 메뉴 한 줄 — "왕새우 소금구이 1kg 35,000원". 메뉴가 없으면 null (제보 완료 카드·신규 패널 행). */
export function primaryMenuLine(place: Place): string | null {
  const menu = primaryMenu(place);
  if (!menu) return null;
  return [menu.name, unitChipLabel(menu), menu.price !== null ? `${formatPrice(menu.price)}원` : null]
    .filter(Boolean)
    .join(" ");
}

/** 마커·색점 색: 구이 우선 코랄, 회만이면 틸. */
export function markerCategory(tags: readonly PlaceTag[]): PlaceTag {
  return tags.includes("grill") ? "grill" : "raw";
}

/** 화면 라벨 (2026-09-03: 소금구이→새우구이. 메뉴 이름의 "대하소금구이"는 데이터라 그대로). 데이터 태그 이름은 grill/raw 그대로. */
export const TAG_LABELS: Record<PlaceTag, string> = {
  grill: "새우구이",
  raw: "생새우회",
};

export interface SideChip {
  key: keyof Sides;
  label: string;
  active: boolean;
}

/** 사이드 3종 — 있으면 강조, 없으면 회색. */
export function sideChips(sides: Sides): SideChip[] {
  return SIDE_KEYS.map((key) => ({ key, label: SIDE_LABELS[key], active: sides[key] }));
}

export function formatPrice(price: number): string {
  return price.toLocaleString("ko-KR");
}

/* ────────────────────────── 시트 헤더: 보고 있는 지역 ────────────────────────── */

/** 뷰포트 안 가게가 이 비율 이상이면 "서울 전체"로 본다 */
const WHOLE_CITY_RATIO = 0.6;
/** 구가 이만큼 섞이면 "서울 전체" */
const WHOLE_CITY_GU_COUNT = 8;

/**
 * 시트 제목용 지역 라벨. 외부 지오코딩 없이 뷰포트 안 가게의 구 분포로만 정한다(규칙 2).
 * 0곳 → "이 지역" / 전체의 60%↑ 또는 구 8개↑ → "서울 전체" / 구 1개 → 그 구 / 그 외 → 최다 구 + " 일대"
 */
/** 첫 지도 중심을 고를 때 세는 반경. 줌 12의 가시 영역(약 11.8×9.4km)에 내접한다. */
const DENSEST_RADIUS_KM = 5;

/**
 * 가게가 가장 몰려 있는 지점 — 첫 지도 중심. 반경 5km 안 가게 수가 최대인 가게의 좌표다.
 * 서울시청 고정보다 첫 화면에 보이는 가게가 많고(목 50곳 기준 12 → 18곳), 평균·중앙값과 달리
 * 서울 밖 제보 한두 건에 끌려가지 않는다. 데이터가 비면 null (호출자가 서울 중심으로 떨어진다).
 */
export function densestPoint(places: readonly Place[]): LatLng | null {
  const first = places[0];
  if (!first) return null;
  // 도시 규모에선 등거리 근사로 충분하다. O(n²)라 haversine의 삼각함수를 피한다.
  const kmPerLng = 111.32 * Math.cos((first.lat * Math.PI) / 180);
  const r2 = DENSEST_RADIUS_KM * DENSEST_RADIUS_KM;
  let best = first;
  let bestCount = -1;
  for (const p of places) {
    let count = 0;
    for (const q of places) {
      const dy = (q.lat - p.lat) * 111.32;
      const dx = (q.lng - p.lng) * kmPerLng;
      if (dx * dx + dy * dy <= r2) count += 1;
    }
    if (count > bestCount) {
      bestCount = count;
      best = p;
    }
  }
  return { lat: best.lat, lng: best.lng };
}

export function areaLabel(visible: readonly Place[], total: number): string {
  if (visible.length === 0) return "이 지역";
  const counts = new Map<string, number>();
  for (const p of visible) counts.set(p.gu, (counts.get(p.gu) ?? 0) + 1);
  if (
    counts.size >= WHOLE_CITY_GU_COUNT ||
    (total > 0 && visible.length >= total * WHOLE_CITY_RATIO)
  ) {
    return "서울 전체";
  }
  let top = "";
  let topCount = -1;
  for (const [gu, count] of counts) {
    if (count > topCount || (count === topCount && collator.compare(gu, top) < 0)) {
      top = gu;
      topCount = count;
    }
  }
  return counts.size === 1 ? top : `${top} 일대`;
}
