import type {
  BoundsLiteral,
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
      case "bookmarked":
        if (!bookmarkedIds.has(place.id)) return false;
        break;
      case "new":
        if (!place.isNew) return false;
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

/**
 * 대표 메뉴 한 줄 — "왕새우 소금구이 1kg 35,000원". 메뉴가 없으면 null (제보 완료 카드·신규 패널 행).
 * 크롤 메뉴명에 단위가 이미 들어 있으면("생새우대하구이 한판" + 한판) 단위를 한 번만 쓴다.
 */
export function primaryMenuLine(place: Place): string | null {
  const menu = primaryMenu(place);
  if (!menu) return null;
  const unit = unitChipLabel(menu);
  const unitDuplicated = unit !== null && menu.name.replace(/\s+/g, "").includes(unit.replace(/\s+/g, ""));
  return [menu.name, unitDuplicated ? null : unit, menu.price !== null ? `${formatPrice(menu.price)}원` : null]
    .filter(Boolean)
    .join(" ");
}

/**
 * 카드용 대표 메뉴 — **가격을 앞세우고 이름은 보조로** 나눠 준다(한 줄 문자열로는 가격만 강조할 수 없다).
 * 가격 미상이면 null: 카드에서 그 줄 자체가 사라진다.
 */
export function primaryMenuParts(place: Place): { price: string; name: string } | null {
  const menu = primaryMenu(place);
  if (!menu || menu.price === null) return null;
  const unit = unitChipLabel(menu);
  const unitDuplicated =
    unit !== null && menu.name.replace(/\s+/g, "").includes(unit.replace(/\s+/g, ""));
  return {
    price: `${formatPrice(menu.price)}원`,
    name: [menu.name, unitDuplicated ? null : unit].filter(Boolean).join(" "),
  };
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

/** 뷰포트 안 가게가 이 비율 이상이면 그 시도 "전체"(시도가 여럿이면 "전국")로 본다 */
const WHOLE_CITY_RATIO = 0.6;
/** 시군구가 이만큼 섞이면 그 시도 "전체" */
const WHOLE_CITY_GU_COUNT = 8;
/** 최다 시도가 이 비율 이상이면 나머지는 곁다리로 보고 그 시도로 취급한다 */
const SIDO_DOMINANT_RATIO = 0.8;
/**
 * 뷰포트 가로·세로가 둘 다 이만큼(도) 넘으면 "전국"으로 본다. 남한은 경도 125.9~129.6·위도 33.1~38.6이라
 * 3°면 "동서로도 남북으로도 나라 규모"가 된다 — 폰 줌 7(4.3°×6.1°)·데스크탑 줌 8(7.9°×3.9°)이 여기 걸리고,
 * 폰 줌 8(2.1°×3.1°)·데스크탑 줌 9(4.0°×2.0°)는 한 축이 모자라 안 걸린다.
 */
const NATIONWIDE_SPAN_DEG = 3;
/**
 * 가게 0곳인 뷰포트를 시군구가 아니라 **시도**로 부르는 문턱. 시군구 하나가 대략 0.1~0.3°라
 * 0.5°를 넘으면 "한 동네"보다 넓게 보고 있다는 뜻이다 — 폰 줌 10(0.54°×0.76°)·데스크탑 줌 10부터 걸리고,
 * 폰 줌 11(0.27°×0.38°)·데스크탑 줌 12(0.49°×0.25°)는 안 걸린다.
 */
const SIDO_SPAN_DEG = 0.5;

/**
 * 여러 시도에 같은 이름이 있는 시군구 — 이름만 쓰면 어디인지 모른다. 경계 파일 251개(서울 25 + 전국 226)
 * 중 30개(12%)가 여기 걸린다: 중구 6(서울 포함)·동구 6·남구 5·서구 5·북구 4·강서구 2(서울/부산)·고성군 2.
 * 상수인 이유는 `SEOUL_GU`와 같다 — 라벨 한 줄 만들자고 240KB 경계 파일을 읽지 않는다.
 * **파일과 어긋나면 `places.test.ts`가 잡는다.**
 */
export const AMBIGUOUS_SIGUNGU: ReadonlySet<string> = new Set([
  "중구",
  "동구",
  "남구",
  "서구",
  "북구",
  "강서구",
  "고성군",
]);

/**
 * 화면에 쓸 시군구 이름. 서울은 그대로("강서구"), 서울 밖에서 이름이 겹치면 시도를 앞에 붙인다("부산 강서구").
 *
 * **서울을 생략하는 게 규칙이다** — `Place.gu`가 이미 "괄호가 없으면 서울"이고(decisions 2026-09-04),
 * 화면에서도 "접두어가 없으면 서울"이 되어 문법이 하나로 맞는다. 서울 우선 제품이라 "서울 강서구"는 과하다.
 * 접두어를 뒤 괄호가 아니라 앞에 두는 건 뉴스·주소·배달앱이 쓰는 "광주 서구" 순서를 따른 것이다.
 */
function sigunguLabel(sido: string, sigungu: string): string {
  return sido === "서울" || !AMBIGUOUS_SIGUNGU.has(sigungu) ? sigungu : `${sido} ${sigungu}`;
}

/** 뷰포트 가로·세로가 **둘 다** 이만큼(도) 되나. 데스크탑은 가로만 넓어서 한 축만 보면 과판정된다. */
function spansAtLeast(bounds: BoundsLiteral, deg: number): boolean {
  return bounds.east - bounds.west >= deg && bounds.north - bounds.south >= deg;
}

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

/**
 * `Place.gu`를 시도와 시군구로 쪼갠다 — "마포구" → 서울·마포구, "김포시(경기)" → 경기·김포시,
 * "창원시 진해구(경남)" → 경남·창원시 진해구. 괄호가 없으면 서울이다(decisions 2026-09-04).
 */
function splitGu(gu: string): { sido: string; sigungu: string } {
  const open = gu.indexOf("(");
  if (open === -1 || !gu.endsWith(")")) return { sido: "서울", sigungu: gu };
  return { sido: gu.slice(open + 1, -1), sigungu: gu.slice(0, open) };
}

/** 가장 많은 키. 동률은 가나다순으로 고정해 지도를 조금 움직일 때마다 라벨이 튀지 않게 한다. */
function topKey(counts: ReadonlyMap<string, number>): string {
  let top = "";
  let topCount = -1;
  for (const [key, count] of counts) {
    if (count > topCount || (count === topCount && collator.compare(key, top) < 0)) {
      top = key;
      topCount = count;
    }
  }
  return top;
}

/**
 * 시트 제목용 지역 라벨. 외부 지오코딩 없이 뷰포트와 그 안 가게의 지역 분포로만 정한다(규칙 2).
 *
 * **뷰포트가 나라 규모** → "전국" / 0곳 → 지도 중심의 지역(넓게 보면 "부산", 좁게 보면 "해운대구", 모르면
 * "이 지역") / 최다 시도가 80% 미만 → 최다 시도 + " 일대"("서울 일대") /
 * 그 시도 안에서: 시군구 8개↑ 또는 전체의 60%↑ → "서울 전체" / 시군구 1개 → 그 시군구("마포구"·"김포시",
 * 이름이 겹치면 "부산 강서구") /
 * 그 외 → 최다 시군구 + " 일대".
 *
 * **"전국"만 뷰포트로 판정한다.** 시드의 93%가 서울에 몰려 있어 수도권 뷰와 전국 뷰는 *보이는 가게가 거의
 * 같다* — 분포로는 구별이 안 되고, 60% 문턱으로 잡으면 김포 한 곳이 섞인 기본 화면(줌 12)까지 "전국"이 된다
 * (2026-09-09에 실제로 그렇게 나왔다). 나머지 칸은 그대로 분포로 정한다: 줌만 보면 같은 줌에서 강남을 보든
 * 강원을 보든 같은 라벨이 나오기 때문이다.
 *
 * 최다 시도 80% 규칙이 곁다리를 걸러낸다 — 서울 37 + 김포 1이면 "서울 전체"고, 서울 20 + 경기 18이면
 * "서울 일대"다. `bounds`가 없으면(`/gu` SSR 등) "전국"은 나오지 않는다.
 *
 * `centerGu`는 **가게가 0곳일 때만** 쓴다(호출자가 `guOfPoint`로 구해 넘긴다 — 우리 경계 폴리곤이라
 * 외부 API가 아니다). 가게가 있을 때는 중심이 아니라 분포로 정한다: 중심을 쓰면 마포 12곳을 보는 화면이
 * 중심이 살짝 넘어갔다는 이유로 "서대문구"가 된다.
 */
export function areaLabel(
  visible: readonly Place[],
  total: number,
  bounds?: BoundsLiteral,
  centerGu?: string | null,
): string {
  if (bounds && spansAtLeast(bounds, NATIONWIDE_SPAN_DEG)) return "전국";
  if (visible.length === 0) {
    if (centerGu === undefined || centerGu === null) return "이 지역";
    const { sido, sigungu } = splitGu(centerGu);
    return bounds && spansAtLeast(bounds, SIDO_SPAN_DEG) ? sido : sigunguLabel(sido, sigungu);
  }

  const bySido = new Map<string, number>();
  for (const p of visible) {
    const { sido } = splitGu(p.gu);
    bySido.set(sido, (bySido.get(sido) ?? 0) + 1);
  }
  const sido = topKey(bySido);
  if ((bySido.get(sido) ?? 0) < visible.length * SIDO_DOMINANT_RATIO) return `${sido} 일대`;

  const bySigungu = new Map<string, number>();
  for (const p of visible) {
    const split = splitGu(p.gu);
    if (split.sido === sido) bySigungu.set(split.sigungu, (bySigungu.get(split.sigungu) ?? 0) + 1);
  }
  if (
    bySigungu.size >= WHOLE_CITY_GU_COUNT ||
    (total > 0 && visible.length >= total * WHOLE_CITY_RATIO)
  ) {
    return `${sido} 전체`;
  }
  const top = sigunguLabel(sido, topKey(bySigungu));
  return bySigungu.size === 1 ? top : `${top} 일대`;
}
