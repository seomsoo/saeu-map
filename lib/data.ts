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
  Checkin,
  EventCard,
  LatLng,
  MyReview,
  NearestStation,
  Photo,
  Place,
  PlaceDetail,
  PlaceFlagReason,
  PlaceTag,
  Review,
  SeasonStats,
  Session,
} from "./types";
import {
  type DateInput,
  addDaysIso,
  isWithinNewWindow,
  kstDateOnlyToIso,
  kstDayIndex,
  startOfDayKst,
  startOfWeekKst,
  toMs,
} from "./time";
import { matchesQuery, normalizeQuery } from "./places";
import { sortReviewsNewest } from "./reviews";
import { safeAssetPath } from "./assets";
import { guOfPoint } from "./gu";

import placesJson from "./mock/places.json";
import checkinsJson from "./mock/checkins.json";
import reviewsJson from "./mock/reviews.json";
import eventCardJson from "./mock/event-card.json";

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

const MOCK_LATEST_DAY = Math.max(...rawCheckins.map((c) => kstDayIndex(c.at)));

/** 쓰기 시뮬레이션 — roadmap Phase 2 "목: delay 400ms, 10% 실패". */
export const MOCK_WRITE_DELAY_MS = 400;
export const MOCK_FAILURE_RATE = 0.1;

interface Dataset {
  places: Place[];
  checkins: Checkin[];
  reviews: Review[];
}

const datasetCache = new Map<number, Dataset>();

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

export function getPlaces(
  filter: PlaceFilter = {},
  now: DateInput = Date.now(),
): Promise<Place[]> {
  const { places } = dataset(now);
  const q = normalizeQuery(filter.query ?? "");
  return Promise.resolve(
    places.filter((p) => {
      if (filter.tag && !p.tags.includes(filter.tag)) return false;
      if (filter.gu && p.gu !== filter.gu) return false;
      if (filter.isNew !== undefined && p.isNew !== filter.isNew) return false;
      return matchesQuery(p, q);
    }),
  );
}

export function getPlaceById(
  id: string,
  now: DateInput = Date.now(),
): Promise<Place | undefined> {
  return Promise.resolve(dataset(now).places.find((p) => p.id === id));
}

