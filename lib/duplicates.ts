import { haversineKm } from "./geo";
import type { LatLng, Place } from "./types";

/**
 * 중복 가게 판정 — 크롤러 `collect.py`의 `same_place`를 그대로 이식했다(spec 4.3-2).
 * 150m 안이면서 정규화한 상호가 서로 포함되거나 difflib ratio 0.85 이상이면 같은 가게로 본다.
 */

export const DUPLICATE_RADIUS_KM = 0.15;
export const NAME_SIMILARITY_MIN = 0.85;
/** 핀 자리 근접 검사 — 상호와 무관하게 이 안에 기존 가게가 있으면 묻는다(같은 건물·옆 점포 거리, decisions 2026-09-04 보완). */
export const PIN_OVERLAP_KM = 0.03;
/** 1단계 자동완성은 두 글자부터 (design 화면 3-1). */
/** 자동완성은 **한 글자부터** 뜬다 — 다른 지도 앱과 같은 기대치다(2026-09-08). 결과는 아래 limit으로 잘린다. */
export const NAME_MATCH_MIN_CHARS = 1;
export const NAME_MATCH_LIMIT = 5;

export type PlaceLike = Pick<Place, "name" | "lat" | "lng">;

/** collect.py `norm_name`: 공백·기호를 떼고 소문자로. */
export function normalizeName(s: string): string {
  return s.replace(/[\s\-.()&'·,]/g, "").toLowerCase();
}

const CHOSEONG = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
] as const;
const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;

/** "나라수산" → "ㄴㄹㅅㅅ". 한글이 아닌 글자는 그대로 둔다(영문·숫자 상호도 같이 검색된다). */
export function choseongOf(s: string): string {
  return Array.from(s)
    .map((ch) => {
      const code = ch.charCodeAt(0) - HANGUL_BASE;
      if (ch.charCodeAt(0) < HANGUL_BASE || ch.charCodeAt(0) > HANGUL_LAST) return ch;
      return CHOSEONG[Math.floor(code / 588)] ?? ch;
    })
    .join("");
}

/** 사용자가 초성만 친 경우("ㄴㄹㅅㅅ") — 그때만 초성 인덱스로 찾는다 */
function isChoseongOnly(token: string): boolean {
  return /^[\u3131-\u314e]+$/.test(token);
}

/**
 * difflib `find_longest_match`: 범위 안 가장 긴 공통 부분열.
 * 동률이면 a에서 먼저 시작하는 것, 그중에서도 b에서 먼저 시작하는 것.
 */
function longestMatch(
  a: readonly string[],
  b: readonly string[],
  alo: number,
  ahi: number,
  blo: number,
  bhi: number,
): [i: number, j: number, k: number] {
  let bestI = alo;
  let bestJ = blo;
  let bestK = 0;
  // 공통 접미사 길이 DP. prev[jj]는 a[i-1]·b[blo+jj-1]에서 끝나는 길이.
  let prev = new Array<number>(bhi - blo + 1).fill(0);
  for (let i = alo; i < ahi; i++) {
    const cur = new Array<number>(bhi - blo + 1).fill(0);
    for (let j = blo; j < bhi; j++) {
      if (a[i] !== b[j]) continue;
      const jj = j - blo + 1;
      const k = (prev[jj - 1] ?? 0) + 1;
      cur[jj] = k;
      const startI = i - k + 1;
      const startJ = j - k + 1;
      if (
        k > bestK ||
        (k === bestK &&
          (startI < bestI || (startI === bestI && startJ < bestJ)))
      ) {
        bestI = startI;
        bestJ = startJ;
        bestK = k;
      }
    }
    prev = cur;
  }
  return [bestI, bestJ, bestK];
}

/** difflib `get_matching_blocks`의 합: 가장 긴 블록을 잡고 양쪽 남은 범위에서 재귀. */
function matchingChars(
  a: readonly string[],
  b: readonly string[],
  alo: number,
  ahi: number,
  blo: number,
  bhi: number,
): number {
  const [i, j, k] = longestMatch(a, b, alo, ahi, blo, bhi);
  if (k === 0) return 0;
  return (
    k +
    matchingChars(a, b, alo, i, blo, j) +
    matchingChars(a, b, i + k, ahi, j + k, bhi)
  );
}

/** difflib `SequenceMatcher(None, a, b).ratio()`: 2M / (|a| + |b|). 둘 다 비면 1. */
export function similarityRatio(a: string, b: string): number {
  const ca = Array.from(a);
  const cb = Array.from(b);
  const total = ca.length + cb.length;
  if (total === 0) return 1;
  return (2 * matchingChars(ca, cb, 0, ca.length, 0, cb.length)) / total;
}

/** collect.py `same_place`: 150m 안 + 상호 포함 관계 또는 ratio ≥ 0.85. */
export function samePlace(a: PlaceLike, b: PlaceLike): boolean {
  if (haversineKm(a, b) > DUPLICATE_RADIUS_KM) return false;
  const na = normalizeName(a.name);
  const nb = normalizeName(b.name);
  return (
    na.includes(nb) || nb.includes(na) || similarityRatio(na, nb) >= NAME_SIMILARITY_MIN
  );
}

/** 후보와 같은 가게로 보이는 것 중 가장 가까운 가게. 없으면 null. */
export function findDuplicate(
  candidate: PlaceLike,
  places: readonly Place[],
): Place | null {
  let best: Place | null = null;
  let bestKm = Number.POSITIVE_INFINITY;
  for (const place of places) {
    if (!samePlace(candidate, place)) continue;
    const km = haversineKm(candidate, place);
    if (km < bestKm) {
      best = place;
      bestKm = km;
    }
  }
  return best;
}

/** 핀 자리(PIN_OVERLAP_KM 안)에 있는 가장 가까운 가게 — 상호는 보지 않는다. 없으면 null. */
export function findOverlapping(point: LatLng, places: readonly Place[]): Place | null {
  let best: Place | null = null;
  let bestKm = Number.POSITIVE_INFINITY;
  for (const place of places) {
    const km = haversineKm(point, place);
    if (km > PIN_OVERLAP_KM) continue;
    if (best === null || km < bestKm) {
      // 같은 거리면 먼저 온 가게 — 목록 순서가 곧 우선순위라 반복 확정에서도 같은 후보가 나온다
      best = place;
      bestKm = km;
    }
  }
  return best;
}

/** 1단계 자동완성: 정규화한 질의(두 글자 이상)가 상호에 포함되는 가게를 닮은 순으로 최대 5곳. */
/**
 * 1단계 가게명 자동완성 (spec 4.3-1). **중복 판정(`same_place`)과는 다른 함수다** — 여기는 느슨해도
 * 되고, 거기는 엄격해야 한다. 세 가지를 받아준다 (2026-09-08 사용자 지적 "너무 빡빡하다"):
 *   1. **한 글자부터** (`NAME_MATCH_MIN_CHARS`)
 *   2. **띄어쓴 토큰은 순서 무관** — "목동 홍초장"이 "홍초장 목동점"을 찾는다
 *   3. **초성** — "ㄴㄹㅅㅅ"이 "나라수산"을 찾는다(초성만 친 토큰에만 적용, 오검색을 늘리지 않게)
 * 정렬은 전체 문자열 유사도 순이고 limit으로 자른다.
 */
export function findNameMatches(
  query: string,
  places: readonly Place[],
  limit = NAME_MATCH_LIMIT,
): Place[] {
  const q = normalizeName(query);
  if (Array.from(q).length < NAME_MATCH_MIN_CHARS) return [];
  const tokens = query.split(/\s+/).map(normalizeName).filter(Boolean);
  const allChoseong = tokens.length > 0 && tokens.every(isChoseongOnly);
  return places
    .map((place) => {
      const name = normalizeName(place.name);
      return { place, name, choseong: choseongOf(name) };
    })
    .filter(({ name, choseong }) =>
      tokens.every((token) =>
        isChoseongOnly(token) ? choseong.includes(token) : name.includes(token),
      ),
    )
    // 초성 질의는 초성끼리 비교해야 "얼마나 닮았나"가 뜻을 갖는다(한글 이름과 직접 비교하면 전부 0)
    .map(({ place, name, choseong }) => ({
      place,
      ratio: similarityRatio(q, allChoseong ? choseong : name),
    }))
    .sort((x, y) => y.ratio - x.ratio)
    .slice(0, limit)
    .map(({ place }) => place);
}
