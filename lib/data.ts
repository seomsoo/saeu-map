/**
 * 데이터 접근 계층 — 컴포넌트는 이 파일의 함수만 호출한다 (절대 규칙 1).
 * 지금은 lib/mock/*.json을 읽고, Phase 6에서 이 파일만 Supabase로 교체한다.
 * 그래서 모든 함수는 이미 Promise를 돌려준다.
 *
 * 목 단계에서는 컴포넌트가 이 모듈을 클라이언트에서도 직접 부른다(decisions 2026-09-02 "데이터 호출 방식").
 * 그래서 `now`가 필요한 함수는 서버가 내려준 now(ISO)를 인자로 받아야 한다 — 클라이언트에서 Date.now() 금지.
 */
import { z } from "zod";
import type {
  AdminDayCount,
  AdminStats,
  Checkin,
  EventCard,
  LatLng,
  Menu,
  MyReview,
  NearestStation,
  PeelSlug,
  PeelTest,
  PeelType,
  Photo,
  Place,
  PlaceDetail,
  PlaceEdit,
  PlaceFlagReason,
  Report,
  ReportKind,
  ReportStatus,
  PlaceReportReason,
  PlaceTag,
  Review,
  SeasonStats,
  Session,
} from "./types";
import {
  type DateInput,
  addDaysIso,
  formatKstDate,
  isWithinNewWindow,
  kstDateOnlyToIso,
  kstDayIndex,
  startOfDayKst,
  startOfWeekKst,
  toMs,
} from "./time";
import { SIDE_KEYS, matchesQuery, normalizeQuery } from "./places";
import { PEEL_PLACE_COUNT } from "./peel-test";
import { ratingSummary, sortReviewsNewest } from "./reviews";
import { safeAssetPath } from "./assets";
import { guCenter, guOfPoint } from "./gu";
import { isAllowedNaverPlaceUrl } from "./naver-links";

import placesJson from "./mock/places.json";
import checkinsJson from "./mock/checkins.json";
import reviewsJson from "./mock/reviews.json";
import eventCardJson from "./mock/event-card.json";
import peelTestJson from "./mock/peel-test.json";

/**
 * 한 가게에 붙일 수 있는 사진 수 (decisions 2026-09-03). UI 상수가 아니라 도메인 규칙이라
 * 데이터 계층이 갖고, 변환에서 잘라 막는다 — 익명 업로드에 상한이 없으면 도배가 가장 싼 공격이다.
 */
export const MAX_PLACE_PHOTOS = 10;

/**
 * 이 거리(출구에서 직선 m) 밖이면 "역 근처"로 치지 않고 상세에서 역 줄을 지운다.
 * 800m ≈ 실제 도보 1km 남짓 — "역에서 걸어간다"의 실질 상한이다(목 47/50).
 * 임계값은 데이터가 아니라 코드가 갖는다: JSON에는 사실(역·미터·노선)만 굽혀 있어
 * 값을 바꿔도 재생성이 필요 없다.
 */
export const STATION_NEARBY_MAX_M = 800;

/* ══════════════════════════════════════════════════════════════════════════
 * 목 전용 — Supabase 교체 시 이 블록 전체 삭제
 *
 * JSON의 날짜는 수집 시점(2026-08-25~28)에 고정돼 있다. 시즌 카운터·"○일 전 확인"이
 * 항상 살아있는 값으로 보이도록, 목의 최신 체크인 날짜가 "오늘"(KST)이 되게 모든
 * 날짜를 같은 일수만큼 이동한다. date-only 값("2026-08-25")은 KST 달력일로 읽어
 * UTC ISO로 내보낸다(컨벤션: 저장은 UTC ISO).
 * ════════════════════════════════════════════════════════════════════════ */

type RawPlace = Omit<
  Place,
  | "isNew"
  | "lastCheckedAt"
  | "createdAt"
  | "photos"
  | "thumbnailUrl"
  | "hoursNote"
  | "nearestStation"
> & {
  nearestStation: NearestStation; // 컷 전이라 항상 있다 — 파생에서 800m로 자른다
  isNew: boolean;
  lastCheckedAt: string; // "YYYY-MM-DD"
  createdAt?: string; // "YYYY-MM-DD"
  photos?: { url: string; at: string }[]; // url = /public 경로, at = "YYYY-MM-DD". 사진 업로드 전까지 목 샘플만
  hoursNote?: string; // 영업시간 메모 샘플
};

const rawPlaces = placesJson as RawPlace[];
const rawCheckins = checkinsJson as Checkin[];
const rawReviews = reviewsJson as Review[];
const rawEventCard = eventCardJson as EventCard;
const rawPeelTest = peelTestJson as PeelTest;

const MOCK_LATEST_DAY = Math.max(...rawCheckins.map((c) => kstDayIndex(c.at)));

/** 쓰기 시뮬레이션 — roadmap Phase 2 "목: delay 400ms, 10% 실패". */
export const MOCK_WRITE_DELAY_MS = 400;
/**
 * 업로드 한 장 상한 (security-reviewer 2026-09-08). 목 단계에도 필요한 이유: blob을 일부러 revoke하지 않고
 * 들고 있으므로 상한이 없으면 탭 메모리가 고른 파일 크기만큼 그대로 눌러앉는다. 업로드 시 1200px webp
 * 리사이즈(spec 6)를 하면 실제 저장본은 이보다 훨씬 작다 — 이건 "말도 안 되는 파일"을 막는 문이다.
 */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
/**
 * 제보 한 건에 담는 메뉴 줄 수 — 구이 1(필수) + 회 1(선택) + 기타 3.
 * 크롤 가게의 메뉴가 중앙값 3줄·최대 5줄이라 그 분포와 맞춘다 (2026-09-09).
 */
export const REPORT_MENU_MAX = 5;
/**
 * 그중 기타 줄 상한. **회 토글과 무관하게 고정**한다 — 남는 자리로 계산하면 기타를 4줄 채운 뒤
 * "새우회도 팔아요"를 켜는 순간 6줄이 되고, 스키마에 걸려 사용자는 이유 모를 실패를 본다 (2026-09-09).
 */
export const REPORT_EXTRA_MENU_MAX = REPORT_MENU_MAX - 2;
/** 메뉴 제안 한 번에 담을 수 있는 기존 줄 수 — 목 50곳 최대가 5줄이라 여유롭게 */
export const MAX_MENU_EDITS = 20;
export const MOCK_FAILURE_RATE = 0.1;

interface Dataset {
  places: Place[];
  checkins: Checkin[];
  reviews: Review[];
}

const datasetCache = new Map<number, Dataset>();

/**
 * 운영 상태(숨김·사후 확인) — **날짜 캐시 밖에 둔다.** `dataset()`은 KST 날짜가 바뀌면 `rawPlaces`에서
 * 다시 만들기 때문에 캐시 안 객체에만 찍으면 **자정에 숨김이 통째로 풀린다**(security-reviewer 2026-09-08).
 * `deletedReviewIds`가 id Set으로 살아남는 것과 같은 이유다. Phase 6에선 그냥 컬럼이다.
 */
type PlaceOps = Pick<Place, "hiddenAt" | "verifiedAt" | "removedByOwner">;
const placeOps = new Map<string, PlaceOps>();
/** 운영자가 내린 사진 id — 같은 이유로 캐시 밖에 산다(`deletedReviewIds`와 같은 규칙). */
const removedPhotoIds = new Set<string>();

function dataset(now: DateInput): Dataset {
  const today = kstDayIndex(now);
  const cached = datasetCache.get(today);
  if (cached) return cached;

  const shift = today - MOCK_LATEST_DAY;
  const shiftDateOnly = (dateOnly: string): string =>
    addDaysIso(kstDateOnlyToIso(dateOnly), shift);

  const places: Place[] = rawPlaces
    .filter((p) => !p.needsReview) // 검수 대기(새우 메뉴 파싱 실패)는 숨김 — 플랜 결정 4
    .map(({ photos: rawPhotos, hoursNote, nearestStation, ...raw }) => {
      const createdAt = raw.createdAt ? shiftDateOnly(raw.createdAt) : undefined;
      // 이미지 경로는 우리 스토리지(/…)만 — 규칙 3 (외부 도메인이 섞여 들어오면 그 장만 버린다)
      const photos: Photo[] = (rawPhotos ?? [])
        .flatMap((photo, i) => {
          const url = safeAssetPath(photo.url);
          // id는 걸러진 장이 있어도 번호가 밀리지 않게 원본 인덱스로 — Phase 6에서 DB uuid로 교체
          if (url === null) return [];
          return [{ id: `${raw.id}-p${String(i + 1)}`, url, uploadedAt: shiftDateOnly(photo.at) }];
        })
        .filter((photo) => !removedPhotoIds.has(photo.id))
        .slice(0, MAX_PLACE_PHOTOS);
      return {
        ...raw,
        photos,
        thumbnailUrl: photos[0]?.url ?? null,
        hoursNote: hoursNote ?? null,
        // 먼 역은 도움이 안 된다 — 그 줄을 지워 상세가 주소만 보여주게 한다
        nearestStation:
          nearestStation.distanceM <= STATION_NEARBY_MAX_M ? nearestStation : null,
        lastCheckedAt: shiftDateOnly(raw.lastCheckedAt),
        ...(createdAt !== undefined && { createdAt }),
        // 신규 라벨은 JSON의 정적 플래그가 아니라 등록 7일 이내로 파생 (spec 5)
        isNew: createdAt !== undefined && isWithinNewWindow(createdAt, now),
        // 운영 상태는 날짜와 무관하다 — 매일 새로 만드는 이 객체에 덧씌운다
        ...placeOps.get(raw.id),
      };
    });

  const built: Dataset = {
    places,
    checkins: rawCheckins.map((c) => ({ ...c, at: addDaysIso(c.at, shift) })),
    reviews: rawReviews.map(({ photoUrl, ...r }) => {
      const safePhoto = safeAssetPath(photoUrl);
      return { ...r, at: addDaysIso(r.at, shift), ...(safePhoto !== null && { photoUrl: safePhoto }) };
    }),
  };
  datasetCache.set(today, built);
  return built;
}

