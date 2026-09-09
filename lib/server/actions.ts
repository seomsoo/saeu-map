"use server";

/**
 * 서버 액션 — 컴포넌트가 lib/data.ts를 통해 부르는 모든 읽기·쓰기의 서버 쪽.
 * 규칙: 검증(zod) → 행위자(세션)를 **첫 await 전에** → 쓰기 → 결과. 쓰기는 예상되는 실패를 값(`Result`)으로 돌려준다 —
 * 프로덕션의 Next는 액션이 던진 오류 메시지를 지우기 때문에("already reviewed" 같은 분기가 클라이언트에 못 간다).
 * lib/data.ts가 실패 값을 다시 throw로 바꿔 컴포넌트 계약(throw + 토스트)을 유지한다.
 * 속도 제한·섀도 밴·사진 상한은 DB(RLS·트리거·RPC)가 마지막으로 막는다 — 여기서는 그 오류를 코드로 옮길 뿐이다.
 */
import { z } from "zod";
import type { Json } from "@/lib/db/database.types";
import { env } from "@/lib/env";
import { guOfPoint } from "@/lib/gu";
import { applyMenuEdits, toMenu } from "@/lib/menu-edits";
import { matchesQuery, normalizeQuery } from "@/lib/places";
import {
  ADMIN_PAGE_SIZE,
  type AdminListFilter,
  idSchema,
  nicknameSchema,
  type OwnerRequestInput,
  ownerRequestSchema,
  type PhotoReportReason,
  type PlaceFilter,
  photoReportSchema,
  placeFlagSchema,
  placeReportSchema,
  type ReportPayload,
  reportPayloadSchema,
  resolveReportSchema,
  type ReviewPatch,
  type ReviewPayload,
  reviewPatchSchema,
  reviewPayloadSchema,
  type SuggestionInput,
  suggestionSchema,
} from "@/lib/schemas";
import { siteUrl } from "@/lib/seo";
import { formatKstDate } from "@/lib/time";
import type {
  AdminDayCount,
  AdminStats,
  MyReview,
  Photo,
  Place,
  PlaceDetail,
  PlaceEdit,
  PlaceFlagReason,
  PlaceReportReason,
  Report,
  ReportKind,
  ReportStatus,
  Review,
  SeasonStats,
  Session,
} from "@/lib/types";
import { toAdminPlace, toPhoto, toPlace, toReview } from "./rows";
import { ensureUser, readSession, requireKakao, VISITOR } from "./session";
import { adminClient, type Db, userClient } from "./supabase";

/** 쓰기 실패 — 컴포넌트가 분기하는 코드만. 그 밖은 throw(generic). */
export type FailCode =
  | "login required"
  | "already reviewed"
  | "already checked"
  | "rate limited"
  | "place not found"
  | "photo limit reached"
  | "forbidden"
  | "outside korea";
export type Result<T> = { ok: true; value: T } | { ok: false; error: FailCode };
const fail = (error: FailCode): Result<never> => ({ ok: false, error });
const okay = <T>(value: T): Result<T> => ({ ok: true, value });

