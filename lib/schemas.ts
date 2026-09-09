/**
 * 데이터 계층의 상수·입력 스키마 — 컴포넌트(폼)와 서버 액션이 **같은 값**을 본다.
 * 순수 모듈이라 클라이언트 번들에 들어가도 되고, 서버 액션 파일("use server")은 async 함수만 export할 수 있어 여기 산다.
 * DB 쪽 상한(가게당 사진 10장·메뉴 5줄·후기 500자)은 supabase/migrations에도 같은 숫자로 박혀 있다 — 여기가 UI의 첫 방어선, DB가 마지막.
 */
import { z } from "zod";
import { isAllowedNaverPlaceUrl } from "./naver-links";
import type { PlaceTag } from "./types";

/** 한 가게에 붙일 수 있는 사진 수 (decisions 2026-09-03). 익명 업로드에 상한이 없으면 도배가 가장 싼 공격이다. */
export const MAX_PLACE_PHOTOS = 10;
/**
 * 이 거리(출구에서 직선 m) 밖이면 "역 근처"로 치지 않고 상세에서 역 줄을 지운다.
 * 800m ≈ 실제 도보 1km 남짓. DB에는 2km 안의 사실만 있고 컷은 코드가 갖는다.
 */
export const STATION_NEARBY_MAX_M = 800;
/** 업로드 한 장 상한 (security-reviewer 2026-09-08). 서버 재인코딩(Images 바인딩)이 진짜 방어선이고 이건 "말도 안 되는 파일"을 막는 문. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
/** 제보 한 건의 메뉴 줄 수 — 구이 1(필수) + 회 1(선택) + 기타 3. 크롤 가게 중앙값 3줄·최대 5줄(2026-09-09). */
export const REPORT_MENU_MAX = 5;
/** 그중 기타 줄 상한. 회 토글과 무관하게 고정 — 남는 자리로 계산하면 6줄이 되는 구멍(2026-09-09). */
export const REPORT_EXTRA_MENU_MAX = REPORT_MENU_MAX - 2;
/** 메뉴 제안 한 번에 담을 수 있는 기존 줄 수 */
export const MAX_MENU_EDITS = 20;
/** 신고가 이만큼 쌓이면 관리자 화면에서 눈에 띄게 표시한다. 자동 숨김은 없다(decisions 2026-09-08·2026-09-10). */
export const REPORT_ATTENTION_COUNT = 3;
/** 관리자 목록이 한 번에 가져오는 최대 행 수 — SQL LIMIT. */
export const ADMIN_PAGE_SIZE = 100;

/** 가게 id·사진 id·리뷰 id 공통 형태(uuid). */
export const idSchema = z.uuid();

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
  name: z.string().trim().min(1).max(30),
  price: z.number().int().min(100).max(999_999),
  unit: z.enum(["kg", "g", "pan", "count", "none"]),
  unitRaw: z.string().trim().max(10).nullable(),
  /** true = 새우회 줄("새우회도 팔아요"), false = 구이 줄 */
  raw: z.boolean(),
});

/** 사이드 3종 — 제보(화면 3-4)와 상세의 사이드 제안(화면 2-6)이 같은 모양을 쓴다. */
export const sidesSchema = z.object({
  headButter: z.boolean(),
  ramen: z.boolean(),
  friedRice: z.boolean(),
});

const imageFileSchema = z
  .instanceof(File)
  .refine((f) => f.type.startsWith("image/"), "이미지 파일만")
  .refine((f) => f.size <= MAX_PHOTO_BYTES, "사진 한 장은 10MB까지");

/** 제보 입력(design 화면 3). 필수는 가게명·좌표·메뉴 한 줄뿐(spec 4.3). 구는 좌표로 판정(전국). 좌표 범위는 한국 대략 상자. */
export const reportInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  lat: z.number().min(33).max(39),
  lng: z.number().min(124).max(132),
  menus: z.array(reportMenuSchema).min(1).max(REPORT_MENU_MAX),
  sides: sidesSchema,
  hoursNote: z.string().trim().max(80),
  /** 4단계 미리보기까지 고른 파일. 서버 액션은 이 배열을 받지 않는다(별도 업로드 — 플랜 커밋 6). */
  photos: z.array(imageFileSchema).max(MAX_PLACE_PHOTOS),
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

/**
 * 닉네임 — 한글·영문·숫자 2~12자, 단어 사이 공백 하나 (spec 5).
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

/** 리뷰 입력(design 화면 5 변형 (b)): 별점 필수, 후기 선택 500자, 사진 1장 선택. */
export const reviewInputSchema = z.object({
  placeId: idSchema,
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().max(500),
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
    hoursNote: z.string().trim().min(1).max(80),
  }),
  z.object({
    field: z.literal("address"),
    placeId: idSchema,
    addressRoad: z.string().trim().min(2).max(60),
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
  message: z.string().trim().max(300),
});
export type OwnerRequestInput = z.infer<typeof ownerRequestSchema>;

export const photoUploadSchema = z.object({
  placeId: idSchema,
  files: z.array(imageFileSchema).min(1).max(MAX_PLACE_PHOTOS),
});

export const resolveReportSchema = z.object({
  id: idSchema,
  status: z.enum(["open", "done", "dismissed"]),
});