/* ── 세션(목) — Supabase 익명 auth + 카카오 linkIdentity 흉내 (spec 5 로그인) ──
 * 모듈 메모리라 클라이언트에선 탭 단위(새로고침 = 새 익명), 서버에선 한 번도 로그인하지 않은 익명 하나가
 * 요청 사이에 공유된다 — 서버는 읽기(빈 찜)만 하고 세션 쓰기는 전부 클라이언트 핸들러에서만 부른다. */
let anonymousSeq = 0;
function newAnonymousSession(): Session {
  anonymousSeq += 1;
  return { userId: `anon-local-${String(anonymousSeq)}`, provider: "anonymous", nickname: null };
}
let currentSession: Session = newAnonymousSession();

/** 탈퇴한 사용자의 확인 이벤트에 남는 actor 값 — 개인 식별자가 아니다. */
const DELETED_ACTOR = "deleted";

/** 목 카카오 유저 = 목 리뷰 2건의 작성자 "새우헌터" — 로그인하자마자 내 리뷰·본인 [수정][삭제]가 보인다. */
const KAKAO_MOCK_USER_ID = "u-kakao-1";
const KAKAO_MOCK_NICKNAME = "새우헌터";
/** 바꾼 닉네임은 로그아웃 뒤 다시 로그인해도 남는다(프로필 컬럼 흉내). */
let kakaoNickname = KAKAO_MOCK_NICKNAME;

/** 찜 — 사용자별 Set(bookmarks(user_id, place_id) 흉내). 익명 찜은 기기 한정이라 새 익명이 되면 사라진다. */
const bookmarksByUser = new Map<string, Set<string>>();
function bookmarksOf(userId: string): Set<string> {
  let set = bookmarksByUser.get(userId);
  if (!set) {
    set = new Set();
    bookmarksByUser.set(userId, set);
  }
  return set;
}

/** 소프트 삭제된 리뷰 id(deleted_at 흉내) — 화면·평균에서 즉시 제외, 관리자에겐 보인다(spec 5). 데이터셋 캐시가 날짜별이라 id로 거른다. */
const deletedReviewIds = new Set<string>();
function visibleReviews(reviews: readonly Review[]): Review[] {
  return reviews.filter((r) => !deletedReviewIds.has(r.id));
}

/**
 * 사용자에게 보이는 가게 — 숨긴 것은 뺀다(신고 3회 자동 숨김·운영자 조작·사장님 삭제, spec 5).
 * **삭제가 아니라 숨김이라** 데이터는 남고 관리자 화면에서만 보인다. `visibleReviews`와 같은 규칙이다.
 */