/** Postgres 오류 코드 → 실패 코드. RPC의 raise·유니크·RLS가 여기로 온다. */
function failFromDb(error: { code?: string } | null): FailCode {
  switch (error?.code) {
    case "23505":
      return "already checked";
    case "P0003":
      return "rate limited";
    case "P0002":
      return "place not found";
    case "23514":
      return "photo limit reached";
    default:
      return "forbidden";
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * 읽기 (사용자 세션 클라이언트 — RLS가 숨긴 가게를 거른다)
 * ════════════════════════════════════════════════════════════════════════ */

export async function getPlaces(filter: PlaceFilter = {}, _now?: string): Promise<Place[]> {
  const db = await userClient();
  const rows: unknown[] = [];
  // PostgREST max_rows(기본 1000) — 다 받을 때까지 페이지를 넘긴다
  const page = 1000;
  for (let from = 0; ; from += page) {
    let q = db.from("places_public").select("*").order("created_at", { ascending: true }).range(from, from + page - 1);
    if (filter.tag) q = q.contains("tags", [filter.tag]);
    if (filter.gu) q = q.eq("gu", filter.gu);
    if (filter.isNew !== undefined) q = q.eq("is_new", filter.isNew);
    const { data, error } = await q;
    if (error) throw new Error("places unavailable");
    rows.push(...data);
    if (data.length < page) break;
  }
  const query = normalizeQuery(filter.query ?? "");
  return rows.map(toPlace).filter((p) => matchesQuery(p, query));
}

export async function getPlaceById(id: string, _now?: string): Promise<Place | undefined> {
  if (!idSchema.safeParse(id).success) return undefined;
  const db = await userClient();
  const { data, error } = await db.from("places_public").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("place unavailable");
  return data ? toPlace(data) : undefined;
}

/** 상세 화면 데이터: 가게 + 리뷰(최신순). 없는 id·uuid 아님은 undefined. */
export async function getPlaceDetail(id: string, _now?: string): Promise<PlaceDetail | undefined> {
  if (!idSchema.safeParse(id).success) return undefined;
  const db = await userClient();
  const [placeRes, reviewRes] = await Promise.all([
    db.from("places_public").select("*").eq("id", id).maybeSingle(),
    db.from("reviews_public").select("*").eq("place_id", id).order("created_at", { ascending: false }),
  ]);
  if (placeRes.error || reviewRes.error) throw new Error("place unavailable");
  if (!placeRes.data) return undefined;
  return { place: toPlace(placeRes.data), reviews: reviewRes.data.map(toReview) };
}

const seasonStatsSchema = z.object({
  todayCheckinCount: z.number(),
  weekPlaceCount: z.number(),
  newPlaceCount: z.number(),
  topPlace: z.object({ id: z.string(), name: z.string(), count: z.number() }).nullable(),
});

export async function getSeasonStats(_now?: string): Promise<SeasonStats> {
  const db = await userClient();
  const { data, error } = await db.rpc("season_stats");
  if (error) throw new Error("stats unavailable");
  return seasonStatsSchema.parse(data);
}

/** 현재 세션의 찜 목록. 방문자(세션 없음)는 빈 배열 — RLS가 본인 행만 준다. */
export async function getBookmarkedPlaceIds(): Promise<string[]> {
  const db = await userClient();
  const { data } = await db.auth.getClaims();
  if (!data?.claims.sub) return [];
  const { data: rows, error } = await db.from("bookmarks").select("place_id");
  if (error) throw new Error("bookmarks unavailable");
  return rows.map((r) => r.place_id);
}

/** 내 활동 > 내 리뷰 — 카카오 세션의 리뷰(최신순) + 가게명. 숨긴 가게의 리뷰는 뷰에서 빠진다. */
export async function getMyReviews(_now?: string): Promise<MyReview[]> {
  const db = await userClient();
  const { data: claims } = await db.auth.getClaims();
  const uid = claims?.claims.sub;
  if (!uid) return [];
  const { data: rows, error } = await db
    .from("reviews_public")
    .select("*")
    .eq("author_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw new Error("reviews unavailable");
  const reviews = rows.map(toReview);
  if (reviews.length === 0) return [];
  const ids = [...new Set(reviews.map((r) => r.placeId))];
  const { data: places, error: placesError } = await db.from("places_public").select("id, name").in("id", ids);
  if (placesError) throw new Error("places unavailable");
  const names = new Map(places.map((p) => [p.id, p.name]));
  return reviews.flatMap((r) => {
    const placeName = names.get(r.placeId);
    return placeName == null ? [] : [{ ...r, placeName }];
  });
}

/** 내 활동 > 내 제보 — reporter_id는 공개 열이 아니라 RPC로. */
export async function getMyReports(_now?: string): Promise<Place[]> {
  const db = await userClient();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims.sub) return [];
  const { data, error } = await db.rpc("my_reports");
  if (error) throw new Error("reports unavailable");
  return data.map(toPlace);
}

/* ══════════════════════════════════════════════════════════════════════════
 * 세션 (spec 5)
 * ════════════════════════════════════════════════════════════════════════ */

export async function getSession(): Promise<Session> {
  return readSession(await userClient());
}

/**
 * 카카오 로그인 시작 — OAuth URL을 돌려주고 클라이언트가 그리로 간다. 콜백(app/auth/callback)이 세션을 심고 익명 기록을 병합한다.
 * `next`는 돌아올 경로(같은 사이트의 경로만).
 */
export async function signInWithKakao(next: string): Promise<string> {
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const db = await userClient();
  const redirectTo = new URL("/auth/callback", siteUrl(env.SITE_URL));
  redirectTo.searchParams.set("next", safeNext);
  const { data, error } = await db.auth.signInWithOAuth({
    provider: "kakao",
    options: { redirectTo: redirectTo.toString(), skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new Error("kakao unavailable");
  return data.url;
}

/** 로그아웃 — 세션 쿠키를 지운다. 방문자로 돌아간다(다음 쓰기에서 새 익명). */
export async function signOut(): Promise<Session> {
  const db = await userClient();
  await db.auth.signOut();
  return VISITOR;
}

/** 탈퇴 (spec 5) — 카카오만. 개인 데이터 삭제는 secret key RPC(admin_delete_user)가 한 트랜잭션으로. */
export async function deleteAccount(): Promise<Session> {
  const db = await userClient();
  const uid = await requireKakao(db);
  const { error } = await adminClient().rpc("admin_delete_user", { p_uid: uid });
  if (error) throw new Error("delete failed");
  await db.auth.signOut();
  return VISITOR;
}

export async function updateNickname(nickname: string): Promise<Result<Session>> {
  const next = nicknameSchema.parse(nickname);
  const db = await userClient();
  let uid: string;
  try {
    uid = await requireKakao(db);
  } catch {
    return fail("login required");
  }
  const { error } = await db.from("profiles").update({ nickname: next }).eq("id", uid);
  if (error) return fail("forbidden");
  return okay(await readSession(db));
}

/* ══════════════════════════════════════════════════════════════════════════
 * 쓰기 — 익명 가능 (spec 5 경계)
 * ════════════════════════════════════════════════════════════════════════ */

async function placeOrFail(db: Db, id: string): Promise<Result<Place>> {
  const { data, error } = await db.from("places_public").select("*").eq("id", id).maybeSingle();
  if (error || !data) return fail("place not found");
  return okay(toPlace(data));
}

/** "다녀왔어요" 확인 +1 — 핀당 하루 1회는 DB 유니크 인덱스가 막는다(23505 → already checked). */
export async function checkIn(placeId: string, _now?: string): Promise<Result<Place>> {
  const id = idSchema.parse(placeId);
  const db = await userClient();
  const actor = await ensureUser(db);
  const { error } = await db.from("checkins").insert({ place_id: id, actor, type: "visited" });
  if (error) return fail(error.code === "23505" ? "already checked" : "place not found");
  return placeOrFail(db, id);
}

/** 찜 설정 — 원하는 상태를 받는다(멱등). 현재 찜 목록을 돌려준다. */
export async function setBookmark(placeId: string, bookmarked: boolean): Promise<Result<string[]>> {
  const id = idSchema.parse(placeId);
  const db = await userClient();
  const userId = await ensureUser(db);
  // ON CONFLICT DO NOTHING — DO UPDATE는 UPDATE 권한이 필요한데 bookmarks에는 insert·delete만 열어 뒀다(멱등은 이걸로 충분)
  const { error } = bookmarked
    ? await db
        .from("bookmarks")
        .upsert({ user_id: userId, place_id: id }, { onConflict: "user_id,place_id", ignoreDuplicates: true })
    : await db.from("bookmarks").delete().eq("user_id", userId).eq("place_id", id);
  if (error) return fail(error.code === "23503" ? "place not found" : "forbidden");
  const { data, error: listError } = await db.from("bookmarks").select("place_id");
  if (listError) return fail("forbidden");
  return okay(data.map((r) => r.place_id));
}

/** 제보 등록 (spec 4.3). 구는 좌표로 판정하고 한국 밖(바다)이면 거부. 사진은 별도 업로드. 시간당 5은 RPC가 센다. */
export async function submitReport(input: ReportPayload, _now?: string): Promise<Result<Place>> {
  const report = reportPayloadSchema.parse(input);
  const gu = await guOfPoint(report);
  if (gu === null) return fail("outside korea");
  const db = await userClient();
  await ensureUser(db);
  const tags: Place["tags"] = report.menus.some((m) => m.raw) ? ["grill", "raw"] : ["grill"];
  const sides = (Object.keys(report.sides) as (keyof typeof report.sides)[]).filter((k) => report.sides[k]);
  const { data: id, error } = await db.rpc("submit_report", {
    p_name: report.name,
    p_lat: report.lat,
    p_lng: report.lng,
    p_gu: gu,
    p_tags: tags,
    p_menus: report.menus.map(toMenu) as unknown as Json,
    p_sides: sides,
    p_hours_note: report.hoursNote,
    p_naver_place_url: report.naverPlaceUrl,
    ...(report.duplicateOf !== null && { p_duplicate_of: report.duplicateOf }),
  });
  if (error) return fail(failFromDb(error));
  return placeOrFail(db, id);
}

/** 값 제안 — 즉시 반영 + 이력(DB 트리거). 메뉴는 현재 줄에 편집을 적용한 전체를 보낸다. */
export async function submitSuggestion(input: SuggestionInput, _now?: string): Promise<Result<Place>> {
  const parsed = suggestionSchema.parse(input);
  const db = await userClient();
  await ensureUser(db);
  let value: unknown;
  switch (parsed.field) {
    case "hours":
      value = parsed.hoursNote;
      break;
    case "address":
      value = parsed.addressRoad;
      break;
    case "sides":
      value = (Object.keys(parsed.sides) as (keyof typeof parsed.sides)[]).filter((k) => parsed.sides[k]);
      break;
    case "menus": {
      const current = await placeOrFail(db, parsed.placeId);
      if (!current.ok) return current;
      value = applyMenuEdits(current.value.menus, parsed);
      break;
    }
  }
  const { error } = await db.rpc("apply_suggestion", {
    p_place: parsed.placeId,
    p_field: parsed.field,
    p_value: value as never,
  });
  if (error) return fail(failFromDb(error));
  return placeOrFail(db, parsed.placeId);
}

async function insertReport(
  db: Db,
  row: {
    kind: ReportKind;
    place_id: string;
    photo_id?: string;
    reason?: string;
    owner_kind?: "edit" | "remove";
    contact?: string;
    message?: string;
  },
): Promise<Result<void>> {
  const actor = await ensureUser(db);
  const { error } = await db.from("reports").insert({ ...row, actor });
  if (error) return fail(error.code === "42501" ? "rate limited" : "place not found");
  return okay(undefined);
}

export async function reportPhoto(input: {
  placeId: string;
  photoId: string;
  reason: PhotoReportReason;
}): Promise<Result<void>> {
  const parsed = photoReportSchema.parse(input);
  return insertReport(await userClient(), {
    kind: "photo_report",
    place_id: parsed.placeId,
    photo_id: parsed.photoId,
    reason: parsed.reason,
  });
}

export async function flagPlace(input: { placeId: string; reason: PlaceFlagReason }): Promise<Result<void>> {
  const parsed = placeFlagSchema.parse(input);
  return insertReport(await userClient(), { kind: "place_flag", place_id: parsed.placeId, reason: parsed.reason });
}

export async function reportPlace(input: { placeId: string; reason: PlaceReportReason }): Promise<Result<void>> {
  const parsed = placeReportSchema.parse(input);
  return insertReport(await userClient(), { kind: "place_report", place_id: parsed.placeId, reason: parsed.reason });
}

export async function submitOwnerRequest(input: OwnerRequestInput): Promise<Result<void>> {
  const parsed = ownerRequestSchema.parse(input);
  return insertReport(await userClient(), {
    kind: "owner_request",
    place_id: parsed.placeId,
    owner_kind: parsed.kind,
    contact: parsed.contact,
    message: parsed.message,
  });
}

/* ══════════════════════════════════════════════════════════════════════════
 * 리뷰 (spec 5 — 카카오 필수, 핀당 1, 본인 수정·소프트 삭제)
 * ════════════════════════════════════════════════════════════════════════ */

async function reviewById(db: Db, id: string): Promise<Review | null> {
  const { data } = await db.from("reviews_public").select("*").eq("id", id).maybeSingle();
  return data ? toReview(data) : null;
}

export async function submitReview(
  input: ReviewPayload,
  _now?: string,
): Promise<Result<{ review: Review; place: Place }>> {
  const parsed = reviewPayloadSchema.parse(input);
  const db = await userClient();
  let uid: string;
  try {
    uid = await requireKakao(db);
  } catch {
    return fail("login required");
  }
  const { data, error } = await db
    .from("reviews")
    .insert({ place_id: parsed.placeId, author_id: uid, rating: parsed.rating, text: parsed.text })
    .select("id")
    .single();
  if (error) return fail(error.code === "23505" ? "already reviewed" : failFromDb(error));
  const [review, place] = await Promise.all([reviewById(db, data.id), placeOrFail(db, parsed.placeId)]);
  if (!review || !place.ok) return fail("place not found");
  return okay({ review, place: place.value });
}

export async function updateReview(reviewId: string, patch: ReviewPatch, _now?: string): Promise<Result<Review>> {
  const id = idSchema.parse(reviewId);
  const changes = reviewPatchSchema.parse(patch);
  const db = await userClient();
  try {
    await requireKakao(db);
  } catch {
    return fail("login required");
  }
  const { data, error } = await db
    .from("reviews")
    .update({ rating: changes.rating, text: changes.text, edited_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error || data.length === 0) return fail("forbidden");
  const review = await reviewById(db, id);
  return review ? okay(review) : fail("forbidden");
}

export async function deleteReview(reviewId: string): Promise<Result<void>> {
  const id = idSchema.parse(reviewId);
  const db = await userClient();
  const { data, error } = await db
    .from("reviews")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error || data.length === 0) return fail("forbidden");
  return okay(undefined);
}

/* ══════════════════════════════════════════════════════════════════════════
 * 관리자 (spec 4.5) — RLS의 is_admin 정책이 진짜 게이트. 여기서는 오류를 코드로 옮길 뿐.
 * ════════════════════════════════════════════════════════════════════════ */

const reportRowSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["place_flag", "place_report", "photo_report", "owner_request"]),
  place_id: z.uuid(),
  photo_id: z.uuid().nullable(),
  reason: z.string().nullable(),
  owner_kind: z.enum(["edit", "remove"]).nullable(),
  contact: z.string().nullable(),
  message: z.string().nullable(),
  actor: z.uuid().nullable(),
  status: z.enum(["open", "done", "dismissed"]),
  created_at: z.string(),
});

function toReport(input: unknown): Report {
  const r = reportRowSchema.parse(input);
  return {
    id: r.id,
    kind: r.kind,
    placeId: r.place_id,
    at: r.created_at,
    status: r.status,
    ...(r.photo_id !== null && { photoId: r.photo_id }),
    ...(r.reason !== null && { reason: r.reason }),
    ...(r.owner_kind !== null && { ownerKind: r.owner_kind }),
    ...(r.contact !== null && { contact: r.contact }),
    ...(r.message !== null && { message: r.message }),
    ...(r.actor !== null && { actor: r.actor }),
  };
}

function sinceIso(filter: AdminListFilter): string | null {
  if (filter.sinceDays === undefined || filter.sinceDays === null) return null;
  const base = filter.now === undefined ? Date.now() : new Date(filter.now).getTime();
  return new Date(base - filter.sinceDays * 86_400_000).toISOString();
}

export async function getReports(
  filter: AdminListFilter & { kind?: ReportKind; status?: ReportStatus } = {},
): Promise<Report[]> {
  const db = await userClient();
  let q = db
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? ADMIN_PAGE_SIZE);
  if (filter.kind) q = q.eq("kind", filter.kind);
  if (filter.status) q = q.eq("status", filter.status);
  const since = sinceIso(filter);
  if (since) q = q.gte("created_at", since);
  const { data, error } = await q;
  if (error) throw new Error("forbidden");
  return data.map(toReport);
}

export async function resolveReport(id: string, status: ReportStatus): Promise<Result<Report>> {
  const parsed = resolveReportSchema.parse({ id, status });
  const db = await userClient();
  const { data, error } = await db
    .from("reports")
    .update({ status: parsed.status, resolved_at: parsed.status === "open" ? null : new Date().toISOString() })
    .eq("id", parsed.id)
    .select("*")
    .maybeSingle();
  if (error || !data) return fail("forbidden");
  return okay(toReport(data));
}

/** 관리자가 보는 사진(내린 것 제외) — 신고·검색 탭의 [사진 내리기]·썸네일용 */
async function adminPhotos(db: Db, placeIds: readonly string[]): Promise<Map<string, Photo[]>> {
  const map = new Map<string, Photo[]>();
  if (placeIds.length === 0) return map;
  const { data, error } = await db
    .from("photos")
    .select("id, place_id, key, created_at, uploader_id")
    .in("place_id", [...placeIds])
    .is("removed_at", null)
    .order("created_at", { ascending: true });
  if (error) return map;
  for (const raw of data) {
    const { placeId, ...photo } = toPhoto(raw);
    const list = map.get(placeId) ?? [];
    list.push(photo);
    map.set(placeId, list);
  }
  return map;
}

async function adminPlaceWithPhotos(db: Db, id: string): Promise<Result<Place>> {
  const [{ data: rows, error }, photos] = await Promise.all([db.rpc("admin_places"), adminPhotos(db, [id])]);
  if (error) return fail("forbidden");
  const row = rows.find((r) => r.id === id);
  if (!row) return fail("place not found");
  return okay(toAdminPlace(row, photos.get(id) ?? []));
}

/** 사후 확인 — 배지만 찍는다. "새로 제보됨"(is_new)은 건드리지 않는다. */
export async function confirmPlace(placeId: string, _now?: string): Promise<Result<Place>> {
  const id = idSchema.parse(placeId);
  const db = await userClient();
  const { data, error } = await db
    .from("places")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error || data.length === 0) return fail("forbidden");
  return adminPlaceWithPhotos(db, id);
}