/** 상세 화면 데이터: 가게 + 리뷰(최신순). 없는 id는 undefined. `now`는 서버가 내려준 값. */
export function getPlaceDetail(
  id: string,
  now: DateInput,
): Promise<PlaceDetail | undefined> {
  const { places, reviews } = dataset(now);
  const place = places.find((p) => p.id === id);
  if (!place) return Promise.resolve(undefined);
  return Promise.resolve({
    place,
    reviews: sortReviewsNewest(visibleReviews(reviews).filter((r) => r.placeId === id)),
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
  const visible = new Set(places.map((p) => p.id));

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

/** 현재 세션의 찜 목록. 서버에서는 항상 빈 값(서버 세션은 로그인하지 않는다). */
export function getBookmarkedPlaceIds(): Promise<string[]> {
  return Promise.resolve([...bookmarksOf(currentSession.userId)]);
}

/** 좌표가 속한 시군구 라벨("마포구", "김포시(경기)"). 한국 밖이면 null — 제보 2단계가 핀 확정 때 검사한다(decisions 2026-09-04). */
export function getGuOfPoint(point: LatLng): Promise<string | null> {
  return guOfPoint(point);
}

/* ══════════════════════════════════════════════════════════════════════════
 * 공개 API — 쓰기 (목: 400ms 지연 + 10% 실패. 컴포넌트는 낙관적 업데이트 + 실패 롤백)
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * "다녀왔다면" 확인 +1 (spec 4.2-3). 성공하면 갱신된 Place를 돌려준다.
 * 캐시된 데이터셋의 Place는 새 객체로 교체한다(React state와 참조 동일성 계약).
 * 취소는 없다(spec 5). 핀당 하루 1회 제한은 컴포넌트 상태로(속도 제한 자리, Phase 6 Upstash).
 */
export async function checkIn(placeId: string, now: DateInput): Promise<Place> {
  const id = idSchema.parse(placeId);
  await simulateWrite();
  const data = dataset(now);
  const current = data.places.find((p) => p.id === id);
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
  return updated;
}

/** 사진 신고 사유 — 뷰어 신고 시트의 4행과 1:1 (design 화면 2 변형 (e)). */
export type PhotoReportReason = "inappropriate" | "wrong_place" | "spam" | "other";

const photoReportSchema = z.object({
  placeId: idSchema,
  photoId: idSchema,
  reason: z.enum(["inappropriate", "wrong_place", "spam", "other"]),
});

/**
 * 사진 신고 접수 (spec 스팸 4겹 2 "신고 일 10"). 익명 업로드 이미지라, 다른 미구현 입구와 달리
 * "준비 중이에요"로 미루지 않는다(decisions 2026-09-03).
 * 목 단계에는 저장할 곳이 없어 검증 + 지연만 한다 — reports 테이블·속도 제한은 Phase 6.
 */
export async function reportPhoto(input: {
  placeId: string;
  photoId: string;
  reason: PhotoReportReason;
}): Promise<void> {
  photoReportSchema.parse(input);
  await simulateWrite();
}

/**
 * 제보 메뉴 한 줄(spec 4.3-3). `unitRaw`는 `unitChipLabel`이 읽는 형태 그대로 —
 * kg·g는 숫자만("1", "500"), 한판·반판·N마리는 표기 자체("한판", "10마리"), 단위 없음은 null.
 * 大中小(size)·인분(serving)은 크롤 표기로만 두고 제보로 늘리지 않는다(decisions 2026-09-04).
 */
export const reportMenuSchema = z.object({
  name: z.string().trim().min(1).max(30),
  price: z.number().int().min(100),
  unit: z.enum(["kg", "g", "pan", "count", "none"]),
  unitRaw: z.string().trim().max(10).nullable(),
  /** true = 새우회 줄("새우회도 팔아요"), false = 구이 줄 */
  raw: z.boolean(),
});

/** 제보 입력(design 화면 3). 필수는 가게명·좌표·메뉴 한 줄뿐(spec 4.3). 주소는 받지 않는다 — 구는 좌표로 판정(전국). 좌표 범위는 한국 대략 상자. */
export const reportInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  lat: z.number().min(33).max(39),
  lng: z.number().min(124).max(132),
  menus: z.array(reportMenuSchema).min(1).max(2),
  sides: z.object({ headButter: z.boolean(), ramen: z.boolean(), friedRice: z.boolean() }),
  hoursNote: z.string().trim().max(80),
  /** 4단계 미리보기까지 고른 파일. 목 단계에는 저장소가 없어 버린다(Phase 6). */
  photos: z
    .array(z.instanceof(File).refine((f) => f.type.startsWith("image/"), "이미지 파일만"))
    .max(MAX_PLACE_PHOTOS),
  /** 2단계 중복 의심에 "다른 가게예요"로 답했으면 그 후보 id */
  duplicateOf: idSchema.nullable(),
});

export type ReportMenuInput = z.infer<typeof reportMenuSchema>;
export type ReportInput = z.infer<typeof reportInputSchema>;

let reportSeq = 0;

/**
 * 제보 등록 (spec 4.3, 5 "모든 제보 즉시 노출"). 성공하면 만들어진 Place를 돌려주고 데이터셋 끝에 붙인다.
 * 구는 좌표로 판정하고 한국 밖(바다)이면 지연 전에 거부한다. 주소·최근접역은 비워 둔다(Phase 6 서버 파생).
 * `now`는 목 데이터셋 조회·등록 시각용이다 — Phase 6에서는 서버가 정한다(checkIn과 같은 계약).
 */
export async function submitReport(input: ReportInput, now: DateInput): Promise<Place> {
  const report = reportInputSchema.parse(input);
  const gu = await guOfPoint(report);
  if (gu === null) throw new Error("outside korea");
  await simulateWrite();
  const data = dataset(now);
  const createdAt = new Date(toMs(now)).toISOString();
  reportSeq += 1;
  const tags: PlaceTag[] = ["grill"];
  if (report.menus.some((m) => m.raw)) tags.push("raw");
  const place: Place = {
    id: `r${String(reportSeq).padStart(3, "0")}`,
    name: report.name,
    gu,
    addressRoad: null,
    addressJibun: null,
    lat: report.lat,
    lng: report.lng,
    nearestStation: null,
    tags,
    specialist: false, // 제보 핀은 전문점 판정 없음 (spec 2 가공 규칙)
    naverPlaceUrl: null,
    photos: [],
    thumbnailUrl: null,
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
    reporterId: currentSession.userId,
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
export function toggleBookmark(placeId: string): Promise<string[]> {
  // 검증 실패도 throw가 아니라 reject로 (쓰기 함수는 전부 같은 계약)
  return Promise.resolve(placeId).then((raw) => {
    const id = idSchema.parse(raw);
    if (!placeExists(id)) throw new Error("place not found");
    const mine = bookmarksOf(currentSession.userId);
    if (mine.has(id)) mine.delete(id);
    else mine.add(id);
    return [...mine];
  });
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
    // 확인 이벤트는 집계(시즌 카운터·확인 N회)에 남되 개인 식별자는 뗀다 — Phase 6: actor nullable + ON DELETE SET NULL
    data.checkins = data.checkins.map((c) => (c.actor === me ? { ...c, actor: DELETED_ACTOR } : c));
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
  const current = data.places.find((p) => p.id === parsed.placeId);
  if (!current) throw new Error("place not found");
  const at = new Date(toMs(now)).toISOString();
  reviewSeq += 1;
  const review: Review = {
    id: `rv-local-${String(reviewSeq)}`,
    placeId: parsed.placeId,
    authorId: currentSession.userId,
    rating: parsed.rating,
    text: parsed.text,
    nickname: currentSession.nickname ?? KAKAO_MOCK_NICKNAME,
    at,
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
  const names = new Map(places.map((p) => [p.id, p.name]));
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
  const mine = dataset(now)
    .places.filter((p) => p.reporterId === currentSession.userId)
    .sort((a, b) => toMs(b.createdAt ?? b.lastCheckedAt) - toMs(a.createdAt ?? a.lastCheckedAt));
  return Promise.resolve(mine);
}

const placeFlagSchema = z.object({
  placeId: idSchema,
  reason: z.enum(["location", "menu", "closed", "other"]),
});

/**
 * 신규 패널 [정보가 달라요] 접수 (design 화면 4 변형 (a)). 사진 신고와 같은 계약 — 검증 + 지연만,
 * 수정 제안 큐·관리자 화면은 Phase 6. 익명도 보낼 수 있다(spec 5 "수정 제안은 익명 가능") —
 * 가장 싼 도배 경로라 속도 제한 자리: 핀당 일 1 (Phase 6 Upstash, spec 스팸 4겹 2).
 */
export async function flagPlace(input: { placeId: string; reason: PlaceFlagReason }): Promise<void> {
  placeFlagSchema.parse(input);
  await simulateWrite();
}