function visiblePlaces(places: readonly Place[]): Place[] {
  return places.filter((p) => p.hiddenAt === undefined);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** 목 쓰기: 지연 뒤 확률 실패. 실패 메시지에 내부 정보 없음. */
async function simulateWrite(): Promise<void> {
  await delay(MOCK_WRITE_DELAY_MS);
  if (Math.random() < MOCK_FAILURE_RATE) throw new Error("mock write failed");
}

/** 가게 id·사진 id 공통 형태. */
const idSchema = z.string().trim().min(1).max(64);

/* ══════════════════════════════════════════════════════════════════════════
 * 공개 API — 읽기
 * ════════════════════════════════════════════════════════════════════════ */

export interface PlaceFilter {
  tag?: PlaceTag;
  gu?: string;
  isNew?: boolean;
  query?: string;
}

/**
 * 핀별 평점 — 리뷰 3개 미만은 아예 넣지 않는다(spec 4.2-9). 삭제된 리뷰는 이미 걸러진 목록이 온다.
 * Phase 6에서 이 함수만 SQL 집계(뷰·집계 컬럼)로 바뀐다.
 */
function ratingsByPlace(reviews: readonly Review[]): Map<string, { count: number; average: number }> {
  const byPlace = new Map<string, Review[]>();
  for (const r of reviews) {
    const list = byPlace.get(r.placeId);
    if (list) list.push(r);
    else byPlace.set(r.placeId, [r]);
  }
  const out = new Map<string, { count: number; average: number }>();
  for (const [placeId, list] of byPlace) {
    const summary = ratingSummary(list);
    if (summary.average !== null) out.set(placeId, { count: summary.count, average: summary.average });
  }
  return out;
}

/** 평점이 있는 핀에만 얹는다 — 없는 핀은 원본 그대로(카드가 그 줄을 안 그린다) */
function withRating(place: Place, ratings: Map<string, { count: number; average: number }>): Place {
  const rating = ratings.get(place.id);
  return rating ? { ...place, rating } : place;
}

export function getPlaces(
  filter: PlaceFilter = {},
  now: DateInput = Date.now(),
): Promise<Place[]> {
  const { reviews } = dataset(now);
  const places = visiblePlaces(dataset(now).places);
  const q = normalizeQuery(filter.query ?? "");
  const ratings = ratingsByPlace(visibleReviews(reviews));
  return Promise.resolve(
    places
      .filter((p) => {
        if (filter.tag && !p.tags.includes(filter.tag)) return false;
        if (filter.gu && p.gu !== filter.gu) return false;
        if (filter.isNew !== undefined && p.isNew !== filter.isNew) return false;
        return matchesQuery(p, q);
      })
      .map((p) => withRating(p, ratings)),
  );
}

export function getPlaceById(
  id: string,
  now: DateInput = Date.now(),
): Promise<Place | undefined> {
  const { places, reviews } = dataset(now);
  const place = visiblePlaces(places).find((p) => p.id === id);
  return Promise.resolve(place && withRating(place, ratingsByPlace(visibleReviews(reviews))));
}

/** 상세 화면 데이터: 가게 + 리뷰(최신순). 없는 id는 undefined. `now`는 서버가 내려준 값. */
export function getPlaceDetail(
  id: string,
  now: DateInput,
): Promise<PlaceDetail | undefined> {
  const { places, reviews } = dataset(now);
  const place = visiblePlaces(places).find((p) => p.id === id);
  if (!place) return Promise.resolve(undefined);
  const visible = visibleReviews(reviews);
  return Promise.resolve({
    // 목록·상세가 같은 계약을 갖게 평점을 얹는다(상세 화면은 자기 리뷰로 다시 세지만, 이 값이 카드·마커로도 흐른다)
    place: withRating(place, ratingsByPlace(visible)),
    reviews: sortReviewsNewest(visible.filter((r) => r.placeId === id)),
  });
}

export function getCheckins(
  placeId?: string,
  now: DateInput = Date.now(),
): Promise<Checkin[]> {
  const { checkins } = dataset(now);
  return Promise.resolve(
    placeId ? checkins.filter((c) => c.placeId === placeId) : checkins,
  );
}

export function getReviews(
  placeId?: string,
  now: DateInput = Date.now(),
): Promise<Review[]> {
  const reviews = visibleReviews(dataset(now).reviews);
  return Promise.resolve(
    placeId ? reviews.filter((r) => r.placeId === placeId) : reviews,
  );
}

/**
 * 시즌 카운터. "확인일은 컬럼이 아니라 checkins 이벤트에서 계산"(spec 6).
 * 이번 주 = KST 월요일 00:00 ~ now. now 이후 시각의 이벤트는 세지 않는다.
 */
export function getSeasonStats(
  now: DateInput = Date.now(),
): Promise<SeasonStats> {
  const { places, checkins } = dataset(now);
  const nowMs = toMs(now);
  const weekStart = startOfWeekKst(now);
  const dayStart = startOfDayKst(now);
  // 숨긴 가게의 확인은 시즌 카운터에서도 빠진다 — 사용자에게 없는 가게다
  const visible = new Set(visiblePlaces(places).map((p) => p.id));

  const counts = new Map<string, { count: number; latest: number }>();
  let todayCheckinCount = 0;

  for (const c of checkins) {
    if (!visible.has(c.placeId)) continue;
    const t = toMs(c.at);
    if (t > nowMs || t < weekStart) continue;
    if (t >= dayStart) todayCheckinCount += 1;
    const entry = counts.get(c.placeId) ?? { count: 0, latest: 0 };
    entry.count += 1;
    entry.latest = Math.max(entry.latest, t);
    counts.set(c.placeId, entry);
  }

  let topPlace: SeasonStats["topPlace"] = null;
  for (const [id, { count, latest }] of counts) {
    if (
      !topPlace ||
      count > topPlace.count ||
      (count === topPlace.count && latest > topLatest(topPlace.id))
    ) {
      const place = places.find((p) => p.id === id);
      if (place) topPlace = { id, name: place.name, count };
    }
  }

  function topLatest(id: string): number {
    return counts.get(id)?.latest ?? 0;
  }

  return Promise.resolve({
    weekPlaceCount: counts.size,
    todayCheckinCount,
    topPlace,
    // 숨긴 신규 가게는 카운터에서도 빠진다 — 사용자에게 없는 가게다
    newPlaceCount: visiblePlaces(places).filter((p) => p.isNew).length,
  });
}

/** 이벤트 카드 슬롯 — 기간 밖이면 null. 닫기 상태는 클라이언트 메모리(규칙 4). */
export function getEventCard(
  now: DateInput = Date.now(),
): Promise<EventCard | null> {
  const nowMs = toMs(now);
  const inPeriod =
    nowMs >= toMs(rawEventCard.startsAt) && nowMs <= toMs(rawEventCard.endsAt);
  return Promise.resolve(inPeriod ? rawEventCard : null);
}

/** 까주기 테스트 콘텐츠 — 문항·유형·궁합 카피(spec 8). 이벤트 카드와 같은 설정값 문법이라 카피 수정이 코드 수정이 아니다. */
export function getPeelTest(): Promise<PeelTest> {
  return Promise.resolve(rawPeelTest);
}

export function getPeelType(slug: PeelSlug): Promise<PeelType | null> {
  return Promise.resolve(rawPeelTest.types.find((t) => t.slug === slug) ?? null);
}

/** 사이드가 많을수록 손이 가는 집 — 까주는 쪽(축 A)의 가중치다. */
function sideCount(place: Place): number {
  return SIDE_KEYS.filter((key) => place.sides[key]).length;
}

/**
 * 추천 순위 공통 — 평점(리뷰 3개 이상일 때만 붙는다) → 리뷰 수 → 확인 수 → 이름.
 * 평점 없는 집이 뒤로 가는 건 의도다: 추천에는 남이 남긴 값이 확인 수보다 낫다.
 */
function byRatingThenChecks(a: Place, b: Place): number {
  return (
    (b.rating?.average ?? 0) - (a.rating?.average ?? 0) ||
    (b.rating?.count ?? 0) - (a.rating?.count ?? 0) ||
    b.checkCount - a.checkCount ||
    a.name.localeCompare(b.name, "ko")
  );
}

/**
 * 유형에 어울리는 가게 3곳 (design 화면 11-3). 축 B(새우구이·생새우회)로 거르고 축 A로 가른다 —
 * **까주는 쪽에는 손이 가는 집**(사이드가 많은 집), **받는 쪽에는 차려 주는 집**(전문점).
 */
export async function getPeelTypePlaces(
  slug: PeelSlug,
  now: DateInput = Date.now(),
): Promise<Place[]> {
  const type = await getPeelType(slug);
  if (!type) return [];
  const places = await getPlaces({ tag: type.taste }, now);
  const weight = (p: Place) => (type.role === "peel" ? sideCount(p) : p.specialist ? 1 : 0);
  return [...places]
    .sort((a, b) => weight(b) - weight(a) || byRatingThenChecks(a, b))
    .slice(0, PEEL_PLACE_COUNT);
}

/**
 * 둘이 같이 갈 가게 3곳 (design 화면 11-5). **취향이 갈리면 구이·회를 둘 다 하는 집**을 뽑는다 —
 * 궁합이 실제 쓸모를 낳는 자리다(decisions 2026-09-09). 역할 가중치는 쓰지 않는다: 두 사람이 섞였다.
 */
export async function getPeelMatchPlaces(
  a: PeelSlug,
  b: PeelSlug,
  now: DateInput = Date.now(),
): Promise<Place[]> {
  const [first, second] = await Promise.all([getPeelType(a), getPeelType(b)]);
  if (!first || !second) return [];
  const all = await getPlaces({}, now);
  const pool =
    first.taste === second.taste
      ? all.filter((p) => p.tags.includes(first.taste))
      : all.filter((p) => p.tags.includes("grill") && p.tags.includes("raw"));
  const ranked = [...pool].sort(byRatingThenChecks);
  if (ranked.length >= PEEL_PLACE_COUNT) return ranked.slice(0, PEEL_PLACE_COUNT);
  // 겸업 집이 모자라면 전체 상위로 채운다 — 빈손으로 돌려보내지 않는다
  const picked = new Set(ranked.map((p) => p.id));
  const rest = [...all].filter((p) => !picked.has(p.id)).sort(byRatingThenChecks);
  return [...ranked, ...rest].slice(0, PEEL_PLACE_COUNT);
}

/** 현재 세션의 찜 목록. 서버에서는 항상 빈 값(서버 세션은 로그인하지 않는다). */
export function getBookmarkedPlaceIds(): Promise<string[]> {
  return Promise.resolve([...bookmarksOf(currentSession.userId)]);
}

/** 좌표가 속한 시군구 라벨("마포구", "김포시(경기)"). 한국 밖이면 null — 제보 2단계가 핀 확정 때 검사한다(decisions 2026-09-04). */
export function getGuOfPoint(point: LatLng): Promise<string | null> {
  return guOfPoint(point);
}

/** 서울 구의 지도 중심(경계 박스 중앙) — `/gu/[name]`이 가게 0곳일 때 지도를 그 구로 옮긴다. 서울 밖이면 null. */
export function getGuCenter(name: string): Promise<LatLng | null> {
  return guCenter(name);
}

/* ══════════════════════════════════════════════════════════════════════════
 * 공개 API — 쓰기 (목: 400ms 지연 + 10% 실패. 컴포넌트는 낙관적 업데이트 + 실패 롤백)
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * "다녀왔다면" 확인 +1 (spec 4.2-3). 성공하면 갱신된 Place를 돌려준다.
 * 캐시된 데이터셋의 Place는 새 객체로 교체한다(React state와 참조 동일성 계약).
 * 취소는 없다(spec 5). 핀당 하루 1회 제한은 컴포넌트 상태로(속도 제한 자리, Phase 6 Upstash).
 */
/* 아래 쓰기 셋(확인·리뷰·수정 제안)과 사진 올리기는 `visiblePlaces`를 지난다 — 숨긴 가게에 쓰면
   숨김을 풀었을 때 그 사이 값이 살아 있다(security-reviewer 2026-09-08). */
export async function checkIn(placeId: string, now: DateInput): Promise<Place> {
  const id = idSchema.parse(placeId);
  await simulateWrite();
  const data = dataset(now);
  const current = visiblePlaces(data.places).find((p) => p.id === id);
  if (!current) throw new Error("place not found");
  // `now`는 목 데이터셋 조회·낙관 표시용이다. Phase 6(Supabase)에서는 확인 시각 `at`을 서버가 정한다 — 클라이언트 값을 저장하지 말 것.
  const at = new Date(toMs(now)).toISOString();
  const updated: Place = {
    ...current,
    checkCount: current.checkCount + 1,
    lastCheckedAt: at,
  };
  data.places = data.places.map((p) => (p.id === id ? updated : p));
  data.checkins = [
    ...data.checkins,
    { placeId: id, type: "visited", at, actor: currentSession.userId },
  ];
  // 평점은 읽을 때 붙이므로 쓰기 응답에도 같이 붙인다 — 낙관 갱신(patchPlace)이 카드의 평점을 지우면 안 된다
  return withRating(updated, ratingsByPlace(visibleReviews(data.reviews)));
}

/** 사진 신고 사유 — 뷰어 신고 시트의 4행과 1:1 (design 화면 2 변형 (e)). */
export type PhotoReportReason = "inappropriate" | "wrong_place" | "spam" | "other";

const photoReportSchema = z.object({
  placeId: idSchema,
  photoId: idSchema,
  reason: z.enum(["inappropriate", "wrong_place", "spam", "other"]),
});

/**
 * 사진 신고 접수 (spec 스팸 4겹 2 "신고 일 10"). 익명 업로드 이미지라 상세의 어떤 입구보다 먼저
 * 실동작으로 열었다(decisions 2026-09-03 — 나머지 입구는 2026-09-08에 따라왔다).
 * 목 단계에는 저장할 곳이 없어 검증 + 지연만 한다 — reports 테이블·속도 제한은 Phase 6.
 */
export async function reportPhoto(input: {
  placeId: string;
  photoId: string;
  reason: PhotoReportReason;
}): Promise<void> {
  const parsed = photoReportSchema.parse(input);
  const actor = currentSession.userId;
  await simulateWrite();
  // 없는 가게로 큐를 채우지 못하게 (setBookmark의 가드와 같은 규칙, security-reviewer 2026-09-08)
  if (!placeExists(parsed.placeId)) throw new Error("place not found");
  pushReport({ kind: "photo_report", placeId: parsed.placeId, photoId: parsed.photoId, reason: parsed.reason, actor });
}

/**
 * 제보 메뉴 한 줄(spec 4.3-3). `unitRaw`는 `unitChipLabel`이 읽는 형태 그대로 —
 * kg·g는 숫자만("1", "500"), 한판·반판·N마리는 표기 자체("한판", "10마리"), 단위 없음은 null.
 * 大中小(size)·인분(serving)은 크롤 표기로만 두고 제보로 늘리지 않는다(decisions 2026-09-04).
 */
export const reportMenuSchema = z.object({
  name: z.string().trim().min(1).max(30),
  // 십만 원대까지 — 화면 입력 상한(PRICE_MAX_DIGITS = 6자리)과 같은 값. UI 제한만으론 검증이 아니다
  price: z.number().int().min(100).max(999_999),
  unit: z.enum(["kg", "g", "pan", "count", "none"]),
  unitRaw: z.string().trim().max(10).nullable(),
  /** true = 새우회 줄("새우회도 팔아요"), false = 구이 줄 */
  raw: z.boolean(),
});

/** 사이드 3종 — 제보(화면 3-4)와 상세의 사이드 제안(화면 2-6)이 같은 모양을 쓴다. */
const sidesSchema = z.object({
  headButter: z.boolean(),
  ramen: z.boolean(),
  friedRice: z.boolean(),
});

/** 제보 입력(design 화면 3). 필수는 가게명·좌표·메뉴 한 줄뿐(spec 4.3). 주소는 받지 않는다 — 구는 좌표로 판정(전국). 좌표 범위는 한국 대략 상자. */
export const reportInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  lat: z.number().min(33).max(39),
  lng: z.number().min(124).max(132),
  menus: z.array(reportMenuSchema).min(1).max(REPORT_MENU_MAX),
  sides: sidesSchema,
  hoursNote: z.string().trim().max(80),
  /** 4단계 미리보기까지 고른 파일. 목 단계에는 저장소가 없어 버린다(Phase 6). */
  photos: z
    .array(
      z
        .instanceof(File)
        .refine((f) => f.type.startsWith("image/"), "이미지 파일만")
        .refine((f) => f.size <= MAX_PHOTO_BYTES, "사진 한 장은 10MB까지"),
    )
    .max(MAX_PLACE_PHOTOS),
  /** 2단계 중복 의심에 "다른 가게예요"로 답했으면 그 후보 id */
  duplicateOf: idSchema.nullable(),
  /**
   * 4단계 선택 — **사용자가 붙여넣은** 네이버 지도 링크(공유 → 링크 복사). 상세의 "네이버에서 사진 보기"가 이 값을 쓴다.
   * 규칙 2에 걸리지 않는다: API 응답이 아니라 사용자 입력이다(카카오 공식 답변도 "직접 입력한 값"은 예외로 둔다 — decisions 2026-09-08).
   * 허용 호스트만 통과시킨다(`isAllowedNaverPlaceUrl` — 표시 경로와 같은 방어선).
   */
  naverPlaceUrl: z
    .string()
    .trim()
    .refine((v) => v === "" || isAllowedNaverPlaceUrl(v), "네이버 지도 링크만 넣을 수 있어요"),
});