/** 숨김·복구 — 삭제가 아니다. 복구하면 removed_by_owner도 지운다. */
export async function setPlaceHidden(
  placeId: string,
  hidden: boolean,
  _now?: string,
  options: { byOwner?: boolean } = {},
): Promise<Result<Place>> {
  const id = idSchema.parse(placeId);
  const db = await userClient();
  const patch = hidden
    ? { hidden_at: new Date().toISOString(), ...(options.byOwner === true && { removed_by_owner: true }) }
    : { hidden_at: null, removed_by_owner: false };
  const { data, error } = await db.from("places").update(patch).eq("id", id).select("id");
  if (error || data.length === 0) return fail("forbidden");
  return adminPlaceWithPhotos(db, id);
}

export async function deletePlace(placeId: string, now?: string, byOwner = false): Promise<Result<Place>> {
  return setPlaceHidden(placeId, true, now, { byOwner });
}

/** 신고된 사진 내리기 — 사진만 빼고 가게는 그대로. */
export async function deletePlacePhoto(placeId: string, photoId: string): Promise<Result<Place>> {
  const place = idSchema.parse(placeId);
  const photo = idSchema.parse(photoId);
  const db = await userClient();
  const { data, error } = await db
    .from("photos")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", photo)
    .eq("place_id", place)
    .select("id");
  if (error || data.length === 0) return fail("forbidden");
  return adminPlaceWithPhotos(db, place);
}

