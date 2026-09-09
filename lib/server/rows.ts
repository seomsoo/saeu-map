/**
 * DB 행 → 앱 타입. 뷰의 열은 전부 nullable로 생성되므로(PostgREST 타입 생성기 한계) zod로 실제 모양을 확인한다.
 * 순수 함수 — 테스트는 lib/server/__tests__/rows.test.ts.
 */
import { z } from "zod";
import { STATION_NEARBY_MAX_M } from "@/lib/schemas";
import type { Photo, Place, Review } from "@/lib/types";

const menuSchema = z.object({
  raw: z.string(),
  name: z.string(),
  price: z.number().nullable(),
  unit: z.enum(["kg", "g", "pan", "count", "size", "serving", "none"]),
  unit_raw: z.string().nullable(),
});

const stationSchema = z.object({
  name: z.string(),
  exit: z.string().nullable(),
  distanceM: z.number(),
  lines: z.array(z.string()),
});

const photoJsonSchema = z.object({ id: z.uuid(), key: z.string(), uploadedAt: z.string() });

const placeCommon = {
  id: z.uuid(),
  name: z.string(),
  gu: z.string(),
  address_road: z.string().nullable(),
  address_jibun: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  nearest_station: stationSchema.nullable(),
  tags: z.array(z.enum(["grill", "raw"])).min(1),
  specialist: z.boolean(),
  naver_place_url: z.string().nullable(),
  hours_note: z.string().nullable(),
  menus: z.array(menuSchema),
  sides: z.array(z.string()),
  source: z.enum(["seed", "report"]),
  created_at: z.string(),
};

export const placePublicRowSchema = z.object({
  ...placeCommon,
  check_count: z.number(),
  last_checked_at: z.string().nullable(),
  rating_count: z.number(),
  rating_avg: z.number().nullable(),
  photos: z.array(photoJsonSchema),
  is_new: z.boolean(),
});
export type PlacePublicRow = z.infer<typeof placePublicRowSchema>;

/** R2 키 → 우리 경로. 서빙 라우트(app/photos/[...key])가 R2에서 읽는다 — 외부 도메인이 아니라 규칙 3의 `safeAssetPath`가 그대로 통한다. */
export function photoUrl(key: string): string {
  return `/photos/${key}`;
}

function toSides(sides: readonly string[]): Place["sides"] {
  return {
    headButter: sides.includes("headButter"),
    ramen: sides.includes("ramen"),
    friedRice: sides.includes("friedRice"),
  };
}

export function toPlace(input: unknown): Place {
  const row = placePublicRowSchema.parse(input);
  const photos: Photo[] = row.photos.map((p) => ({ id: p.id, url: photoUrl(p.key), uploadedAt: p.uploadedAt }));
  const station = row.nearest_station;
  return {
    id: row.id,
    name: row.name,
    gu: row.gu,
    addressRoad: row.address_road,
    addressJibun: row.address_jibun,
    lat: row.lat,
    lng: row.lng,
    // 2km 안의 사실이 들어 있고 800m 컷은 코드가 갖는다 — 멀면 상세가 역 줄을 안 그린다
    nearestStation: station && station.distanceM <= STATION_NEARBY_MAX_M ? station : null,
    tags: row.tags,
    specialist: row.specialist,
    naverPlaceUrl: row.naver_place_url,
    photos,
    thumbnailUrl: photos[0]?.url ?? null,
    hoursNote: row.hours_note,
    menus: row.menus,
    sides: toSides(row.sides),
    source: row.source,
    needsReview: false,
    // 확인 0회면 비어 온다 → 등록 시각을 기준으로 "○일 전 등록"(백로그, decisions 2026-09-10)
    lastCheckedAt: row.last_checked_at ?? row.created_at,
    checkCount: row.check_count,
    isNew: row.is_new,
    createdAt: row.created_at,
    ...(row.rating_avg !== null && { rating: { count: row.rating_count, average: row.rating_avg } }),
  };
}

/** 관리자가 읽는 places 표 행(admin_places RPC). 집계가 없으므로 확인수 0·확인일 = 등록일로 채운다(관리자 표는 등록일을 쓴다). */
export const placeAdminRowSchema = z.object({
  ...placeCommon,
  reporter_id: z.uuid().nullable(),
  duplicate_suspect_of: z.uuid().nullable(),
  merged_into: z.uuid().nullable(),
  needs_review: z.boolean(),
  verified_at: z.string().nullable(),
  hidden_at: z.string().nullable(),
  removed_by_owner: z.boolean(),
});

export function toAdminPlace(input: unknown, photos: readonly Photo[] = []): Place {
  const row = placeAdminRowSchema.parse(input);
  return {
    id: row.id,
    name: row.name,
    gu: row.gu,
    addressRoad: row.address_road,
    addressJibun: row.address_jibun,
    lat: row.lat,
    lng: row.lng,
    nearestStation: row.nearest_station,
    tags: row.tags,
    specialist: row.specialist,
    naverPlaceUrl: row.naver_place_url,
    photos: [...photos],
    thumbnailUrl: photos[0]?.url ?? null,
    hoursNote: row.hours_note,
    menus: row.menus,
    sides: toSides(row.sides),
    source: row.source,
    needsReview: row.needs_review,
    lastCheckedAt: row.created_at,
    checkCount: 0,
    isNew: false,
    createdAt: row.created_at,
    ...(row.verified_at !== null && { verifiedAt: row.verified_at }),
    ...(row.hidden_at !== null && { hiddenAt: row.hidden_at }),
    ...(row.removed_by_owner && { removedByOwner: true }),
    ...(row.duplicate_suspect_of !== null && { duplicateSuspectOf: row.duplicate_suspect_of }),
    ...(row.reporter_id !== null && { reporterId: row.reporter_id }),
  };
}

export const photoRowSchema = z.object({
  id: z.uuid(),
  place_id: z.uuid(),
  key: z.string(),
  created_at: z.string(),
  uploader_id: z.uuid().nullable().optional(),
});

export function toPhoto(input: unknown): Photo & { placeId: string } {
  const row = photoRowSchema.parse(input);
  return {
    id: row.id,
    placeId: row.place_id,
    url: photoUrl(row.key),
    uploadedAt: row.created_at,
    ...(row.uploader_id != null && { uploaderId: row.uploader_id }),
  };
}

export const reviewPublicRowSchema = z.object({
  id: z.uuid(),
  place_id: z.uuid(),
  author_id: z.uuid().nullable(),
  rating: z.number(),
  text: z.string(),
  photo_key: z.string().nullable(),
  created_at: z.string(),
  edited_at: z.string().nullable(),
  nickname: z.string().nullable(),
});

/** 탈퇴한 작성자 — 식별자 없는 표시값(리뷰는 소프트 삭제되지만 모양은 같게 둔다) */
export const DELETED_AUTHOR = "deleted";
export const DELETED_NICKNAME = "탈퇴한 사용자";

export function toReview(input: unknown): Review {
  const row = reviewPublicRowSchema.parse(input);
  return {
    id: row.id,
    placeId: row.place_id,
    authorId: row.author_id ?? DELETED_AUTHOR,
    rating: row.rating,
    text: row.text,
    nickname: row.nickname ?? DELETED_NICKNAME,
    at: row.created_at,
    ...(row.edited_at !== null && { editedAt: row.edited_at }),
    ...(row.photo_key !== null && { photoUrl: photoUrl(row.photo_key) }),
  };
}