export type ReportMenuInput = z.infer<typeof reportMenuSchema>;
export type ReportInput = z.infer<typeof reportInputSchema>;

let reportSeq = 0;
let photoSeq = 0;

/**
 * 목 단계의 사진 "저장소" — 브라우저 메모리다. `createObjectURL`로 만든 URL을 **일부러 revoke하지 않는다**:
 * `PhotoPicker`는 자기 목록의 URL을 언마운트 때 revoke하므로, 그 URL을 그대로 `Place.photos`에 넣으면
 * 시트가 닫히는 순간 사진이 깨진다(decisions 2026-09-08). 새로고침하면 사라지는 건 제보로 만든 가게와
 * 같은 수준이고, 진짜 저장소(NCP → R2)는 Phase 6이다.
 * 서버(SSR·OG 빌드)에는 이 API가 없으므로 `null`을 돌려주고 호출자가 사진 없이 진행한다.
 */
function retainPhotoUrl(file: File): string | null {
  if (typeof URL.createObjectURL !== "function") return null;
  return URL.createObjectURL(file);
}

/** 고른 파일을 `Photo[]`로. URL을 못 만드는 환경(서버)에서는 그 장을 조용히 버린다. */
function toPhotos(placeId: string, files: readonly File[], uploadedAt: string, uploaderId: string): Photo[] {
  const photos: Photo[] = [];
  for (const file of files) {
    const url = retainPhotoUrl(file);
    if (url === null) continue;
    photoSeq += 1;
    photos.push({ id: `${placeId}-u${String(photoSeq)}`, url, uploadedAt, uploaderId });
  }
  return photos;
}

/**
 * 제보 등록 (spec 4.3, 5 "모든 제보 즉시 노출"). 성공하면 만들어진 Place를 돌려주고 데이터셋 끝에 붙인다.
 * 구는 좌표로 판정하고 한국 밖(바다)이면 지연 전에 거부한다. 주소·최근접역은 비워 둔다(Phase 6 서버 파생).
 * `now`는 목 데이터셋 조회·등록 시각용이다 — Phase 6에서는 서버가 정한다(checkIn과 같은 계약).
 */
/**
 * 제보 등록 — 익명이 **핀 자체를 만드는** 가장 비싼 쓰기다.
 * 속도 제한 자리: 기기·IP당 일 N — Phase 6 Upstash(spec 스팸 4겹 2). 다른 쓰기와 같은 자리에 둔다.
 */
export async function submitReport(input: ReportInput, now: DateInput): Promise<Place> {
  const report = reportInputSchema.parse(input);
  // 행위자는 지연 전에 잡는다 — await 뒤에 읽으면 그 사이 바뀐 사용자의 것으로 기록된다(CLAUDE.md 쓰기 규칙)
  const actor = currentSession.userId;
  const gu = await guOfPoint(report);
  if (gu === null) throw new Error("outside korea");
  await simulateWrite();
  const data = dataset(now);
  const createdAt = new Date(toMs(now)).toISOString();
  reportSeq += 1;
  const id = `r${String(reportSeq).padStart(3, "0")}`;
  // 고른 사진을 버리지 않는다(2026-09-08) — 등록 직후 상세가 "아직 사진이 없어요"로 뜨던 자리다
  const photos = toPhotos(id, report.photos, createdAt, actor);
  const tags: PlaceTag[] = ["grill"];
  if (report.menus.some((m) => m.raw)) tags.push("raw");
  const place: Place = {
    id,
    name: report.name,
    gu,
    addressRoad: null,
    addressJibun: null,
    lat: report.lat,
    lng: report.lng,
    nearestStation: null,
    tags,
    specialist: false, // 제보 핀은 전문점 판정 없음 (spec 2 가공 규칙)
    naverPlaceUrl: report.naverPlaceUrl || null,
    photos,
    thumbnailUrl: photos[0]?.url ?? null,
    hoursNote: report.hoursNote || null,
    menus: report.menus.map((m) => ({
      raw: m.name,
      name: m.name,
      price: m.price,
      unit: m.unit,
      unit_raw: m.unitRaw,
    })),
    sides: report.sides,
    source: "report",
    needsReview: false,
    lastCheckedAt: createdAt,
    checkCount: 0,
    isNew: true,
    createdAt,
    ...(report.duplicateOf !== null && { duplicateSuspectOf: report.duplicateOf }),
    reporterId: actor,
  };
  data.places = [...data.places, place];
  return place;
}

/** 시드(검수 통과)나 제보로 생긴 가게인가 — 찜 Set에 가짜 id가 쌓이지 않게 (Phase 6 FK 자리). */
function placeExists(id: string): boolean {
  if (rawPlaces.some((p) => p.id === id && !p.needsReview)) return true;
  for (const data of datasetCache.values()) if (data.places.some((p) => p.id === id)) return true;
  return false;
}

/** 찜 토글 (spec 5 "찜") — 현재 세션 기준. 확인일은 갱신하지 않는다. 현재 찜 목록을 돌려준다. */
/**
 * 찜 설정 — **토글이 아니라 원하는 상태를 받는다**(멱등). 연타가 겹쳐도 마지막 의도가 이긴다:
 * 토글은 "지금 상태의 반대"라 요청 두 개가 겹치면 서버가 사용자의 마지막 의도와 반대로 끝날 수 있다
 * (Codex PR #10 #2). Phase 6의 insert/delete와도 같은 모양이다.
 * 다른 쓰기와 같은 계약(지연 400ms · 10% 실패)이라 화면이 낙관 업데이트와 롤백을 다 보여준다.
 * 속도 제한 자리: 사용자당 초당 N — Phase 6 Upstash(spec 스팸 4겹 2).
 */
export async function setBookmark(placeId: string, bookmarked: boolean): Promise<string[]> {
  // 검증 실패도 throw가 아니라 reject로 (쓰기 함수는 전부 같은 계약)
  const id = idSchema.parse(placeId);
  if (!placeExists(id)) throw new Error("place not found");
  // 행위자는 **지연 전에** 잡는다 — await 뒤에 읽으면 그 사이 바뀐 세션의 찜을 건드린다.
  // 훅의 세션 가드는 응답만 버릴 뿐 이미 일어난 쓰기는 못 되돌린다 (Codex PR #10 #1).
  const userId = currentSession.userId;
  await simulateWrite();
  const mine = bookmarksOf(userId);
  if (bookmarked) mine.add(id);
  else mine.delete(id);
  return [...mine];
}

/* ══════════════════════════════════════════════════════════════════════════
 * 공개 API — 세션 (spec 5 로그인. 목: Supabase 익명 auth + 카카오 linkIdentity 흉내)
 * ════════════════════════════════════════════════════════════════════════ */

export function getSession(): Promise<Session> {
  return Promise.resolve(currentSession);
}

/**
 * 카카오 로그인(목). 익명 세션의 기록(찜·제보·확인)을 카카오 id로 승계한다 — linkIdentity와 같은 결과.
 * 실제 OAuth·세션 지속은 Phase 6. 실패(10%)하면 세션은 그대로.
 */
export async function signInWithKakao(): Promise<Session> {
  if (currentSession.provider === "kakao") return currentSession;
  await simulateWrite();
  const anonymousId = currentSession.userId;
  const kakaoId = KAKAO_MOCK_USER_ID;
  // 찜 승계: 익명 Set을 카카오 Set에 합친다
  const carried = bookmarksOf(anonymousId);
  const target = bookmarksOf(kakaoId);
  for (const id of carried) target.add(id);
  bookmarksByUser.delete(anonymousId);
  // 제보·확인 승계 (캐시된 데이터셋 전부 — 날짜별 캐시라 한 곳만 고치면 다른 now에서 되돌아온다)
  for (const data of datasetCache.values()) {
    data.places = data.places.map((p) =>
      p.reporterId === anonymousId ? { ...p, reporterId: kakaoId } : p,
    );
    data.checkins = data.checkins.map((c) =>
      c.actor === anonymousId ? { ...c, actor: kakaoId } : c,
    );
  }
  currentSession = { userId: kakaoId, provider: "kakao", nickname: kakaoNickname };
  return currentSession;
}

/** 로그아웃 — 새 익명 세션. 익명 찜은 기기 한정이라 이전 카카오 찜은 다음 로그인 때 다시 보인다. */
export function signOut(): Promise<Session> {
  currentSession = newAnonymousSession();
  return Promise.resolve(currentSession);
}

/**
 * 탈퇴 (spec 5 "개인 데이터 완전 삭제"). 내 리뷰는 소프트 삭제(관리자 기록용), 찜은 삭제,
 * 제보한 가게는 남기되 작성자를 뗀다(가게는 공공 데이터). 끝나면 새 익명 세션.
 */