const editMenuSchema = z.object({
  raw: z.string(),
  name: z.string(),
  price: z.number().nullable(),
  unit: z.enum(["kg", "g", "pan", "count", "size", "serving", "none"]),
  unit_raw: z.string().nullable(),
});

const editRowSchema = z.object({
  id: z.uuid(),
  place_id: z.uuid(),
  actor: z.uuid().nullable(),
  field: z.enum(["hours", "address", "menus", "sides"]),
  before: z.object({
    hoursNote: z.string().nullable(),
    addressRoad: z.string().nullable(),
    menus: z.array(editMenuSchema),
    sides: z.array(z.string()),
  }),
  at: z.string(),
});

function toEdit(input: unknown): PlaceEdit {
  const e = editRowSchema.parse(input);
  return {
    id: e.id,
    placeId: e.place_id,
    at: e.at,
    field: e.field,
    before: {
      hoursNote: e.before.hoursNote,
      addressRoad: e.before.addressRoad,
      menus: e.before.menus,
      sides: {
        headButter: e.before.sides.includes("headButter"),
        ramen: e.before.sides.includes("ramen"),
        friedRice: e.before.sides.includes("friedRice"),
      },
    },
    ...(e.actor !== null && { actor: e.actor }),
  };
}

export async function getPlaceEdits(filter: AdminListFilter = {}): Promise<PlaceEdit[]> {
  const db = await userClient();
  let q = db
    .from("place_edits")
    .select("*")
    .order("at", { ascending: false })
    .limit(filter.limit ?? ADMIN_PAGE_SIZE);
  const since = sinceIso(filter);
  if (since) q = q.gte("at", since);
  const { data, error } = await q;
  if (error) throw new Error("forbidden");
  return data.map(toEdit);
}

