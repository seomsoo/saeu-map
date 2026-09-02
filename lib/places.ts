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
    place.addressRoad,
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

export function matchesChips(
  place: Place,
  chips: readonly ChipKey[],
  bookmarkedIds: ReadonlySet<string>,
): boolean {
  for (const chip of chips) {
    if (chip === "new" && !place.isNew) return false;
    if (chip === "bookmarked" && !bookmarkedIds.has(place.id)) return false;
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

/** 마커·색점 색: 구이 우선 코랄, 회만이면 틸. */
export function markerCategory(tags: readonly PlaceTag[]): PlaceTag {
  return tags.includes("grill") ? "grill" : "raw";
}

/** 화면 라벨 (2026-09-02: 구이→소금구이, 회→생새우회). 데이터 태그 이름은 grill/raw 그대로. */
export const TAG_LABELS: Record<PlaceTag, string> = {
  grill: "소금구이",
  raw: "생새우회",
};

export interface SideChip {
  key: keyof Sides;
  label: string;
  active: boolean;
}

/** 곁들임 3종 — 있으면 강조, 없으면 회색. */
export function sideChips(sides: Sides): SideChip[] {
  return [
    { key: "headButter", label: "머리버터구이", active: sides.headButter },
    { key: "ramen", label: "라면", active: sides.ramen },
    { key: "friedRice", label: "볶음밥", active: sides.friedRice },
  ];
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
