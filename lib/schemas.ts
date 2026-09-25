/**
 * 입력 스키마(zod) — 서버 액션이 마지막으로 검사하는 문. 상수와 순수 검증은 lib/limits.ts에 있고 여기는 그 상수로 스키마를 만든다.
 * **브라우저는 이 파일을 import하지 않는다**(plan perf-diet A1): zod 4가 로케일 253개를 실어 클라이언트 JS의 22%였다.
 * 컴포넌트는 lib/data.ts에서 상수(값)와 타입만 받는다 — `export type *`라 zod는 따라오지 않는다.
 */
import { z } from "zod";
import { BANNED_MESSAGE, hasBannedWord, hasUrl, URL_MESSAGE } from "./content-filter";
import {
  MAX_MENU_EDITS,
  MAX_PHOTO_BYTES,
  MAX_PLACE_PHOTOS,
  MAX_UPLOAD_BYTES,
  MENU_NAME_MAX,
  MENU_PRICE_MAX,
  MENU_PRICE_MIN,
  MENU_UNIT_RAW_MAX,
  PHOTO_TOO_LARGE_MESSAGE,
  REPORT_MENU_MAX,
  UPLOAD_TOO_LARGE_MESSAGE,
  isValidNickname,
  normalizeNickname,
} from "./limits";
import { isAllowedNaverPlaceUrl } from "./naver-links";
import type { PlaceTag } from "./types";

const withinUploadBudget = (files: readonly File[]) => files.reduce((n, f) => n + f.size, 0) <= MAX_UPLOAD_BYTES;

/** 가게 id·사진 id·리뷰 id 공통 형태(uuid). */
export const idSchema = z.uuid();

/** 익명이 즉시 반영하는 자유 텍스트 — 링크·욕설을 폼과 액션이 같은 판정으로 막는다(spec 5 스팸 4겹 3) */
function cleanText<T extends z.ZodType<string>>(schema: T) {
  return schema.refine((v) => !hasUrl(v), URL_MESSAGE).refine((v) => !hasBannedWord(v), BANNED_MESSAGE);
}

export interface PlaceFilter {
  tag?: PlaceTag;
  gu?: string;
  isNew?: boolean;
  query?: string;
}

/** 관리자 목록 공통 옵션 — 기간(일)과 상한. `sinceDays`가 없으면 전체다. */
export interface AdminListFilter {
  /** 기준 시각(ISO). 없으면 지금 */
  now?: string;
  /** 최근 N일만. null·없음 = 전체 */
  sinceDays?: number | null;
  limit?: number;
}

/** 사진 신고 사유 — 뷰어 신고 시트의 4행과 1:1 (design 화면 2 변형 (e)). */
export type PhotoReportReason = "inappropriate" | "wrong_place" | "spam" | "other";

export const photoReportSchema = z.object({
  placeId: idSchema,
  photoId: idSchema,
  reason: z.enum(["inappropriate", "wrong_place", "spam", "other"]),
});

/**
 * 제보 메뉴 한 줄(spec 4.3-3). `unitRaw`는 `unitChipLabel`이 읽는 형태 그대로 —
 * kg·g는 숫자만("1", "500"), 한판·반판·N마리는 표기 자체, 단위 없음은 null.
 */
export const reportMenuSchema = z.object({
  name: cleanText(z.string().trim().min(1).max(MENU_NAME_MAX)),
  price: z.number().int().min(MENU_PRICE_MIN).max(MENU_PRICE_MAX),
  unit: z.enum(["kg", "g", "pan", "count", "none"]),
  unitRaw: z.string().trim().max(MENU_UNIT_RAW_MAX).nullable(),
  /** true = 새우회 줄("새우회도 팔아요"), false = 구이 줄 */
  raw: z.boolean(),
});

/** 사이드 3종 — 제보(화면 3-4)와 상세의 사이드 제안(화면 2-6)이 같은 모양을 쓴다. */
export const sidesSchema = z.object({
  headButter: z.boolean(),
  ramen: z.boolean(),
  friedRice: z.boolean(),
});

export const imageFileSchema = z
  .instanceof(File)
  .refine((f) => f.type.startsWith("image/"), "이미지 파일만")
  .refine((f) => f.size <= MAX_PHOTO_BYTES, PHOTO_TOO_LARGE_MESSAGE);