/** 되돌리기 — before를 그대로 덮는다. 트리거가 이 변경도 이력에 남기므로 다시 되돌릴 수 있다(대칭). */
export async function revertPlaceEdit(editId: string, _now?: string): Promise<Result<Place>> {
  const id = idSchema.parse(editId);
  const db = await userClient();
  const { data: row, error } = await db.from("place_edits").select("*").eq("id", id).maybeSingle();
  if (error || !row) return fail("forbidden");
  const edit = editRowSchema.parse(row);
  const { data: updated, error: updateError } = await db
    .from("places")
    .update({
      hours_note: edit.before.hoursNote,
      address_road: edit.before.addressRoad,
      menus: edit.before.menus,
      sides: edit.before.sides,
    })
    .eq("id", edit.place_id)
    .select("id");
  if (updateError || updated.length === 0) return fail("forbidden");
  return adminPlaceWithPhotos(db, edit.place_id);
}

/** 관리자 목록 — 숨긴 가게·검수 대기·병합 포함(공개 열 밖의 상태까지). */
export async function getPlacesForAdmin(_now?: string): Promise<Place[]> {
  const db = await userClient();
  const { data, error } = await db.rpc("admin_places", { p_limit: 500 });
  if (error) throw new Error("forbidden");
  const photos = await adminPhotos(
    db,
    data.map((r) => r.id),
  );
  return data.map((r) => toAdminPlace(r, photos.get(r.id) ?? []));
}