export async function deleteAccount(): Promise<Session> {
  if (currentSession.provider !== "kakao") throw new Error("login required");
  await simulateWrite();
  const me = currentSession.userId;
  for (const data of datasetCache.values()) {
    for (const r of data.reviews) if (r.authorId === me) deletedReviewIds.add(r.id);
    data.places = data.places.map((p) => {
      if (p.reporterId !== me) return p;
      const rest: Place = { ...p };
      delete rest.reporterId;
      return rest;
    });
    // 올린 사진은 가게 정보라 남기고 업로더만 뗀다 — 제보 가게(reporterId)와 같은 규칙 (security-reviewer 2026-09-08)
    data.places = data.places.map((p) =>
      p.photos.some((photo) => photo.uploaderId === me)
        ? {
            ...p,
            photos: p.photos.map((photo) => {
              if (photo.uploaderId !== me) return photo;
              const rest: Photo = { ...photo };
              delete rest.uploaderId;
              return rest;
            }),
          }
        : p,
    );
    // 확인 이벤트는 집계(시즌 카운터·확인 N회)에 남되 개인 식별자는 뗀다 — Phase 6: actor nullable + ON DELETE SET NULL
    data.checkins = data.checkins.map((c) => (c.actor === me ? { ...c, actor: DELETED_ACTOR } : c));
  }
  // 수정 이력은 되돌리기·사후 확인에 남기고 개인 식별자만 뗀다 — checkins·reporterId와 같은 규칙
  for (const [i, edit] of placeEdits.entries()) {
    if (edit.actor !== me) continue;
    const rest: PlaceEdit = { ...edit };
    delete rest.actor;
    placeEdits[i] = rest;
  }
  // 신고·요청은 운영 기록이라 남기되 **개인 식별자와 연락처를 뗀다** — actor만 떼면 정작 개인정보인
  // 사장님 연락처·내용이 영구히 남는다(spec 5 "개인 데이터 완전 삭제", security-reviewer 2026-09-08)
  for (const [i, report] of reports.entries()) {
    if (report.actor !== me) continue;
    const rest: Report = { ...report };
    delete rest.actor;
    delete rest.contact;
    delete rest.message;
    reports[i] = rest;
  }
  bookmarksByUser.delete(me);
  kakaoNickname = KAKAO_MOCK_NICKNAME;
  currentSession = newAnonymousSession();
  return currentSession;
}

/**
 * 닉네임 — 한글·영문·숫자 2~12자, 단어 사이 공백 하나 (spec 5 "카카오 프로필 기본, 수정 가능").
 * NFKC로 정규화하고 문자 종류를 제한한다: 폭 없는 공백·방향 제어문자로 빈 이름이나 남 흉내를 못 만들게 (security-reviewer 2026-09-04).
 */
export const nicknameSchema = z
  .string()
  .transform((s) => s.normalize("NFKC").trim())
  .pipe(
    z
      .string()
      .min(2)
      .max(12)
      .regex(/^[\p{L}\p{N}]+(?: [\p{L}\p{N}]+)*$/u),
  );

