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
  NearestStation,
  Photo,
  Place,
  PlaceDetail,
  PlaceTag,
  Review,
  SeasonStats,
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

/** 찜 자리 — 모듈 메모리 Set. 클라이언트에선 탭 단위(새로고침 시 소멸), 서버에선 항상 빈 값. Phase 4에서 사용자 단위로 교체. */
const bookmarkedIds = new Set<string>();

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
    reviews: sortReviewsNewest(reviews.filter((r) => r.placeId === id)),
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
  const { reviews } = dataset(now);
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

export function getBookmarkedPlaceIds(): Promise<string[]> {
  return Promise.resolve([...bookmarkedIds]);
}

/** 좌표가 속한 서울 자치구("마포구"). 25구 밖이면 null — 제보 2단계가 핀 확정 때 검사한다(decisions 2026-09-04). */
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
  data.checkins = [...data.checkins, { placeId: id, type: "visited", at, actor: "anon-local" }];
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

/** 제보 입력(design 화면 3). 필수는 가게명·좌표·메뉴 한 줄뿐(spec 4.3). 주소는 받지 않는다 — 구는 좌표로 판정. */
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
 * 구는 좌표로 판정하고 서울 밖이면 지연 전에 거부한다. 주소·최근접역은 비워 둔다(Phase 6 서버 파생).
 * `now`는 목 데이터셋 조회·등록 시각용이다 — Phase 6에서는 서버가 정한다(checkIn과 같은 계약).
 */
export async function submitReport(input: ReportInput, now: DateInput): Promise<Place> {
  const report = reportInputSchema.parse(input);
  const gu = await guOfPoint(report);
  if (gu === null) throw new Error("outside seoul");
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
  };
  data.places = [...data.places, place];
  return place;
}

/** 찜 토글 (spec 5 "찜"). 확인일은 갱신하지 않는다. 현재 찜 목록을 돌려준다. */
export function toggleBookmark(placeId: string): Promise<string[]> {
  // 검증 실패도 throw가 아니라 reject로 (쓰기 함수는 전부 같은 계약)
  return Promise.resolve(placeId).then((raw) => {
    const id = idSchema.parse(raw);
    if (bookmarkedIds.has(id)) bookmarkedIds.delete(id);
    else bookmarkedIds.add(id);
    return [...bookmarkedIds];
  });
}