export async function searchPlacesForAdmin(query: string, _now?: string): Promise<Place[]> {
  const q = normalizeQuery(query);
  if (q === "") return [];
  const db = await userClient();
  const { data, error } = await db.rpc("admin_places", { p_query: q, p_limit: ADMIN_PAGE_SIZE });
  if (error) throw new Error("forbidden");
  const photos = await adminPhotos(
    db,
    data.map((r) => r.id),
  );
  return data.map((r) => toAdminPlace(r, photos.get(r.id) ?? []));
}

const adminStatsSchema = z.object({
  openReports: z.number(),
  unverified: z.number(),
  daily: z.array(
    z.object({ day: z.string(), reports: z.number(), checkins: z.number(), reviews: z.number(), edits: z.number() }),
  ),
  participants: z.object({ anonymous: z.number(), kakao: z.number() }),
  topPlaces: z.array(z.object({ placeId: z.string(), name: z.string(), checkCount: z.number() })),
});

export async function getAdminStats(_now?: string): Promise<AdminStats> {
  const db = await userClient();
  const { data, error } = await db.rpc("admin_stats");
  if (error) throw new Error("forbidden");
  const s = adminStatsSchema.parse(data);
  const daily: AdminDayCount[] = s.daily.map((d) => ({
    date: formatKstDate(`${d.day}T00:00:00+09:00`),
    reports: d.reports,
    checkins: d.checkins,
    reviews: d.reviews,
    edits: d.edits,
  }));
  const today = daily.at(-1) ?? { date: formatKstDate(Date.now()), reports: 0, checkins: 0, reviews: 0, edits: 0 };
  return {
    openReports: s.openReports,
    unverified: s.unverified,
    today,
    daily,
    participants: s.participants,
    topPlaces: s.topPlaces,
  };
}
