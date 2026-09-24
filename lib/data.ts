/**
 * 데이터 접근 계층 — 컴포넌트는 이 파일의 함수만 호출한다 (절대 규칙 1).
 *
 * Phase 6: 실제 일은 lib/server/actions.ts(서버 액션)가 하고, 이 파일은 그 앞의 얇은 문이다.
 *  - 서버(페이지·generateMetadata·OG 빌드)에서 부르면 액션이 그냥 함수 호출이다.
 *  - 클라이언트에서 부르면 Next가 같은 함수를 POST로 바꿔 준다 — 브라우저에 Supabase가 없는 이유(decisions 2026-09-10).
 *  - 쓰기의 예상 실패(핀당 리뷰 1개 등)는 액션이 값으로 돌려주고(프로덕션의 Next는 오류 메시지를 지운다) 여기서 throw로 바꾼다 —
 *    컴포넌트 계약(throw → 토스트, "already reviewed" 분기)은 목 시절 그대로다.
 *  - 설정값(이벤트 카드·까주기 테스트)은 lib/content JSON이라 서버가 필요 없다.
 *  - `now`는 화면의 상대 시간 기준(서버 렌더 시각)이다. DB는 자기 시계를 쓴다 — 클라이언트 값을 저장하지 않는다.
 */
import { SIDE_KEYS } from "./places";
import { PEEL_PLACE_COUNT } from "./peel-test";
import { guCenter, guOfPoint } from "./gu";
import { type DateInput, toMs } from "./time";
import type {
  EventCard,
  LatLng,
  PeelSlug,
  PeelTest,
  PeelType,
  Place,
  Report,
  ReportStatus,
  Review,
  Session,
} from "./types";
import * as actions from "./server/actions";
import { turnstileToken } from "./turnstile-client";
import { shrinkImage } from "./image-shrink";
import { MAX_PHOTO_BYTES, MAX_UPLOAD_BYTES, PHOTO_TOO_LARGE_MESSAGE, UPLOAD_TOO_LARGE_MESSAGE } from "./schemas";
import type { Result } from "./server/actions";
import type { ReportInput, ReviewInput, ReviewPatch } from "./schemas";

import eventCardJson from "./content/event-card.json";
import peelTestJson from "./content/peel-test.json";

export * from "./schemas";

const rawEventCard = eventCardJson as EventCard;
const rawPeelTest = peelTestJson as PeelTest;

/** 액션의 실패 값 → throw. 메시지는 컴포넌트가 분기하는 코드 그대로("already reviewed" 등). */
function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  throw new Error(result.error);
}

/** 쓰기마다 Turnstile 토큰 한 장(브라우저). 서버에서 쓰기를 부를 일은 없다 — 빈 토큰은 문에서 거부된다. */
function token(): Promise<string> {
  return typeof window === "undefined" ? Promise.resolve("") : turnstileToken();
}

/**
 * 브라우저가 아는 세션 id — SessionProvider가 세션이 바뀔 때마다 알려 준다. 쓰기 래퍼는 Turnstile 토큰을 기다리기 **전에**
 * 이 값을 잡아 액션에 보내고, 서버 문이 쿠키의 사용자와 대조한다(행위자는 await 전에 — CLAUDE.md 컨벤션, Codex PR #16 #1). 모르면 null(대조 없음).
 */
