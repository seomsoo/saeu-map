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

import placesJson from "./mock/places.json";
import checkinsJson from "./mock/checkins.json";
import reviewsJson from "./mock/reviews.json";
import eventCardJson from "./mock/event-card.json";

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
  "isNew" | "lastCheckedAt" | "createdAt" | "thumbnailUrl" | "hoursNote"
> & {
  isNew: boolean;
  lastCheckedAt: string; // "YYYY-MM-DD"
  createdAt?: string; // "YYYY-MM-DD"
  thumbnail?: string; // /public 경로. 사진 업로드 전까지 목 샘플만
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
    .map(({ thumbnail, hoursNote, ...raw }) => {
      const createdAt = raw.createdAt ? shiftDateOnly(raw.createdAt) : undefined;
      return {
        ...raw,
        // 이미지 경로는 우리 스토리지(/…)만 — 규칙 3 (외부 도메인이 섞여 들어오면 플레이스홀더로)
        thumbnailUrl: safeAssetPath(thumbnail),
        hoursNote: hoursNote ?? null,
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

const placeIdSchema = z.string().trim().min(1).max(64);

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

/* ══════════════════════════════════════════════════════════════════════════
 * 공개 API — 쓰기 (목: 400ms 지연 + 10% 실패. 컴포넌트는 낙관적 업데이트 + 실패 롤백)
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * "다녀왔다면" 확인 +1 (spec 4.2-3). 성공하면 갱신된 Place를 돌려준다.
 * 캐시된 데이터셋의 Place는 새 객체로 교체한다(React state와 참조 동일성 계약).
 * 취소는 없다(spec 5). 핀당 하루 1회 제한은 컴포넌트 상태로(속도 제한 자리, Phase 6 Upstash).
 */
export async function checkIn(placeId: string, now: DateInput): Promise<Place> {
  const id = placeIdSchema.parse(placeId);
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

/** 찜 토글 (spec 5 "찜"). 확인일은 갱신하지 않는다. 현재 찜 목록을 돌려준다. */
export function toggleBookmark(placeId: string): Promise<string[]> {
  // 검증 실패도 throw가 아니라 reject로 (쓰기 함수는 전부 같은 계약)
  return Promise.resolve(placeId).then((raw) => {
    const id = placeIdSchema.parse(raw);
    if (bookmarkedIds.has(id)) bookmarkedIds.delete(id);
    else bookmarkedIds.add(id);
    return [...bookmarkedIds];
  });
}