/** 제보 입력(design 화면 3). 필수는 가게명·좌표·메뉴 한 줄뿐(spec 4.3). 구는 좌표로 판정(전국). 좌표 범위는 한국 대략 상자. */
export const reportInputSchema = z.object({
  name: cleanText(z.string().trim().min(1).max(40)),
  lat: z.number().min(33).max(39),
  lng: z.number().min(124).max(132),
  menus: z.array(reportMenuSchema).min(1).max(REPORT_MENU_MAX),
  sides: sidesSchema,
  hoursNote: cleanText(z.string().trim().max(80)),
  /** 4단계 미리보기까지 고른 파일. 서버 액션은 이 배열을 받지 않는다(별도 업로드 — 플랜 커밋 6). */
  photos: z.array(imageFileSchema).max(MAX_PLACE_PHOTOS).refine(withinUploadBudget, UPLOAD_TOO_LARGE_MESSAGE),
  /** 2단계 중복 의심에 "다른 가게예요"로 답했으면 그 후보 id */
  duplicateOf: idSchema.nullable(),
  /** 사용자가 붙여넣은 네이버 지도 링크 — API 응답이 아니라 규칙 2에 안 걸린다. 허용 호스트만. */
  naverPlaceUrl: z
    .string()
    .trim()
    .refine((v) => v === "" || isAllowedNaverPlaceUrl(v), "네이버 지도 링크만 넣을 수 있어요"),
});
/** 서버 액션이 받는 제보 — 파일은 직렬화되지 않으므로 뺀다 */
export const reportPayloadSchema = reportInputSchema.omit({ photos: true });

export type ReportMenuInput = z.infer<typeof reportMenuSchema>;
export type ReportInput = z.infer<typeof reportInputSchema>;
export type ReportPayload = z.infer<typeof reportPayloadSchema>;

/** 닉네임 — 규칙은 lib/limits.ts(`normalizeNickname`·`isValidNickname`). 폼과 같은 함수라 판정이 갈릴 수 없다. */
export const nicknameSchema = z.string().transform(normalizeNickname).refine(isValidNickname, BANNED_MESSAGE);

/** 리뷰 입력(design 화면 5 변형 (b)): 별점 필수, 후기 선택 500자, 사진 1장 선택. */
export const reviewInputSchema = z.object({
  placeId: idSchema,
  rating: z.number().int().min(1).max(5),
  text: cleanText(z.string().trim().max(500)),
  photo: imageFileSchema.nullable(),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;
export const reviewPayloadSchema = reviewInputSchema.omit({ photo: true });
export type ReviewPayload = z.infer<typeof reviewPayloadSchema>;

/** 수정은 별점·후기만 (사진 교체는 별도). */
export const reviewPatchSchema = reviewInputSchema.pick({ rating: true, text: true });
export type ReviewPatch = z.infer<typeof reviewPatchSchema>;

export const placeFlagSchema = z.object({
  placeId: idSchema,
  reason: z.enum(["location", "menu", "closed", "other"]),
});

/** 필드별 수정 (spec 4.2 — 즉시 반영 + 사후 확인). 주소는 사용자가 직접 친 값만(규칙 2). */
export const suggestionSchema = z.discriminatedUnion("field", [
  z.object({
    field: z.literal("hours"),
    placeId: idSchema,
    hoursNote: cleanText(z.string().trim().min(1).max(80)),
  }),
  z.object({
    field: z.literal("address"),
    placeId: idSchema,
    addressRoad: cleanText(z.string().trim().min(2).max(60)),
  }),
  /** 메뉴는 바뀐 것만 보낸다(decisions 2026-09-08). */
  z
    .object({
      field: z.literal("menus"),
      placeId: idSchema,
      edits: z
        .array(
          z.object({
            index: z.number().int().min(0),
            name: z.string().trim().min(1).max(200),
            price: z.number().int().min(100).max(999_999).optional(),
            removed: z.boolean(),
          }),
        )
        .max(MAX_MENU_EDITS),
      added: z.array(reportMenuSchema).max(1),
    })
    .refine((v) => v.edits.length + v.added.length > 0, "고친 곳이 없어요"),
  z.object({ field: z.literal("sides"), placeId: idSchema, sides: sidesSchema }),
]);
export type SuggestionInput = z.infer<typeof suggestionSchema>;

export const placeReportSchema = z.object({
  placeId: idSchema,
  reason: z.enum(["not_shrimp", "fake", "duplicate", "other"]),
});

/**
 * 사장님 정보 수정·게재 삭제 요청. 연락처는 필수("24시간 내 처리"는 회신할 곳이 있어야 성립).
 * 연락처는 알림 본문에 들어간다 — 개행·제어문자로 본문을 조작하지 못하게 NFKC + 제어문자 제거(security-reviewer 2026-09-08).
 */
export const ownerRequestSchema = z.object({
  placeId: idSchema,
  kind: z.enum(["edit", "remove"]),
  contact: z
    .string()
    .transform((v) => v.normalize("NFKC").replaceAll(/[\u0000-\u001f\u007f]/gu, " ").trim())
    .pipe(z.string().min(5).max(60)),
  message: cleanText(z.string().trim().max(300)),
});
export type OwnerRequestInput = z.infer<typeof ownerRequestSchema>;

export const photoUploadSchema = z.object({
  placeId: idSchema,
  files: z.array(imageFileSchema).min(1).max(MAX_PLACE_PHOTOS).refine(withinUploadBudget, UPLOAD_TOO_LARGE_MESSAGE),
});

export const resolveReportSchema = z.object({
  id: idSchema,
  status: z.enum(["open", "done", "dismissed"]),
});