let knownUserId: string | null = null;
export function rememberSession(session: Session | null): void {
  knownUserId = session?.userId ?? null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 읽기
 * ════════════════════════════════════════════════════════════════════════ */

export const getPlaces = actions.getPlaces;
export const getPlaceById = actions.getPlaceById;
export const getPlaceDetail = actions.getPlaceDetail;
export const getSeasonStats = actions.getSeasonStats;
export const getBookmarkedPlaceIds = actions.getBookmarkedPlaceIds;
export const getMyReviews = actions.getMyReviews;
export const getMyReports = actions.getMyReports;

/** 이벤트 카드 슬롯 — 기간 밖이면 null. 닫기 상태는 클라이언트 메모리(규칙 4). */
export function getEventCard(now: DateInput = Date.now()): Promise<EventCard | null> {
  const nowMs = toMs(now);
  const inPeriod = nowMs >= toMs(rawEventCard.startsAt) && nowMs <= toMs(rawEventCard.endsAt);
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

/** 추천 순위 공통 — 평점(리뷰 3개 이상일 때만 붙는다) → 리뷰 수 → 확인 수 → 이름. */
function byRatingThenChecks(a: Place, b: Place): number {
  return (
    (b.rating?.average ?? 0) - (a.rating?.average ?? 0) ||
    (b.rating?.count ?? 0) - (a.rating?.count ?? 0) ||
    b.checkCount - a.checkCount ||
    a.name.localeCompare(b.name, "ko")
  );
}

/** 유형에 어울리는 가게 3곳 (design 화면 11-3). 축 B로 거르고 축 A로 가른다. */
export async function getPeelTypePlaces(slug: PeelSlug, now: DateInput = Date.now()): Promise<Place[]> {
  const type = await getPeelType(slug);
  if (!type) return [];
  const places = await getPlaces({ tag: type.taste }, String(now));
  const weight = (p: Place) => (type.role === "peel" ? sideCount(p) : p.specialist ? 1 : 0);
  return [...places]
    .sort((a, b) => weight(b) - weight(a) || byRatingThenChecks(a, b))
    .slice(0, PEEL_PLACE_COUNT);
}

/** 둘이 같이 갈 가게 3곳 (design 화면 11-5). 취향이 갈리면 구이·회를 둘 다 하는 집. */
export async function getPeelMatchPlaces(a: PeelSlug, b: PeelSlug, now: DateInput = Date.now()): Promise<Place[]> {
  const [first, second] = await Promise.all([getPeelType(a), getPeelType(b)]);
  if (!first || !second) return [];
  const all = await getPlaces({}, String(now));
  const pool =
    first.taste === second.taste
      ? all.filter((p) => p.tags.includes(first.taste))
      : all.filter((p) => p.tags.includes("grill") && p.tags.includes("raw"));
  const ranked = [...pool].sort(byRatingThenChecks);
  if (ranked.length >= PEEL_PLACE_COUNT) return ranked.slice(0, PEEL_PLACE_COUNT);
  const picked = new Set(ranked.map((p) => p.id));
  const rest = [...all].filter((p) => !picked.has(p.id)).sort(byRatingThenChecks);
  return [...ranked, ...rest].slice(0, PEEL_PLACE_COUNT);
}

/** 좌표가 속한 시군구 라벨("마포구", "김포시(경기)"). 한국 밖이면 null — 제보 2단계가 핀 확정 때 검사한다. */
export function getGuOfPoint(point: LatLng): Promise<string | null> {
  return guOfPoint(point);
}

/** 서울 구의 지도 중심 — `/gu/[name]`이 가게 0곳일 때 지도를 그 구로 옮긴다. 서울 밖이면 null. */
export function getGuCenter(name: string): Promise<LatLng | null> {
  return guCenter(name);
}

/* ══════════════════════════════════════════════════════════════════════════
 * 세션
 * ════════════════════════════════════════════════════════════════════════ */

export const getSession = actions.getSession;
export const signOut = actions.signOut;
export async function deleteAccount(): Promise<Session> {
  const actor = knownUserId;
  return unwrap(await actions.deleteAccount(await token(), actor));
}

/**
 * 카카오 로그인 시작 — OAuth 페이지 URL을 돌려준다. 호출자(로그인 시트)가 그리로 이동하고,
 * 콜백이 `next`로 돌려보낸다(`?login=ok|fail` + 하려던 일 `intent`).
 */
/** 카카오 OAuth URL — 프리뷰(읽기 전용)면 throw "read only"(기존 실패 토스트) */
export async function signInWithKakao(next: string): Promise<string> {
  return unwrap(await actions.signInWithKakao(next));
}

export async function updateNickname(nickname: string): Promise<Session> {
  const actor = knownUserId;
  return unwrap(await actions.updateNickname(nickname, await token(), actor));
}

/* ══════════════════════════════════════════════════════════════════════════
 * 쓰기 (컴포넌트는 낙관적 업데이트 + 실패 롤백)
 * ════════════════════════════════════════════════════════════════════════ */

export async function checkIn(placeId: string, now: DateInput): Promise<Place> {
  const actor = knownUserId;
  return unwrap(await actions.checkIn(placeId, await token(), String(now), actor));
}

/** 찜 쓰기는 한 줄로 — 응답이 찜 목록 전체라, 겹친 요청이 뒤바뀐 순서로 오면 나중 응답이 앞선 찜을 지운다(Codex PR #16 #3) */
let bookmarkQueue: Promise<unknown> = Promise.resolve();
export function setBookmark(placeId: string, bookmarked: boolean): Promise<string[]> {
  const actor = knownUserId;
  const run = bookmarkQueue.then(async () => unwrap(await actions.setBookmark(placeId, bookmarked, await token(), actor)));
  bookmarkQueue = run.catch(() => undefined);
  return run;
}

/** 제보 등록. 사진은 가게가 생긴 뒤 같은 업로드 길(addPlacePhotos)로 — 업로드가 실패해도 제보는 남는다(사진 없는 가게). */

/**
 * 올리기 전에 **폰에서 먼저 줄이고**(1200px webp, lib/image-shrink) 크기를 검사한다 — 제보는 가게를 만들기 **전에** 걸러야
 * "가게는 됐는데 사진만 조용히 빠진" 성공처럼 보이는 실패가 없다(Codex PR #21 #1). 줄인 뒤엔 보통 100~300KB라 검사는 뒷받침.
 */
async function prepareUploads(files: readonly File[]): Promise<File[]> {
  const ready = await Promise.all(files.map(shrinkImage));
  if (ready.some((f) => f.size > MAX_PHOTO_BYTES)) throw new Error(PHOTO_TOO_LARGE_MESSAGE);
  if (ready.reduce((n, f) => n + f.size, 0) > MAX_UPLOAD_BYTES) throw new Error(UPLOAD_TOO_LARGE_MESSAGE);
  return ready;
}

export async function submitReport(input: ReportInput, now: DateInput): Promise<Place> {
  const { photos, ...payload } = input;
  const actor = knownUserId;
  const ready = photos.length === 0 ? [] : await prepareUploads(photos); // 가게를 만들기 전에
  const place = unwrap(await actions.submitReport(payload, await token(), String(now), actor));
  if (ready.length === 0) return place;
  try {
    return await uploadPlacePhotos(place.id, ready, actor);
  } catch {
    return place;
  }
}

export async function submitSuggestion(
  input: Parameters<typeof actions.submitSuggestion>[0],
  now: DateInput,
): Promise<Place> {
  const actor = knownUserId;
  return unwrap(await actions.submitSuggestion(input, await token(), String(now), actor));
}

export async function reportPhoto(input: Parameters<typeof actions.reportPhoto>[0]): Promise<void> {
  const actor = knownUserId;
  unwrap(await actions.reportPhoto(input, await token(), actor));
}

export async function flagPlace(input: Parameters<typeof actions.flagPlace>[0]): Promise<void> {
  const actor = knownUserId;
  unwrap(await actions.flagPlace(input, await token(), actor));
}

export async function reportPlace(input: Parameters<typeof actions.reportPlace>[0]): Promise<void> {
  const actor = knownUserId;
  unwrap(await actions.reportPlace(input, await token(), actor));
}

export async function submitOwnerRequest(input: Parameters<typeof actions.submitOwnerRequest>[0]): Promise<void> {
  const actor = knownUserId;
  unwrap(await actions.submitOwnerRequest(input, await token(), actor));
}

/** 사진 올리기 — 파일은 FormData로(액션 인자로 직렬화되지 않는다). 즉시 반영이라 갱신된 Place를 돌려준다. */
export async function addPlacePhotos(placeId: string, files: readonly File[], _now: DateInput): Promise<Place> {
  const actor = knownUserId;
  return uploadPlacePhotos(placeId, await prepareUploads(files), actor);
}

async function uploadPlacePhotos(placeId: string, files: readonly File[], actor: string | null): Promise<Place> {
  const form = new FormData();
  form.set("placeId", placeId);
  form.set("actor", actor ?? "");
  form.set("turnstile", await token());
  for (const file of files) form.append("photos", file);
  return unwrap(await actions.addPlacePhotos(form));
}

/** 리뷰 등록. 사진이 있으면 등록 뒤 붙인다 — 붙이기가 실패해도 리뷰는 남는다. */
export async function submitReview(input: ReviewInput, now: DateInput): Promise<{ review: Review; place: Place }> {
  const { photo, ...payload } = input;
  const actor = knownUserId;
  const ready = photo === null ? null : (await prepareUploads([photo]))[0]; // 리뷰를 만들기 전에
  const saved = unwrap(await actions.submitReview(payload, await token(), String(now), actor));
  if (ready === undefined || ready === null) return saved;
  const form = new FormData();
  form.set("reviewId", saved.review.id);
  form.set("actor", actor ?? "");
  form.set("turnstile", await token());
  form.set("photo", ready);
  try {
    const review = unwrap(await actions.attachReviewPhoto(form));
    return { review, place: saved.place };
  } catch {
    return saved;
  }
}

export async function updateReview(reviewId: string, patch: ReviewPatch, now: DateInput): Promise<Review> {
  const actor = knownUserId;
  return unwrap(await actions.updateReview(reviewId, patch, await token(), String(now), actor));
}

export async function deleteReview(reviewId: string): Promise<void> {
  const actor = knownUserId;
  unwrap(await actions.deleteReview(reviewId, await token(), actor));
}

/* ══════════════════════════════════════════════════════════════════════════
 * 관리자 — 진짜 게이트는 서버(app/admin)·RLS
 * ════════════════════════════════════════════════════════════════════════ */

export const getReports = actions.getReports;
export const getPlaceEdits = actions.getPlaceEdits;
export const getPlacesForAdmin = actions.getPlacesForAdmin;
export const searchPlacesForAdmin = actions.searchPlacesForAdmin;
export const getAdminStats = actions.getAdminStats;

export async function resolveReport(id: string, status: ReportStatus): Promise<Report> {
  return unwrap(await actions.resolveReport(id, status));
}

export async function confirmPlace(placeId: string, now: DateInput): Promise<Place> {
  return unwrap(await actions.confirmPlace(placeId, String(now)));
}

export async function setPlaceHidden(
  placeId: string,
  hidden: boolean,
  now: DateInput,
  options: { byOwner?: boolean } = {},
): Promise<Place> {
  return unwrap(await actions.setPlaceHidden(placeId, hidden, String(now), options));
}

export async function deletePlace(placeId: string, now: DateInput, byOwner = false): Promise<Place> {
  return unwrap(await actions.deletePlace(placeId, String(now), byOwner));
}

export async function deletePlacePhoto(placeId: string, photoId: string): Promise<Place> {
  return unwrap(await actions.deletePlacePhoto(placeId, photoId));
}

export async function revertPlaceEdit(editId: string, now: DateInput): Promise<Place> {
  return unwrap(await actions.revertPlaceEdit(editId, String(now)));
}

/** 합치기(관리자) — 옛 가게 → 새 가게. 되돌리기 없음. */
export async function mergePlaces(fromId: string, intoId: string): Promise<Place> {
  return unwrap(await actions.mergePlaces(fromId, intoId));
}
/** 합쳐진 옛 가게의 새 주소 — /place/[old] 영구 리다이렉트용 */
export const getMergedPlaceTarget = actions.getMergedPlaceTarget;
/** 까주기 결과 한 줄 — 실패는 액션이 삼킨다(결과 화면을 막지 않는다) */
export const recordPeelResult = actions.recordPeelResult;
