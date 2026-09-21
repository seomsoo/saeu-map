"use server";

/**
 * 서버 액션 — 컴포넌트가 lib/data.ts를 통해 부르는 모든 읽기·쓰기의 서버 쪽.
 * 규칙: 검증(zod) → 행위자(세션)를 **첫 await 전에** → 쓰기 → 결과. 쓰기는 예상되는 실패를 값(`Result`)으로 돌려준다 —
 * 프로덕션의 Next는 액션이 던진 오류 메시지를 지우기 때문에("already reviewed" 같은 분기가 클라이언트에 못 간다).
 * lib/data.ts가 실패 값을 다시 throw로 바꿔 컴포넌트 계약(throw + 토스트)을 유지한다.
 * 속도 제한·섀도 밴·사진 상한은 DB(RLS·트리거·RPC)가 마지막으로 막는다 — 여기서는 그 오류를 코드로 옮길 뿐이다.
 */
import { unstable_cache, updateTag } from "next/cache";
import { cache } from "react";
import { z } from "zod";
import type { Json } from "@/lib/db/database.types";
import { env } from "@/lib/env";
import { guOfPoint } from "@/lib/gu";
import { applyMenuEdits, toMenu } from "@/lib/menu-edits";
import { placePhotoKey, reviewPhotoKey } from "@/lib/photo-key";
import { sameOriginPath } from "@/lib/safe-next";
import { PEEL_SLUGS } from "@/lib/peel-test";
import { matchesQuery, normalizeQuery } from "@/lib/places";
import {
  ADMIN_PAGE_SIZE,
  type AdminListFilter,
  MAX_PLACE_PHOTOS,
  REPORT_ATTENTION_COUNT,
  idSchema,
  nicknameSchema,
  type OwnerRequestInput,
  ownerRequestSchema,
  type PhotoReportReason,
  type PlaceFilter,
  photoReportSchema,
  photoUploadSchema,
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
import { notifyAdmin } from "./notify";
import { reportError } from "./observe";
import { TAG_PLACES, TAG_SEASON, expirePlace, placeTag } from "./cache-tags";
import { deletePhotoObject, forgetPhotoObjects, photoKeys, storePhoto } from "./photos";
import { isNewPlace, toAdminPlace, toPhoto, toPlace, toReview, toSides } from "./rows";
import { ensureUser, readSession, requireKakao, VISITOR } from "./session";
import { adminClient, anonClient, type Db, userClient } from "./supabase";
import { ipHashedClient, isReadOnly, openWriteGate } from "./write-gate";

/** 쓰기 실패 — 컴포넌트가 분기하는 코드만. 그 밖은 throw(generic). */
export type FailCode =
  | "login required"
  | "already reviewed"
  | "already checked"
  | "rate limited"
  | "place not found"
  | "photo limit reached"
  | "forbidden"
  | "outside korea"
  | "read only"
  | "bot check failed"
  | "session changed"
  | "not image";
export type Result<T> = { ok: true; value: T } | { ok: false; error: FailCode };
const fail = (error: FailCode): Result<never> => ({ ok: false, error });
const okay = <T>(value: T): Result<T> => ({ ok: true, value });

/**
 * Postgres 오류 코드 → 실패 코드. RPC의 raise·유니크·RLS가 여기로 온다.
 * 42501(RLS with check 거부)은 "가게가 안 보인다"와 "속도 제한"을 구분해 주지 않는다 — 화면은 보이는 가게만 내놓으므로
 * 실제로는 제한이다. 호출부마다 다르게 읽던 것을 여기로 모았다(코드 리뷰 2026-09-16 #10). 화면은 아직 둘을 가르지 않는다.
 */
function failFromDb(error: { code?: string } | null): FailCode {
  switch (error?.code) {
    case "23505":
      return "already checked";
    case "P0003":
    case "42501":
      return "rate limited";
    case "P0002":
    case "23503":
      return "place not found";
    case "23514":
      return "photo limit reached";
    default:
      return "forbidden";
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * 읽기 — 공개 데이터는 anon 클라이언트(쿠키 없음, 빌드 시에도 돈다), 내 것은 세션 클라이언트. RLS가 숨긴 가게를 거른다
 * ════════════════════════════════════════════════════════════════════════ */

/* 캐시 태그는 ./cache-tags — 액션과 auth 콜백이 같이 쓴다 */

/**
 * `next build` 중(OG 카드 generateStaticParams·렌더)에는 캐시를 거치지 않는다. 빌드가 만든 unstable_cache 엔트리는
 * `.next/cache/fetch-cache`에 남아 다음 빌드에 재사용되고 populateCache가 R2에 새 시각으로 실어 보내서,
 * 그 뒤 updateTag가 만료해도 "새 엔트리"로 읽혔다(workerd 실측 2026-09-10 — 확인 2회가 1회로). 런타임 캐시는 첫 요청에 채운다.
 */
const BUILDING = process.env["NEXT_PHASE"] === "phase-production-build";
function cachedUnlessBuilding<T>(fn: () => Promise<T>, keys: string[], tags: string[]): () => Promise<T> {
  return BUILDING ? fn : unstable_cache(fn, keys, { tags });
}

/** 쓰기 직후 캐시 만료 — 서버 액션 안이라 updateTag(읽기-자기-쓰기: 다음 요청이 새 값을 기다린다) */

/**
 * 핀 목록 전체 — 한 번 캐시하고(R2, 태그 places) 필터는 메모리에서. 공개 읽기라 세션·쿠키 없음(빌드 시에도 돈다).
 * **캐시에는 zod를 지난 Place[]를 넣는다** — 요청마다 789곳을 다시 검증하면 그것만 2.5ms다(503의 원인은 아니었다 — decisions 2026-09-18 정정)
 * (프리뷰에서 "Worker exceeded resource limits" 503, 2026-09-17). NEW 배지만 읽을 때 다시 찍는다.
 */
const cachedAllPlaces = cachedUnlessBuilding(
  async (): Promise<Place[]> => {
    const db = anonClient();
    const rows: unknown[] = [];
    // PostgREST max_rows(기본 1000) — 다 받을 때까지 페이지를 넘긴다
    const page = 1000;
    for (let from = 0; ; from += page) {
      const { data, error } = await db
        .from("places_public")
        .select("*")
        .order("created_at", { ascending: true })
        .range(from, from + page - 1);
      if (error) throw new Error("places unavailable");
      rows.push(...data);
      if (data.length < page) break;
    }
    return rows.map((row) => toPlace(row));
  },
  ["places-all"],
  [TAG_PLACES],
);

export async function getPlaces(filter: PlaceFilter = {}, now: string = new Date().toISOString()): Promise<Place[]> {
  const query = normalizeQuery(filter.query ?? "");
  return (await cachedAllPlaces())
    .map((place) => ({ ...place, isNew: isNewPlace(place, now) })) // 7일 NEW 배지는 읽을 때 — 캐시 채울 때 얼어붙지 않게(코드 리뷰 #3)
    .filter((p) => {
      if (filter.tag && !p.tags.includes(filter.tag)) return false;
      if (filter.gu && p.gu !== filter.gu) return false;
      if (filter.isNew !== undefined && p.isNew !== filter.isNew) return false;
      return matchesQuery(p, query);
    });
}

/** 가게 + 리뷰 — 가게마다 태그 place:<id>. zod는 캐시 채울 때 한 번(위와 같은 이유) */
function cachedDetailRows(id: string) {
  return cachedUnlessBuilding(
    async (): Promise<{ place: Place; reviews: Review[] }> => {
      const db = anonClient();
      const [placeRes, reviewRes] = await Promise.all([
        db.from("places_public").select("*").eq("id", id).maybeSingle(),
        db.from("reviews_public").select("*").eq("place_id", id).order("created_at", { ascending: false }),
      ]);
      if (placeRes.error || reviewRes.error) throw new Error("place unavailable");
      // 없는 id는 던져서 캐시에 남기지 않는다 — 임의 uuid 스캔이 R2·D1 항목을 만들지 않게(최종 보안 리뷰 #7)
      if (!placeRes.data) throw new Error(PLACE_MISSING);
      return { place: toPlace(placeRes.data), reviews: reviewRes.data.map(toReview) };
    },
    ["place-detail", id],
    [TAG_PLACES, placeTag(id)],
  );
}
const PLACE_MISSING = "place missing";

/** 상세 원본 — 요청 안에서는 한 번만(generateMetadata + 페이지가 같은 id를 묻는다) */
const detailRows = cache(async (id: string): Promise<{ place: Place; reviews: Review[] } | undefined> => {
  if (!idSchema.safeParse(id).success) return undefined;
  try {
    return await cachedDetailRows(id)();
  } catch (e) {
    if (e instanceof Error && e.message === PLACE_MISSING) return undefined;
    throw e;
  }
});

export async function getPlaceById(id: string, now: string = new Date().toISOString()): Promise<Place | undefined> {
  const rows = await detailRows(id);
  return rows ? { ...rows.place, isNew: isNewPlace(rows.place, now) } : undefined;
}

/** 상세 화면 데이터: 가게 + 리뷰(최신순). 없는 id·uuid 아님은 undefined. */
export async function getPlaceDetail(id: string, now: string = new Date().toISOString()): Promise<PlaceDetail | undefined> {
  const rows = await detailRows(id);
  return rows ? { place: { ...rows.place, isNew: isNewPlace(rows.place, now) }, reviews: rows.reviews } : undefined;
}

const seasonStatsSchema = z.object({
  todayCheckinCount: z.number(),
  weekPlaceCount: z.number(),
  newPlaceCount: z.number(),
  topPlace: z.object({ id: z.string(), name: z.string(), count: z.number() }).nullable(),
});

/** 합쳐진 옛 가게 → 새 가게 id (/place/[old] 영구 리다이렉트, spec 4.3 엣지). 아니면 null. 404 경로에서 한 번만 부르니 캐시하지 않는다. */
const mergedTarget = cache(async (id: string): Promise<string | null> => {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return null;
  const { data } = await anonClient().rpc("merge_target", { p_id: parsed.data });
  return typeof data === "string" ? data : null;
});
export async function getMergedPlaceTarget(id: string): Promise<string | null> {
  return mergedTarget(id);
}

/** 시즌 카운터 — KST 날짜가 키에 들어 자정·월요일에 자연히 넘어간다(시간 기반 만료가 없으므로, 코드 리뷰 #4) */
function cachedSeasonStats(day: string) {
  return cachedUnlessBuilding(
  async (): Promise<unknown> => {
    const { data, error } = await anonClient().rpc("season_stats");
    if (error) throw new Error("stats unavailable");
    return data;
  },
  ["season-stats", day],
  [TAG_SEASON],
  );
}

export async function getSeasonStats(now?: string): Promise<SeasonStats> {
  return seasonStatsSchema.parse(await cachedSeasonStats(formatKstDate(now === undefined ? Date.now() : Date.parse(now)))());
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
export async function getMyReports(now?: string): Promise<Place[]> {
  const db = await userClient();
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims.sub) return [];
  const { data, error } = await db.rpc("my_reports");
  if (error) throw new Error("reports unavailable");
  return data.map((row) => toPlace(row, now));
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
export async function signInWithKakao(next: string): Promise<Result<string>> {
  if (isReadOnly()) return fail("read only");
  const site = siteUrl(env.SITE_URL);
  const db = await userClient();
  const redirectTo = new URL("/auth/callback", site);
  redirectTo.searchParams.set("next", sameOriginPath(next, site.origin));
  const { data, error } = await db.auth.signInWithOAuth({
    provider: "kakao",
    options: { redirectTo: redirectTo.toString(), skipBrowserRedirect: true },
  });
  if (error || !data.url) return fail("forbidden");
  return okay(data.url);
}

/** 로그아웃 — 세션 쿠키를 지운다. 방문자로 돌아간다(다음 쓰기에서 새 익명). */
export async function signOut(): Promise<Session> {
  const db = await userClient();
  await db.auth.signOut();
  return VISITOR;
}

/** 탈퇴 (spec 5) — 카카오만. 개인 데이터 삭제는 secret key RPC(admin_delete_user)가 한 트랜잭션으로. */
export async function deleteAccount(turnstile: string, actor: string | null = null): Promise<Result<Session>> {
  const gate = await openWriteGate(turnstile, actor);
  if ("failure" in gate) return fail(gate.failure);
  const { db } = gate;
  let uid: string;
  try {
    uid = await requireKakao(db);
  } catch {
    return fail("login required");
  }
  if (env.SUPABASE_SECRET_KEY === undefined) return fail("forbidden");
  // 리뷰 사진의 R2 객체는 RPC가 키를 비우기 전에 읽어 둔다 — 행만 지우면 URL을 아는 사람에겐 사진이 남는다(spec 5 "완전 삭제").
  // 합치기·승계로 이미 소프트 삭제된 리뷰는 사용자 클라이언트(RLS)가 못 보므로 secret key로 읽는다(최종 보안 리뷰 #4)
  const admin = adminClient();
  const { data: keyed } = await admin.from("reviews").select("place_id, photo_key").eq("author_id", uid);
  const { error } = await admin.rpc("admin_delete_user", { p_uid: uid });
  if (error) return fail("forbidden");
  for (const r of new Set((keyed ?? []).map((r) => r.place_id))) expirePlace(r); // 평점·리뷰 목록이 상세·핀 캐시에 있다(코드 리뷰 #6)
  await forgetPhotoObjects(photoKeys(keyed ?? []));
  await db.auth.signOut();
  return okay(VISITOR);
}


export async function updateNickname(
  nickname: string,
  turnstile: string,
  actor: string | null = null,
): Promise<Result<Session>> {
  const next = nicknameSchema.parse(nickname);
  const gate = await openWriteGate(turnstile, actor);
  if ("failure" in gate) return fail(gate.failure);
  const { db } = gate;
  let uid: string;
  try {
    uid = await requireKakao(db);
  } catch {
    return fail("login required");
  }
  const { error } = await db.from("profiles").update({ nickname: next }).eq("id", uid);
  if (error) return fail("forbidden");
  const { data: mine } = await db.from("reviews").select("place_id").eq("author_id", uid);
  for (const id of new Set((mine ?? []).map((r) => r.place_id))) expirePlace(id); // 리뷰 옆 닉네임은 상세 캐시 안에 있다
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
export async function checkIn(
  placeId: string,
  turnstile: string,
  _now?: string,
  actor: string | null = null,
): Promise<Result<Place>> {
  const id = idSchema.parse(placeId);
  const gate = await openWriteGate(turnstile, actor);
  if ("failure" in gate) return fail(gate.failure);
  const { db } = gate;
  const uid = await ensureUser(db);
  const { error } = await db.from("checkins").insert({ place_id: id, actor: uid, type: "visited" });
  if (error) return fail(failFromDb(error));
  expirePlace(id);
  return placeOrFail(db, id);
}

/** 찜 설정 — 원하는 상태를 받는다(멱등). 현재 찜 목록을 돌려준다. */
export async function setBookmark(
  placeId: string,
  bookmarked: boolean,
  turnstile: string,
  actor: string | null = null,
): Promise<Result<string[]>> {
  const id = idSchema.parse(placeId);
  const gate = await openWriteGate(turnstile, actor);
  if ("failure" in gate) return fail(gate.failure);
  const { db } = gate;
  const userId = await ensureUser(db);
  // ON CONFLICT DO NOTHING — DO UPDATE는 UPDATE 권한이 필요한데 bookmarks에는 insert·delete만 열어 뒀다(멱등은 이걸로 충분)
  const { error } = bookmarked
    ? await db
        .from("bookmarks")
        .upsert({ user_id: userId, place_id: id }, { onConflict: "user_id,place_id", ignoreDuplicates: true })
    : await db.from("bookmarks").delete().eq("user_id", userId).eq("place_id", id);
  if (error) return fail(failFromDb(error));
  const { data, error: listError } = await db.from("bookmarks").select("place_id");
  if (listError) return fail("forbidden");
  return okay(data.map((r) => r.place_id));
}

/** 제보 등록 (spec 4.3). 구는 좌표로 판정하고 한국 밖(바다)이면 거부. 사진은 별도 업로드. 시간당 5은 RPC가 센다. */
export async function submitReport(
  input: ReportPayload,
  turnstile: string,
  _now?: string,
  actor: string | null = null,
): Promise<Result<Place>> {
  const report = reportPayloadSchema.parse(input);
  const gu = await guOfPoint(report);
  if (gu === null) return fail("outside korea");
  const gate = await openWriteGate(turnstile, actor);
  if ("failure" in gate) return fail(gate.failure);
  const { db } = gate;
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
  updateTag(TAG_PLACES);
  updateTag(TAG_SEASON);
  const created = await placeOrFail(db, id);
  // 섀도 밴이면 숨긴 채 만들어져 RLS로 못 읽는다 — 성공한 척 입력값으로 그리고 알림은 보내지 않는다(최종 보안 리뷰 #2)
  if (!created.ok) return okay(placeFromReport(id, report, gu, tags, sides));
  await notifyAdmin({ kind: "report", placeId: id, name: report.name, gu, duplicateSuspect: report.duplicateOf !== null });
  return created;
}

/** 섀도 밴 사용자에게 보여 줄 "방금 등록한 가게" — DB엔 숨긴 채 있다(성공한 척, spec 5) */
function placeFromReport(id: string, report: ReportPayload, gu: string, tags: Place["tags"], sides: string[]): Place {
  const now = new Date().toISOString();
  return {
    id,
    name: report.name,
    gu,
    addressRoad: null,
    addressJibun: null,
    lat: report.lat,
    lng: report.lng,
    nearestStation: null,
    tags,
    specialist: false,
    naverPlaceUrl: report.naverPlaceUrl === "" ? null : report.naverPlaceUrl,
    photos: [],
    thumbnailUrl: null,
    hoursNote: report.hoursNote === "" ? null : report.hoursNote,
    menus: report.menus.map(toMenu),
    sides: toSides(sides),
    source: "report",
    needsReview: false,
    lastCheckedAt: now,
    checkCount: 0,
    isNew: true,
    createdAt: now,
  };
}

/** 값 제안 — 즉시 반영 + 이력(DB 트리거). 메뉴는 현재 줄에 편집을 적용한 전체를 보낸다. */
export async function submitSuggestion(
  input: SuggestionInput,
  turnstile: string,
  _now?: string,
  actor: string | null = null,
): Promise<Result<Place>> {
  const parsed = suggestionSchema.parse(input);
  const gate = await openWriteGate(turnstile, actor);
  if ("failure" in gate) return fail(gate.failure);
  const { db } = gate;
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
  expirePlace(parsed.placeId);
  return placeOrFail(db, parsed.placeId);
}

async function insertReport(
  turnstile: string,
  actor: string | null,
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
  const gate = await openWriteGate(turnstile, actor);
  if ("failure" in gate) return fail(gate.failure);
  const { db } = gate;
  const uid = await ensureUser(db);
  const { data, error } = await db.from("reports").insert({ ...row, actor: uid }).select("id");
  if (error) return fail(failFromDb(error));
  if (data.length === 0) return okay(undefined); // 섀도 밴 — 트리거가 행을 버렸다. 알림도 없이 성공한 척(최종 보안 리뷰 #2)
  await alertReport(db, row);
  return okay(undefined);
}

/**
 * 신고·요청 알림 — 상호는 공개 뷰에서 읽고 연락처·내용 같은 개인정보는 싣지 않는다.
 * 가게 신고(정보 달라요 포함)가 REPORT_ATTENTION_COUNT째 열려 있으면 누적 알림도 — 신고 표는 관리자만 읽으니 secret key로 센다(없으면 건너뛴다).
 */
async function alertReport(
  db: Db,
  row: { kind: ReportKind; place_id: string; reason?: string; owner_kind?: "edit" | "remove" },
): Promise<void> {
  const { data: place } = await db.from("places_public").select("name").eq("id", row.place_id).maybeSingle();
  const name = place?.name ?? "(가게)";
  if (row.kind === "owner_request") {
    await notifyAdmin({ kind: "owner_request", placeId: row.place_id, name, ownerKind: row.owner_kind ?? "edit" });
    return;
  }
  await notifyAdmin({ kind: row.kind, placeId: row.place_id, name, reason: row.reason ?? "" });
  if (env.SUPABASE_SECRET_KEY === undefined) return;
  const { count } = await adminClient()
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("place_id", row.place_id)
    .eq("status", "open")
    .eq("kind", "place_report"); // 관리자 신고 탭의 "신고 N건" 배지와 같은 술어(코드 리뷰 #18)
  if (count === REPORT_ATTENTION_COUNT) await notifyAdmin({ kind: "attention", placeId: row.place_id, name, count });
}

export async function reportPhoto(
  input: { placeId: string; photoId: string; reason: PhotoReportReason },
  turnstile: string,
  actor: string | null = null,
): Promise<Result<void>> {
  const parsed = photoReportSchema.parse(input);
  return insertReport(turnstile, actor, {
    kind: "photo_report",
    place_id: parsed.placeId,
    photo_id: parsed.photoId,
    reason: parsed.reason,
  });
}

export async function flagPlace(
  input: { placeId: string; reason: PlaceFlagReason },
  turnstile: string,
  actor: string | null = null,
): Promise<Result<void>> {
  const parsed = placeFlagSchema.parse(input);
  return insertReport(turnstile, actor, { kind: "place_flag", place_id: parsed.placeId, reason: parsed.reason });
}

export async function reportPlace(
  input: { placeId: string; reason: PlaceReportReason },
  turnstile: string,
  actor: string | null = null,
): Promise<Result<void>> {
  const parsed = placeReportSchema.parse(input);
  return insertReport(turnstile, actor, { kind: "place_report", place_id: parsed.placeId, reason: parsed.reason });
}

export async function submitOwnerRequest(
  input: OwnerRequestInput,
  turnstile: string,
  actor: string | null = null,
): Promise<Result<void>> {
  const parsed = ownerRequestSchema.parse(input);
  return insertReport(turnstile, actor, {
    kind: "owner_request",
    place_id: parsed.placeId,
    owner_kind: parsed.kind,
    contact: parsed.contact,
    message: parsed.message,
  });
}

/* ══════════════════════════════════════════════════════════════════════════
 * 사진 (spec 4.2-1 — 즉시 반영, 가게당 10장, 1200px webp 재인코딩)
 * ════════════════════════════════════════════════════════════════════════ */

/** FormData의 문자열 필드만 — 파일이 들어오면 빈 문자열(문에서 거부된다) */
function formString(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * 사진 올리기 — FormData(placeId · turnstile · photos[]). 파일은 액션 인자로 직렬화되지 않아 FormData다.
 * 남은 자리보다 많이 고르면 앞에서부터 채운다. 10장 상한·가게당 시간 10장·월 4,500장은 DB(트리거·RLS)가 마지막으로 막는다.
 * 저장은 R2 put → photos 행 순서고, 행이 거부되면 객체를 지운다(고아 객체 없음).
 */
export async function addPlacePhotos(form: FormData): Promise<Result<Place>> {
  const parsed = photoUploadSchema.parse({ placeId: form.get("placeId"), files: form.getAll("photos") });
  const gate = await openWriteGate(formString(form, "turnstile"), formString(form, "actor") || null);
  if ("failure" in gate) return fail(gate.failure);
  const { db } = gate;
  const uploader = await ensureUser(db);
  const current = await placeOrFail(db, parsed.placeId);
  if (!current.ok) return current;
  const room = MAX_PLACE_PHOTOS - current.value.photos.length;
  if (room <= 0) return fail("photo limit reached");
  // 변환(Images 무료 5,000장/월) 전에 자리를 묻는다 — 정책이 거부할 업로드를 변환부터 하면 한도만 탄다(security-reviewer 2026-09-16 #7). 섀도 밴도 여기서 걸린다
  const { data: slot } = await db.rpc("photo_slot_ok", { p_place: parsed.placeId });
  if (slot !== true) return fail("rate limited");
  let stored = 0;
  for (const file of parsed.files.slice(0, room)) {
    const photoId = crypto.randomUUID();
    const key = placePhotoKey(parsed.placeId, photoId);
    const result = await storePhoto(file, key);
    if (result === "not-image") {
      if (stored === 0) return fail("not image");
      break;
    }
    const { data, error } = await db
      .from("photos")
      .insert({ id: photoId, place_id: parsed.placeId, key, uploader_id: uploader })
      .select("id");
    if (error) {
      await deletePhotoObject(key);
      if (stored === 0) return fail(failFromDb(error));
      break; // 몇 장은 들어갔다 — 그만큼만 반영
    }
    if (data.length === 0) {
      // 섀도 밴 — 트리거가 행을 버렸다. 객체를 남기면 고아(Codex PR #16 #2). photo_slot_ok가 먼저 막으니 여기는 마지막 방어선
      await deletePhotoObject(key);
      break;
    }
    stored += 1;
  }
  expirePlace(parsed.placeId);
  return placeOrFail(db, parsed.placeId);
}

/**
 * 리뷰 사진 붙이기 — 등록 직후 한 장(FormData: reviewId · turnstile · photo). 본인 리뷰만(RLS), **교체는 없다**(트리거 reviews_photo_once —
 * 바꿔치기가 되면 옛 객체가 고아로 쌓이고 변환 한도를 무한히 탄다, security-reviewer 2026-09-16 #6). 변환 전에 사진 자리(속도·월 상한)를 묻는다.
 */
export async function attachReviewPhoto(form: FormData): Promise<Result<Review>> {
  const reviewId = idSchema.parse(form.get("reviewId"));
  const photo = form.get("photo");
  if (!(photo instanceof File)) return fail("not image");
  const gate = await openWriteGate(formString(form, "turnstile"), formString(form, "actor") || null);
  if ("failure" in gate) return fail(gate.failure);
  const { db } = gate;
  let uid: string;
  try {
    uid = await requireKakao(db);
  } catch {
    return fail("login required");
  }
  const { data: target } = await db.from("reviews").select("photo_key").eq("id", reviewId).eq("author_id", uid).maybeSingle();
  if (!target) return fail("forbidden");
  if (target.photo_key !== null) return fail("photo limit reached");
  const { data: slot } = await db.rpc("photo_slot_ok");
  if (slot !== true) return fail("rate limited");
  const key = reviewPhotoKey(reviewId, crypto.randomUUID());
  if ((await storePhoto(photo, key)) === "not-image") return fail("not image");
  const { data, error } = await db
    .from("reviews")
    .update({ photo_key: key })
    .eq("id", reviewId)
    .is("photo_key", null)
    .select("id, place_id");
  if (error || data.length === 0) {
    await forgetPhotoObjects([key]);
    return fail(error ? failFromDb(error) : "forbidden");
  }
  for (const row of data) expirePlace(row.place_id);
  const review = await reviewById(db, reviewId);
  return review ? okay(review) : fail("forbidden");
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
  turnstile: string,
  _now?: string,
  actor: string | null = null,
): Promise<Result<{ review: Review; place: Place }>> {
  const parsed = reviewPayloadSchema.parse(input);
  const gate = await openWriteGate(turnstile, actor);
  if ("failure" in gate) return fail(gate.failure);
  const { db } = gate;
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
    .maybeSingle();
  if (error) return fail(error.code === "23505" ? "already reviewed" : failFromDb(error));
  expirePlace(parsed.placeId);
  const place = await placeOrFail(db, parsed.placeId);
  if (!place.ok) return place;
  if (data === null) {
    // 섀도 밴 — 트리거가 행을 버렸다. 성공한 척 입력값으로 그린다(최종 보안 리뷰 #2)
    const session = await readSession(db);
    const review: Review = {
      id: crypto.randomUUID(),
      placeId: parsed.placeId,
      authorId: uid,
      rating: parsed.rating,
      text: parsed.text,
      nickname: session.nickname ?? "",
      at: new Date().toISOString(),
    };
    return okay({ review, place: place.value });
  }
  const review = await reviewById(db, data.id);
  if (!review) return fail("place not found");
  return okay({ review, place: place.value });
}

export async function updateReview(
  reviewId: string,
  patch: ReviewPatch,
  turnstile: string,
  _now?: string,
  actor: string | null = null,
): Promise<Result<Review>> {
  const id = idSchema.parse(reviewId);
  const changes = reviewPatchSchema.parse(patch);
  const gate = await openWriteGate(turnstile, actor);
  if ("failure" in gate) return fail(gate.failure);
  const { db } = gate;
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
  if (review) expirePlace(review.placeId);
  return review ? okay(review) : fail("forbidden");
}

export async function deleteReview(reviewId: string, turnstile: string, actor: string | null = null): Promise<Result<void>> {
  const id = idSchema.parse(reviewId);
  const gate = await openWriteGate(turnstile, actor);
  if ("failure" in gate) return fail(gate.failure);
  const { db } = gate;
  // RPC인 이유: PG 17은 UPDATE의 새 행도 SELECT 정책(deleted_at is null)을 통과해야 해서 작성자가 직접 deleted_at을 못 찍는다(pgTAP 실측 2026-09-16)
  const { data, error } = await db.rpc("delete_review", { p_id: id });
  if (error || data.length === 0) return fail("forbidden");
  for (const row of data) expirePlace(row.deleted_place_id);
  await forgetPhotoObjects(photoKeys(data.map((r) => ({ photo_key: r.deleted_photo_key })))); // 지운 리뷰의 사진은 URL로도 안 보여야 한다(#8)
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
  if (isReadOnly()) return fail("read only");
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
    .select("id, place_id, key, created_at")
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
  // 한 행은 p_id로 — 목록 200행에서 찾으면 등록일이 같은 시드는 순서가 임의라 빠진다(코드 리뷰 #1: 쓰기는 됐는데 "처리하지 못했어요")
  const [{ data: rows, error }, photos] = await Promise.all([
    db.rpc("admin_places", { p_id: id, p_limit: 1 }),
    adminPhotos(db, [id]),
  ]);
  if (error) return fail("forbidden");
  const row = rows[0];
  if (!row) return fail("place not found");
  return okay(toAdminPlace(row, photos.get(id) ?? []));
}

/** 사후 확인 — 배지만 찍는다. "새로 제보됨"(is_new)은 건드리지 않는다. */
export async function confirmPlace(placeId: string, _now?: string): Promise<Result<Place>> {
  const id = idSchema.parse(placeId);
  if (isReadOnly()) return fail("read only");
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
  if (isReadOnly()) return fail("read only");
  const db = await userClient();
  const patch = hidden
    ? { hidden_at: new Date().toISOString(), ...(options.byOwner === true && { removed_by_owner: true }) }
    : { hidden_at: null, removed_by_owner: false, needs_review: false }; // 복구 = 검수 끝(검색 탭 검수 필터에서 빠진다)
  if (!hidden) {
    // 합쳐진 가게는 숨김을 풀어도 RLS가 계속 감춘다(merged_into) — "정상"으로 보이는 거짓말을 막는다(코드 리뷰 #7)
    const { data: current } = await db.rpc("admin_places", { p_id: id, p_limit: 1 });
    if (current?.[0]?.merged_into) return fail("forbidden");
  }
  const { data, error } = await db.from("places").update(patch).eq("id", id).select("id");
  if (error || data.length === 0) return fail("forbidden");
  expirePlace(id);
  return adminPlaceWithPhotos(db, id);
}

export async function deletePlace(placeId: string, now?: string, byOwner = false): Promise<Result<Place>> {
  return setPlaceHidden(placeId, true, now, { byOwner });
}

/** 신고된 사진 내리기 — 사진만 빼고 가게는 그대로. R2 객체도 지운다(URL을 아는 사람에게 계속 보이면 내린 게 아니다, #8). 되돌리기 없음. */
export async function deletePlacePhoto(placeId: string, photoId: string): Promise<Result<Place>> {
  const place = idSchema.parse(placeId);
  if (isReadOnly()) return fail("read only");
  const photo = idSchema.parse(photoId);
  const db = await userClient();
  const { data, error } = await db
    .from("photos")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", photo)
    .eq("place_id", place)
    .select("id, key");
  if (error || data.length === 0) return fail("forbidden");
  await forgetPhotoObjects(data.map((r) => r.key));
  expirePlace(place);
  return adminPlaceWithPhotos(db, place);
}

/**
 * 합치기 — 옛 가게의 사진·확인·리뷰·찜·신고·이력을 새 가게로 옮기고 옛 가게는 숨긴다(RPC admin_merge_places). 되돌리기 없음.
 * `/place/[old]`는 merge_target으로 영구 리다이렉트(spec 4.3 엣지). 대상이 없거나 이미 합쳐진 가게면 "place not found".
 */
export async function mergePlaces(fromId: string, intoId: string): Promise<Result<Place>> {
  const from = idSchema.parse(fromId);
  const into = idSchema.parse(intoId);
  if (isReadOnly()) return fail("read only");
  const db = await userClient();
  const { data: freed, error } = await db.rpc("admin_merge_places", { p_from: from, p_into: into });
  if (error) return fail(error.code === "22023" ? "place not found" : "forbidden");
  expirePlace(from);
  expirePlace(into);
  // 돌려받는 키 = 양쪽에 남긴 같은 사람의 리뷰(원본 쪽 소프트 삭제, 최종 보안 리뷰 #4) + 10장을 넘겨 내린 가게 사진(Codex PR #16 #6) — 객체도 지운다
  await forgetPhotoObjects(photoKeys(freed.map((r) => ({ photo_key: r.freed_photo_key }))));
  return adminPlaceWithPhotos(db, into);
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
  if (isReadOnly()) return fail("read only");
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
  expirePlace(edit.place_id);
  return adminPlaceWithPhotos(db, edit.place_id);
}

/**
 * 관리자 목록 — 숨긴 가게·검수 대기·병합 포함(공개 열 밖의 상태까지). `needsReview`면 숨긴 채 임포트한 시드만(검색 탭 검수 필터).
 * 중복 의심 행에는 후보 상호를 붙인다(공개 뷰에서 — 후보가 숨겨졌으면 배지만 남는다).
 */
export async function getPlacesForAdmin(
  _now?: string,
  options: { needsReview?: boolean; ids?: readonly string[] } = {},
): Promise<Place[]> {
  const db = await userClient();
  if (options.ids !== undefined && options.ids.length === 0) return [];
  const { data, error } = await db.rpc("admin_places", {
    p_limit: 500,
    p_needs_review: options.needsReview === true,
    ...(options.ids !== undefined && { p_ids: [...options.ids] }),
  });
  if (error) throw new Error("forbidden");
  const [photos, suspects] = await Promise.all([
    adminPhotos(
      db,
      data.map((r) => r.id),
    ),
    suspectInfo(db, data),
  ]);
  return data.map((r) => {
    const place = toAdminPlace(r, photos.get(r.id) ?? []);
    const suspect = place.duplicateSuspectOf === undefined ? undefined : suspects.get(place.duplicateSuspectOf);
    return suspect === undefined
      ? place
      : { ...place, duplicateSuspectName: suspect.name, ...(suspect.removedByOwner && { duplicateSuspectRemovedByOwner: true }) };
  });
}

/** 중복 의심 후보의 상호 — 관리자 목록에서 읽으니 숨긴 후보(사장님 요청으로 내린 가게)도 이름이 나온다 */
async function suspectInfo(
  db: Db,
  rows: readonly { duplicate_suspect_of: string | null }[],
): Promise<Map<string, { name: string; removedByOwner: boolean }>> {
  const ids = [...new Set(rows.flatMap((r) => (r.duplicate_suspect_of === null ? [] : [r.duplicate_suspect_of])))];
  const info = new Map<string, { name: string; removedByOwner: boolean }>();
  if (ids.length === 0) return info;
  const { data } = await db.rpc("admin_places", { p_ids: ids, p_limit: 500 });
  for (const p of data ?? []) info.set(p.id, { name: p.name, removedByOwner: p.removed_by_owner });
  return info;
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

/* ══════════════════════════════════════════════════════════════════════════
 * 까주기 테스트 (spec 8) — 참여 한 줄(plan 결정 25). 화면 표시는 Phase 7
 * ════════════════════════════════════════════════════════════════════════ */

const peelSlugSchema = z.enum(PEEL_SLUGS);

/** 결과가 나올 때 한 줄 — Turnstile 없이(읽기급 익명 카운트), IP당 일 20은 DB가 센다. 실패해도 결과 화면을 막지 않는다(로그만). */
export async function recordPeelResult(slug: string): Promise<void> {
  const parsed = peelSlugSchema.safeParse(slug);
  if (!parsed.success || isReadOnly()) return;
  const db = await ipHashedClient();
  const { error } = await db.from("peel_results").insert({ type: parsed.data });
  if (error && error.code !== "42501") reportError("peel result not recorded", { code: error.code });
}