/** 닉네임 변경 — 카카오 세션만. 이미 쓴 리뷰의 표시 이름도 같이 바뀐다(프로필 조인 흉내). */
export async function updateNickname(nickname: string): Promise<Session> {
  const next = nicknameSchema.parse(nickname);
  if (currentSession.provider !== "kakao") throw new Error("login required");
  await simulateWrite();
  const me = currentSession.userId;
  for (const data of datasetCache.values()) {
    data.reviews = data.reviews.map((r) => (r.authorId === me ? { ...r, nickname: next } : r));
  }
  kakaoNickname = next;
  currentSession = { ...currentSession, nickname: next };
  return currentSession;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 공개 API — 리뷰 쓰기 (spec 5 리뷰: 카카오 필수, 본인 수정·삭제, 소프트 삭제)
 * ════════════════════════════════════════════════════════════════════════ */

/** 리뷰 입력(design 화면 5 변형 (b)): 별점 필수, 후기 선택 500자, 사진 1장 선택(목은 버린다). */
export const reviewInputSchema = z.object({
  placeId: idSchema,
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().max(500),
  photo: z
    .instanceof(File)
    .refine((f) => f.type.startsWith("image/"), "이미지 파일만")
    .refine((f) => f.size <= MAX_PHOTO_BYTES, "사진 한 장은 10MB까지")
    .nullable(),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;

/** 수정은 별점·후기만 (사진 교체는 Phase 6 저장소와 함께). */
export const reviewPatchSchema = reviewInputSchema.pick({ rating: true, text: true });
export type ReviewPatch = z.infer<typeof reviewPatchSchema>;

let reviewSeq = 0;

/** 이 가게에 현재 세션이 쓴(삭제되지 않은) 리뷰 — 핀당 1개 규칙과 [리뷰 수정] 전환의 기준. */
function myReviewOf(placeId: string, now: DateInput): Review | undefined {
  return visibleReviews(dataset(now).reviews).find(
    (r) => r.placeId === placeId && r.authorId === currentSession.userId,
  );
}

/**
 * 리뷰 등록. 익명은 거부한다(spec 5 "익명 별점 없음" — 게이트는 UI가 먼저 세우고 여기는 마지막 방어선).
 * 속도 제한 자리: 핀당 리뷰 1개(같은 가게 두 번째 리뷰는 수정으로), 일 N개 — Phase 6 Upstash(spec 스팸 4겹 2).
 * 사진은 MIME(`file.type`)만 보는데 클라이언트가 정하는 값이라 위조 가능 — 서버 sharp 재인코딩(spec 스팸 3)이 방어선.
 * 등록은 확인이기도 하다: 확인일 갱신 + checkins 이벤트 + 확인 +1 (spec 5 "리뷰 등록 시 확인일도 갱신").
 * 갱신된 Place도 함께 돌려준다 — 호출자가 상호 블록 캡션("오늘 확인")을 바로 맞춘다.
 */
export async function submitReview(
  input: ReviewInput,
  now: DateInput,
): Promise<{ review: Review; place: Place }> {
  const parsed = reviewInputSchema.parse(input);
  if (currentSession.provider !== "kakao") throw new Error("login required");
  // 핀당 1개 (spec 5 스팸 4겹 2) — 두 번째는 수정이다. UI가 먼저 [리뷰 수정]으로 보내고 여기가 마지막 방어선.
  if (myReviewOf(parsed.placeId, now)) throw new Error("already reviewed");
  await simulateWrite();
  const data = dataset(now);
  const current = visiblePlaces(data.places).find((p) => p.id === parsed.placeId);
  if (!current) throw new Error("place not found");
  const at = new Date(toMs(now)).toISOString();
  reviewSeq += 1;
  // 고른 사진은 리뷰 행 썸네일이 된다(2026-09-08) — 그전엔 버려져 `photoUrl`이 늘 비어 있었다
  const photoUrl = parsed.photo === null ? null : retainPhotoUrl(parsed.photo);
  const review: Review = {
    id: `rv-local-${String(reviewSeq)}`,
    placeId: parsed.placeId,
    authorId: currentSession.userId,
    rating: parsed.rating,
    text: parsed.text,
    nickname: currentSession.nickname ?? KAKAO_MOCK_NICKNAME,
    at,
    ...(photoUrl !== null && { photoUrl }),
  };
  const place: Place = { ...current, checkCount: current.checkCount + 1, lastCheckedAt: at };
  data.reviews = [...data.reviews, review];
  data.places = data.places.map((p) => (p.id === place.id ? place : p));
  data.checkins = [
    ...data.checkins,
    { placeId: place.id, type: "visited", at, actor: currentSession.userId },
  ];
  return { review, place };
}

/** 본인 리뷰 수정 — 별점·후기, `editedAt` 기록(화면엔 "수정됨"만). 남의 리뷰·삭제된 리뷰는 거부. */
export async function updateReview(
  reviewId: string,
  patch: ReviewPatch,
  now: DateInput,
): Promise<Review> {
  const id = idSchema.parse(reviewId);
  const changes = reviewPatchSchema.parse(patch);
  const data = dataset(now);
  const current = visibleReviews(data.reviews).find((r) => r.id === id);
  if (!current || current.authorId !== currentSession.userId) throw new Error("forbidden");
  await simulateWrite();
  const updated: Review = {
    ...current,
    ...changes,
    editedAt: new Date(toMs(now)).toISOString(),
  };
  data.reviews = data.reviews.map((r) => (r.id === id ? updated : r));
  return updated;
}

/** 본인 리뷰 소프트 삭제 — 화면·평균에서 즉시 빠지고 checkins 확인 기록은 남는다(spec 5). */
export async function deleteReview(reviewId: string): Promise<void> {
  const id = idSchema.parse(reviewId);
  const mine = [...datasetCache.values()].some((data) =>
    data.reviews.some(
      (r) => r.id === id && r.authorId === currentSession.userId && !deletedReviewIds.has(r.id),
    ),
  );
  if (!mine) throw new Error("forbidden");
  await simulateWrite();
  deletedReviewIds.add(id);
}

/** 내 활동 > 내 리뷰 — 현재 세션이 쓴 리뷰(최신순) + 가게명. 숨긴 가게의 리뷰는 뺀다. */
export function getMyReviews(now: DateInput): Promise<MyReview[]> {
  const { places, reviews } = dataset(now);
  // 숨긴 가게의 리뷰는 목록에서 빠진다 — 이름이 남으면 눌렀을 때 404로 간다(security-reviewer 2026-09-08)
  const names = new Map(visiblePlaces(places).map((p) => [p.id, p.name]));
  const mine = sortReviewsNewest(
    visibleReviews(reviews).filter((r) => r.authorId === currentSession.userId),
  ).flatMap((r) => {
    const placeName = names.get(r.placeId);
    return placeName === undefined ? [] : [{ ...r, placeName }];
  });
  return Promise.resolve(mine);
}

/** 내 활동 > 내 제보 — 현재 세션이 제보한 가게(최신순). */
export function getMyReports(now: DateInput): Promise<Place[]> {
  const mine = visiblePlaces(dataset(now).places)
    .filter((p) => p.reporterId === currentSession.userId)
    .sort((a, b) => toMs(b.createdAt ?? b.lastCheckedAt) - toMs(a.createdAt ?? a.lastCheckedAt));
  return Promise.resolve(mine);
}

const placeFlagSchema = z.object({
  placeId: idSchema,
  reason: z.enum(["location", "menu", "closed", "other"]),
});

/**
 * 신규 패널 [정보가 달라요] 접수 (design 화면 4 변형 (a)). 사진 신고와 같은 계약 — 검증 + 지연만,
 * 신고 큐·관리자 화면은 Phase 6. 익명도 보낼 수 있다(spec 5 "신고는 익명 가능") —
 * 가장 싼 도배 경로라 속도 제한 자리: 핀당 일 1 (Phase 6 Upstash, spec 스팸 4겹 2).
 */
export async function flagPlace(input: { placeId: string; reason: PlaceFlagReason }): Promise<void> {
  const parsed = placeFlagSchema.parse(input);
  const actor = currentSession.userId;
  await simulateWrite();
  if (!placeExists(parsed.placeId)) throw new Error("place not found");
  pushReport({ kind: "place_flag", placeId: parsed.placeId, reason: parsed.reason, actor });
}

/* ══════════════════════════════════════════════════════════════════════════
   값 제안 · 가게 신고 · 사장님 요청 · 사진 올리기 (design 화면 2 "상세의 쓰기 표면")
   2026-09-08 — 상세에 남아 있던 "준비 중이에요" 입구 7곳을 실제 쓰기로 바꾼다.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * 필드별 수정 (spec 4.2 — 즉시 반영 + 사후 확인).
 * **주소는 사용자가 직접 친 값만 받는다** — 지오코더 응답은 절대 규칙 2로 저장할 수 없다
 * (`naverPlaceUrl`과 같은 판례, decisions 2026-09-08). 그래서 화면에도 자동완성이 없다.
 */
export const suggestionSchema = z.discriminatedUnion("field", [
  z.object({
    field: z.literal("hours"),
    placeId: idSchema,
    // 제보 4단계 `hoursNote`와 같은 상한 — 같은 값을 두 곳에서 다르게 받지 않는다
    hoursNote: z.string().trim().min(1).max(80),
  }),
  z.object({
    field: z.literal("address"),
    placeId: idSchema,
    addressRoad: z.string().trim().min(2).max(60),
  }),
  /**
   * 메뉴는 **바뀐 것만** 보낸다 — 사후 확인에서 "무엇이 어떻게 바뀌었나"로 읽혀야 한다(decisions 2026-09-08).
   * 크롤 가게는 메뉴가 중앙값 3줄·최대 5줄이라 전체 교체 모델이 맞지 않는다.
   */
  z.object({
    field: z.literal("menus"),
    placeId: idSchema,
    /** 기존 줄의 변경. `index`는 제안 시점의 화면 순서, `name`은 큐에서 사람이 대조할 이름이다 */
    edits: z
      .array(
        z.object({
          index: z.number().int().min(0),
          // 크롤 메뉴명은 최대 59자였다(목 50곳) — 여유를 둔다
          name: z.string().trim().min(1).max(200),
          /** 새로 제안하는 가격. 가격을 안 고쳤으면 없다 */
          price: z.number().int().min(100).max(999_999).optional(),
          /** "없어졌어요"로 표시한 줄 */
          removed: z.boolean(),
        }),
      )
      .max(MAX_MENU_EDITS),
    /** 새로 알려주는 줄 — 한 번에 하나까지. 구이·회 구분은 큐가 메뉴명으로 정한다 */
    added: z.array(reportMenuSchema).max(1),
  })
    // 아무것도 안 고치고 낸 제안은 큐에서 버리는 일만 늘린다 — 화면도 같은 문구로 막는다
    .refine((v) => v.edits.length + v.added.length > 0, "고친 곳이 없어요"),
  z.object({ field: z.literal("sides"), placeId: idSchema, sides: sidesSchema }),
]);
export type SuggestionInput = z.infer<typeof suggestionSchema>;

/** 수정 이력 — 되돌리기와 사후 확인(/admin)이 읽는다. Phase 6에선 `place_edits` 테이블. */
let editSeq = 0;
const placeEdits: PlaceEdit[] = [];

/**
 * 수정 이력 탭이 최신순으로 읽는다 (spec 4.5). 되돌리기는 `before`를 그대로 쓰면 된다.
 * **읽기에도 게이트를 세운다** — 누가 무엇을 고쳤는지는 운영 기록이고, 게이트 없는 읽기를 여기 두면
 * Phase 6이 그 모양을 그대로 베낀다(그때는 RLS가 유일한 방어선이 된다).
 */
export async function getPlaceEdits(filter: AdminListFilter = {}): Promise<PlaceEdit[]> {
  await requireAdmin();
  return [...placeEdits]
    .reverse()
    .filter((e) => withinDays(e.at, filter))
    .slice(0, filter.limit ?? ADMIN_PAGE_SIZE);
}

/** 제보 입력 한 줄 → 저장되는 메뉴. `submitReport`와 같은 모양이어야 한다. */
function toMenu(line: ReportMenuInput): Menu {
  return { raw: line.name, name: line.name, price: line.price, unit: line.unit, unit_raw: line.unitRaw };
}

/** 메뉴 제안 적용 — 가격 교체·삭제를 **원래 인덱스 기준으로** 한 번에 하고, 추가 줄은 뒤에 붙인다. */
function applyMenuEdits(menus: Menu[], input: Extract<SuggestionInput, { field: "menus" }>): Menu[] {
  const removed = new Set(input.edits.filter((e) => e.removed).map((e) => e.index));
  const prices = new Map(
    input.edits.filter((e) => e.price !== undefined).map((e) => [e.index, e.price]),
  );
  const kept = menus
    .map((menu, i) => {
      const price = prices.get(i);
      return price === undefined ? menu : { ...menu, price };
    })
    .filter((_, i) => !removed.has(i));
  return [...kept, ...input.added.map(toMenu)];
}

/**
 * 수정 제안 — **즉시 반영하고 운영자가 사후에 확인한다**(2026-09-08에 뒤집었다. 제보의 "즉시 노출 +
 * 24시간 내 사후 확인"과 같은 모델이다 — spec 5). 큐에서 기다리게 하면 1인 운영에서 밀리고, 밀리면
 * 아무도 두 번 고쳐주지 않는다. 즉시 반영의 전제는 되돌리기라서 **바뀌기 직전 값을 이력에 남긴다**.
 * 익명도 고칠 수 있다(spec 5 경계 그대로) — 익명 id가 `actor`로 남아 되돌리기·섀도 밴·속도 제한이 된다.
 * `tags`(구이/회)는 건드리지 않는다: 추가된 줄이 회인지는 운영자가 사후 확인에서 정한다.
 * 속도 제한 자리: 핀당 일 N — Phase 6 Upstash(spec 스팸 4겹 2). 자유 텍스트 방어는 같은 장의 내용 필터다.
 */
export async function submitSuggestion(input: SuggestionInput, now: DateInput): Promise<Place> {
  const parsed = suggestionSchema.parse(input);
  // 행위자는 지연 전에 (CLAUDE.md 쓰기 규칙)
  const actor = currentSession.userId;
  await simulateWrite();
  const data = dataset(now);
  const current = visiblePlaces(data.places).find((p) => p.id === parsed.placeId);
  if (!current) throw new Error("place not found");

  const before: PlaceEdit["before"] = {
    hoursNote: current.hoursNote,
    addressRoad: current.addressRoad,
    menus: current.menus,
    sides: current.sides,
  };
  let place: Place;
  switch (parsed.field) {
    case "hours":
      place = { ...current, hoursNote: parsed.hoursNote };
      break;
    case "address":
      // 지번은 건드리지 않는다 — 사용자가 준 건 도로명뿐이고, 둘을 같이 맞추는 건 사후 확인의 일이다
      place = { ...current, addressRoad: parsed.addressRoad };
      break;
    case "sides":
      place = { ...current, sides: parsed.sides };
      break;
    case "menus":
      place = { ...current, menus: applyMenuEdits(current.menus, parsed) };
      break;
  }

  data.places = data.places.map((p) => (p.id === place.id ? place : p));
  editSeq += 1;
  placeEdits.push({
    id: `ed-local-${String(editSeq)}`,
    placeId: place.id,
    at: new Date(toMs(now)).toISOString(),
    actor,
    field: parsed.field,
    before,
  });
  // 평점은 리뷰에서 파생돼 `dataset`의 raw place엔 없다 — 그대로 돌려주면 호출자가 통째로 갈아끼우면서
  // 별점이 사라진다(`checkIn`과 같은 계약으로 얹는다, Codex PR #11 #2)
  return withRating(place, ratingsByPlace(visibleReviews(data.reviews)));
}

const placeReportSchema = z.object({
  placeId: idSchema,
  reason: z.enum(["not_shrimp", "fake", "duplicate", "other"]),
});

/**
 * 가게 신고 접수 (spec 5 "신고 3회 → 자동 숨김", 스팸 4겹 2 "신고 일 10").
 * 사유에 "문 닫았어요"가 없는 건 그게 `flagPlace`(정보 수정 제안)의 사유이기 때문이다 —
 * 신고는 "이 등록 자체가 잘못됐다", 수정 제안은 "값이 틀렸다"로 갈린다(decisions 2026-09-08).
 * 익명도 보낼 수 있다(spec 5). 속도 제한 자리: 일 10 — Phase 6 Upstash(spec 스팸 4겹 2).
 */
export async function reportPlace(input: {
  placeId: string;
  reason: PlaceReportReason;
}): Promise<void> {
  const parsed = placeReportSchema.parse(input);
  const actor = currentSession.userId;
  await simulateWrite();
  if (!placeExists(parsed.placeId)) throw new Error("place not found");
  pushReport({ kind: "place_report", placeId: parsed.placeId, reason: parsed.reason, actor });
}

/**
 * 사장님 정보 수정·게재 삭제 요청 (spec 4.2-9 "연락 창구 상시 노출", spec 5 "1회 요청으로 즉시 처리").
 * **연락처가 필수**인 이유: "24시간 내 처리"는 회신할 곳이 있어야 성립한다(decisions 2026-09-08).
 * 목 단계에는 저장할 곳이 없어 검증 + 지연만 한다 — reports 테이블·텔레그램 알림은 Phase 6.
 * 익명도 보낼 수 있다(사장님이 우리 계정을 가질 이유가 없다). 속도 제한 자리: 핀당 일 N — Phase 6 Upstash.
 */
export const ownerRequestSchema = z.object({
  placeId: idSchema,
  kind: z.enum(["edit", "remove"]),
  /**
   * 연락처는 Phase 6에서 텔레그램 알림 본문에 들어간다 — 개행·제어문자로 본문을 조작하지 못하게
   * NFKC 정규화 + 제어문자 제거를 먼저 한다(`nicknameSchema`와 같은 문법, security-reviewer 2026-09-08).
   */
  contact: z
    .string()
    .transform((v) => v.normalize("NFKC").replaceAll(/[\u0000-\u001f\u007f]/gu, " ").trim())
    .pipe(z.string().min(5).max(60)),
  message: z.string().trim().max(300),
});
export type OwnerRequestInput = z.infer<typeof ownerRequestSchema>;

export async function submitOwnerRequest(input: OwnerRequestInput): Promise<void> {
  const parsed = ownerRequestSchema.parse(input);
  const actor = currentSession.userId;
  await simulateWrite();
  if (!placeExists(parsed.placeId)) throw new Error("place not found");
  pushReport({
    kind: "owner_request",
    placeId: parsed.placeId,
    ownerKind: parsed.kind,
    contact: parsed.contact,
    message: parsed.message,
    actor,
  });
}

const photoUploadSchema = z.object({
  placeId: idSchema,
  files: z
    .array(
      z
        .instanceof(File)
        .refine((f) => f.type.startsWith("image/"), "이미지 파일만")
        .refine((f) => f.size <= MAX_PHOTO_BYTES, "사진 한 장은 10MB까지"),
    )
    .min(1)
    .max(MAX_PLACE_PHOTOS),
});

/**
 * 사진 올리기 — **수정 제안과 달리 즉시 반영이다**(spec 4.2 "예외: 사진(즉시), 다녀왔어요(즉시)").
 * 그래서 갱신된 Place를 돌려준다: 호출자가 스트립·카드·마커를 바로 맞춘다.
 * 10장 상한은 UI(＋ 타일이 안내 타일로 바뀜)에도 있지만 여기가 마지막 방어선이고,
 * 남은 자리보다 많이 고르면 앞에서부터 채운다. MIME은 클라이언트가 정하는 값이라 위조 가능 —
 * 서버 sharp 재인코딩(spec 스팸 4겹 3)이 진짜 방어선이다.
 */
export async function addPlacePhotos(
  placeId: string,
  files: readonly File[],
  now: DateInput,
): Promise<Place> {
  const parsed = photoUploadSchema.parse({ placeId, files: [...files] });
  // 행위자는 지연 전에 (CLAUDE.md 쓰기 규칙). 속도 제한 자리: 가게당 시간 N장 — Phase 6 Upstash
  const actor = currentSession.userId;
  await simulateWrite();
  const data = dataset(now);
  const current = visiblePlaces(data.places).find((p) => p.id === parsed.placeId);
  if (!current) throw new Error("place not found");
  const room = MAX_PLACE_PHOTOS - current.photos.length;
  if (room <= 0) throw new Error("photo limit reached");
  const uploadedAt = new Date(toMs(now)).toISOString();
  const photos = [...current.photos, ...toPhotos(parsed.placeId, parsed.files.slice(0, room), uploadedAt, actor)];
  // 대표 = photos[0].url — 첫 장이 올라간 가게는 카드·마커 썸네일도 이때 생긴다
  const place: Place = { ...current, photos, thumbnailUrl: photos[0]?.url ?? null };
  data.places = data.places.map((p) => (p.id === place.id ? place : p));
  // 파생 평점을 얹어 돌려준다 (submitSuggestion과 같은 이유)
  return withRating(place, ratingsByPlace(visibleReviews(data.reviews)));
}

/* ══════════════════════════════════════════════════════════════════════════
   관리자 /admin (spec 4.4·4.5 · design 화면 10)
   목 단계의 저장소는 이 모듈의 메모리다. Phase 6에서 reports 테이블 + RLS로 바뀐다.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * 목 단계의 관리자 스위치 — **dev에서만 켜진다.** URL 쿼리로 켜지 않는 이유는 프로덕션에서 열리면 안 되기
 * 때문이다(`?mock=error`가 production에서 무시되는 것과 같은 결). 실제 판정은 Phase 6 `profiles.is_admin`.
 */
export function setAdmin(on: boolean): Promise<Session> {
  if (process.env.NODE_ENV === "production") return Promise.resolve(currentSession);
  currentSession = { ...currentSession, isAdmin: on };
  return Promise.resolve(currentSession);
}

/**
 * 신고가 이만큼 쌓이면 관리자 화면에서 **눈에 띄게 표시한다**(spec 5의 "신고 3회").
 *
 * **자동으로 숨기지는 않는다**(2026-09-08 뒤집음). 원래는 3회면 숨겼는데 security-reviewer가
 * 그게 무기가 된다는 걸 보여줬다: 익명 id는 로그아웃·새로고침마다 새로 나오고 **회전 비용이 0**이라
 * 한 사람이 세 번 눌러 남의 가게를 모든 사용자 지도에서 지울 수 있었다. actor 기준 중복 제거는
 * 그 앞에서 무력하다. 자동 숨김은 **spec 5 스팸 4겹(Turnstile·속도 제한·기기 식별)이 선 뒤에야 성립한다**
 * — Phase 6로 미루고, 그때까지는 운영자가 보고 누른다(오탐을 되돌릴 사람이 항상 있는 편이 낫다).
 */
export const REPORT_ATTENTION_COUNT = 3;

/**
 * 관리자 목록이 한 번에 가져오는 최대 행 수. **양 제한이 없으면 이력이 쌓일수록 표가 통째로 그려져
 * 느려진다** — 무료 티어 한도(DB 500MB·MAU 5만)보다 이게 훨씬 먼저 온다(2026-09-08).
 * Phase 6에서 그대로 SQL `LIMIT`가 된다.
 */
export const ADMIN_PAGE_SIZE = 100;

/** 관리자 목록 공통 옵션 — 기간(일)과 상한. `sinceDays`가 없으면 전체다. */
export interface AdminListFilter {
  /** 기준 시각. 없으면 지금 */
  now?: DateInput;
  /** 최근 N일만. null·없음 = 전체 */
  sinceDays?: number | null;
  limit?: number;
}

/** `at`이 기준 안에 드는가 — 기간 칩이 쓰는 잣대. */
function withinDays(at: string, filter: AdminListFilter): boolean {
  if (filter.sinceDays === undefined || filter.sinceDays === null) return true;
  const base = filter.now === undefined ? Date.now() : toMs(filter.now);
  return toMs(at) >= base - filter.sinceDays * 86_400_000;
}

/**
 * 마지막 방어선. 프론트 게이트(`/admin`의 `notFound()`)는 장식이고 진짜 판정은 Phase 6 서버·RLS다 —
 * 목 단계에도 쓰기 함수마다 세워 두어 "화면만 가리면 된다"는 습관이 안 생기게 한다(spec 4.5).
 */
async function requireAdmin(): Promise<void> {
  if (currentSession.isAdmin !== true) throw new Error("forbidden");
  // Phase 6에서는 여기가 실제 왕복이 된다(서버가 `profiles.is_admin`을 읽는다) — 그래서 async다
  await Promise.resolve();
}

/** 한 데이터셋 안에서 가게 하나를 갈아끼운다. 없으면 던진다. */
function patchPlaceSync(data: Dataset, placeId: string, patch: (place: Place) => Place): Place {
  const current = data.places.find((p) => p.id === placeId);
  if (!current) throw new Error("place not found");
  const next = patch(current);
  data.places = data.places.map((p) => (p.id === placeId ? next : p));
  return next;
}

/**
 * 운영 상태를 바꾼다 — **`placeOps` 맵이 진실이고** 이미 만들어진 날짜 캐시들에 같은 값을 덧씌운다.
 * 맵에 안 남기면 다음 날 `dataset()`이 원본에서 다시 만들면서 숨김이 풀린다(security-reviewer 2026-09-08).
 */
function patchPlaceEverywhere(placeId: string, patch: (place: Place) => Place): Place {
  let result: Place | null = null;
  for (const data of datasetCache.values()) {
    if (!data.places.some((p) => p.id === placeId)) continue;
    result = patchPlaceSync(data, placeId, patch);
  }
  if (!result) throw new Error("place not found");
  const ops: PlaceOps = {};
  if (result.hiddenAt !== undefined) ops.hiddenAt = result.hiddenAt;
  if (result.verifiedAt !== undefined) ops.verifiedAt = result.verifiedAt;
  if (result.removedByOwner === true) ops.removedByOwner = true;
  placeOps.set(placeId, ops);
  return result;
}

let reportRowSeq = 0;
const reports: Report[] = [];

function pushReport(input: Omit<Report, "id" | "at" | "status">): Report {
  reportRowSeq += 1;
  // 접수 시각은 목이라 실제 시각을 쓴다 — 사용자 쓰기의 `now`(서버 렌더 시각)와 달리 관리자만 읽는 값이다
  const report: Report = { ...input, id: `rp-local-${String(reportRowSeq)}`, at: new Date().toISOString(), status: "open" };
  reports.push(report);
  return report;
}

/**
 * 신고·요청 목록 — 최신순. `kind`로 거르면 종류 칩 한 줄이 된다.
 * **가장 민감한 읽기다**: 사장님 요청의 연락처(개인정보)와 낸 사람의 익명 id가 들어 있다.
 */
export async function getReports(
  filter: AdminListFilter & { kind?: ReportKind; status?: ReportStatus } = {},
): Promise<Report[]> {
  await requireAdmin();
  return [...reports]
    .reverse()
    .filter((r) => (filter.kind ? r.kind === filter.kind : true))
    .filter((r) => (filter.status ? r.status === filter.status : true))
    .filter((r) => withinDays(r.at, filter))
    .slice(0, filter.limit ?? ADMIN_PAGE_SIZE);
}

const resolveReportSchema = z.object({
  id: idSchema,
  // `as` 단언으로 넘기면 모르는 상태가 저장되고, 그 행은 열린 큐에서 빠지는데 어떤 종결 상태도 아니라
  // **영영 안 보인다**. 다른 쓰기와 같이 첫 await 앞에서 파싱한다 (Codex PR #12)
  status: z.enum(["open", "done", "dismissed"]),
});

/** 처리함·무시함으로 넘긴다. **원하는 상태를 받는다**(토글 아님, CLAUDE.md 쓰기 규칙). */
export async function resolveReport(id: string, status: ReportStatus): Promise<Report> {
  const parsed = resolveReportSchema.parse({ id, status });
  await requireAdmin();
  await simulateWrite();
  const i = reports.findIndex((r) => r.id === parsed.id);
  const current = reports[i];
  if (!current) throw new Error("report not found");
  const next: Report = { ...current, status: parsed.status };
  reports[i] = next;
  return next;
}

/** 사후 확인 — 배지만 찍는다. "새로 제보됨" 라벨(`isNew`)은 건드리지 않는다(decisions 2026-09-08). */
export async function confirmPlace(placeId: string, now: DateInput): Promise<Place> {
  await requireAdmin();
  await simulateWrite();
  return patchPlaceEverywhere(placeId, (p) => ({ ...p, verifiedAt: new Date(toMs(now)).toISOString() }));
}

/** 숨김·복구 — 삭제가 아니다(spec 5). 복구하면 `removedByOwner` 표시도 함께 지운다. */
export async function setPlaceHidden(
  placeId: string,
  hidden: boolean,
  now: DateInput,
  options: { byOwner?: boolean } = {},
): Promise<Place> {
  await requireAdmin();
  await simulateWrite();
  return patchPlaceEverywhere(placeId, (p) => {
    if (!hidden) {
      const rest: Place = { ...p };
      delete rest.hiddenAt;
      delete rest.removedByOwner;
      return rest;
    }
    return {
      ...p,
      hiddenAt: new Date(toMs(now)).toISOString(),
      ...(options.byOwner === true && { removedByOwner: true }),
    };
  });
}

/**
 * 신고된 사진 내리기 — 신고 처리의 핵심 동작이라 [무시]와 짝이다(design 화면 10-2).
 * 사진만 빼고 가게는 그대로 둔다. 대표 썸네일이 그 장이었으면 다음 장으로 내려온다.
 */
export async function deletePlacePhoto(placeId: string, photoId: string): Promise<Place> {
  await requireAdmin();
  await simulateWrite();
  // 내린 사진 id는 **날짜 캐시 밖**에 남긴다 — `dataset(now)`만 고치면 KST 자정에 다시 만들어지며
  // 사진이 되살아나고, 이미 만들어진 다른 날짜 캐시에도 그대로 남는다(숨김과 같은 실수, Codex PR #12)
  removedPhotoIds.add(photoId);
  let result: Place | null = null;
  for (const data of datasetCache.values()) {
    if (!data.places.some((p) => p.id === placeId)) continue;
    result = patchPlaceSync(data, placeId, (p) => {
      const photos = p.photos.filter((photo) => photo.id !== photoId);
      return { ...p, photos, thumbnailUrl: photos[0]?.url ?? null };
    });
  }
  if (!result) throw new Error("place not found");
  return result;
}

/**
 * 검색 탭의 삭제 — **소프트다**. spec 5가 "재제보 시 관리자에게 경고 표시"를 요구하므로 기록이 남아야 한다.
 * 사장님 요청으로 내린 것은 `removedByOwner`가 붙어 재제보 때 구분된다.
 * 권한은 `setPlaceHidden`이 세운다(여기서 또 세우면 같은 검사가 두 번이다).
 */
export function deletePlace(placeId: string, now: DateInput, byOwner = false): Promise<Place> {
  return setPlaceHidden(placeId, true, now, { byOwner });
}

/**
 * 수정 되돌리기 — `PlaceEdit.before`를 그대로 덮는다. **되돌린 것도 이력에 남아 다시 되돌릴 수 있다**(대칭).
 * 그래서 확인 모달이 없다(파괴적인 건 삭제뿐).
 */
export async function revertPlaceEdit(editId: string, now: DateInput): Promise<Place> {
  // 행위자는 **첫 await 앞에서** 잡는다 — requireAdmin이 Phase 6에서 실제 왕복이 되면
  // 그 사이 바뀐 세션이 이력의 actor로 남는다 (CLAUDE.md 쓰기 규칙, security-reviewer 2026-09-08)
  const actor = currentSession.userId;
  await requireAdmin();
  await simulateWrite();
  const edit = placeEdits.find((e) => e.id === editId);
  if (!edit) throw new Error("edit not found");
  const data = dataset(now);
  const current = data.places.find((p) => p.id === edit.placeId);
  if (!current) throw new Error("place not found");
  const before: PlaceEdit["before"] = {
    hoursNote: current.hoursNote,
    addressRoad: current.addressRoad,
    menus: current.menus,
    sides: current.sides,
  };
  const place = patchPlaceSync(data, edit.placeId, (p) => ({ ...p, ...edit.before }));
  editSeq += 1;
  placeEdits.push({
    id: `ed-local-${String(editSeq)}`,
    placeId: place.id,
    at: new Date(toMs(now)).toISOString(),
    actor,
    field: edit.field,
    before,
  });
  return place;
}

/**
 * 검색 탭 — **숨긴 가게도 보여야 한다**(복구하려면 찾을 수 있어야 하니까). 상호 부분 일치, 최대 30.
 * 사용자 검색(`getPlaces`)과 달리 숨김을 걸러내지 않으므로 게이트가 필요하다.
 */
/**
 * 관리자 화면이 가게를 조인할 때 쓰는 읽기 — **숨긴 가게가 들어 있다.**
 * 사용자 읽기(`getPlaces`)로 조인하면 숨겨진 가게가 `undefined`가 되어 상호도, [복구] 버튼도 사라진다
 * → 자동/수동 숨김의 오탐을 되돌릴 길이 없어진다(security-reviewer 2026-09-08).
 */
export async function getPlacesForAdmin(now: DateInput): Promise<Place[]> {
  await requireAdmin();
  return [...dataset(now).places];
}

export async function searchPlacesForAdmin(query: string, now: DateInput): Promise<Place[]> {
  await requireAdmin();
  const q = normalizeQuery(query);
  if (q === "") return [];
  return dataset(now)
    .places.filter((p) => normalizeQuery(p.name).includes(q))
    .slice(0, ADMIN_PAGE_SIZE);
}

function countByDay(items: readonly { at: string }[], dayStart: number, dayEnd: number): number {
  return items.filter((i) => {
    const t = toMs(i.at);
    return t >= dayStart && t < dayEnd;
  }).length;
}

/** 관리자 통계 — 우리 DB로 셀 수 있는 것만(design 화면 10-5). Phase 6에선 이 함수만 SQL 집계로 바뀐다. */
export async function getAdminStats(now: DateInput): Promise<AdminStats> {
  await requireAdmin();
  const data = dataset(now);
  const reviews = visibleReviews(data.reviews);
  const reported = data.places.filter((p) => p.source === "report" && p.createdAt !== undefined);
  const day = 86_400_000;
  const todayStart = startOfDayKst(now);

  const bucket = (start: number): AdminDayCount => ({
    date: formatKstDate(start),
    reports: countByDay(reported.map((p) => ({ at: p.createdAt ?? "" })), start, start + day),
    checkins: countByDay(data.checkins, start, start + day),
    reviews: countByDay(reviews, start, start + day),
    edits: countByDay(placeEdits, start, start + day),
  });

  const daily: AdminDayCount[] = [];
  for (let i = 13; i >= 0; i -= 1) daily.push(bucket(todayStart - i * day));

  const actors = new Set<string>();
  for (const c of data.checkins) if (c.actor) actors.add(c.actor);
  for (const r of reviews) actors.add(r.authorId);
  for (const e of placeEdits) if (e.actor) actors.add(e.actor);
  let anonymous = 0;
  for (const a of actors) if (a.startsWith("anon-")) anonymous += 1;

  const visible = visiblePlaces(data.places);
  const topPlaces = [...visible]
    .sort((a, b) => b.checkCount - a.checkCount)
    .slice(0, 10)
    .map((p) => ({ placeId: p.id, name: p.name, checkCount: p.checkCount }));

  return {
    openReports: reports.filter((r) => r.status === "open").length,
    unverified: visible.filter((p) => p.source === "report" && p.verifiedAt === undefined).length,
    today: daily.at(-1) ?? bucket(todayStart),
    daily,
    participants: { anonymous, kakao: actors.size - anonymous },
    topPlaces,
  };
}
