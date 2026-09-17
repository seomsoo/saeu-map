import { describe, expect, it } from "vitest";
import {
  MAX_PLACE_PHOTOS,
  nicknameSchema,
  ownerRequestSchema,
  reportInputSchema,
  reportPayloadSchema,
  reviewInputSchema,
  suggestionSchema,
} from "../schemas";

const ID = "3f2a9c1e-1111-4a1a-9b1b-000000000001";
const menu = { name: "새우구이", price: 50000, unit: "kg" as const, unitRaw: "1", raw: false };
const base = {
  name: "새 가게",
  lat: 37.5,
  lng: 127,
  menus: [menu],
  sides: { headButter: false, ramen: false, friedRice: false },
  hoursNote: "",
  photos: [] as File[],
  duplicateOf: null,
  naverPlaceUrl: "",
};
const image = (size = 10) => new File([new Uint8Array(size)], "a.jpg", { type: "image/jpeg" });

describe("reportInputSchema — 제보 입력", () => {
  it("필수는 가게명·좌표·메뉴 한 줄. 낮은 가격·이미지 아닌 파일·11장·한국 밖 좌표는 거부", () => {
    expect(reportInputSchema.safeParse(base).success).toBe(true);
    expect(reportInputSchema.safeParse({ ...base, name: " " }).success).toBe(false);
    expect(reportInputSchema.safeParse({ ...base, menus: [] }).success).toBe(false);
    expect(reportInputSchema.safeParse({ ...base, menus: [{ ...menu, price: 50 }] }).success).toBe(false);
    expect(reportInputSchema.safeParse({ ...base, lat: 50 }).success).toBe(false);
    expect(reportInputSchema.safeParse({ ...base, photos: [new File(["x"], "a.txt", { type: "text/plain" })] }).success).toBe(false);
    expect(reportInputSchema.safeParse({ ...base, photos: Array.from({ length: MAX_PLACE_PHOTOS + 1 }, () => image()) }).success).toBe(false);
    expect(reportInputSchema.safeParse({ ...base, naverPlaceUrl: "https://evil.example/x" }).success).toBe(false);
    expect(reportInputSchema.safeParse({ ...base, naverPlaceUrl: "https://naver.me/abc" }).success).toBe(true);
  });

  it("서버 액션 페이로드에는 파일이 없다 — photos 키 자체를 받지 않는다", () => {
    const parsed = reportPayloadSchema.parse({ ...base, photos: undefined });
    expect("photos" in parsed).toBe(false);
    expect(reportPayloadSchema.safeParse(base).success).toBe(true); // 있어도 무시(strip)
  });
});

describe("nicknameSchema", () => {
  it("2~12자, NFKC 정규화, 폭 없는 공백·제어문자 거부", () => {
    expect(nicknameSchema.parse(" 새우헌터 ")).toBe("새우헌터");
    expect(nicknameSchema.parse("ｓｈｒｉｍｐ")).toBe("shrimp");
    expect(nicknameSchema.safeParse("a").success).toBe(false);
    expect(nicknameSchema.safeParse("열세글자가넘는닉네임입니다").success).toBe(false);
    expect(nicknameSchema.safeParse("새우​헌터").success).toBe(false);
    expect(nicknameSchema.safeParse("새우  헌터").success).toBe(false);
  });
});

describe("ownerRequestSchema", () => {
  it("연락처 필수(5~60), 제어문자·개행은 공백으로 — 알림 본문 조작 방지", () => {
    const parsed = ownerRequestSchema.parse({ placeId: ID, kind: "remove", contact: "010-1234-5678\n[운영자]", message: "" });
    expect(parsed.contact).toBe("010-1234-5678 [운영자]");
    expect(ownerRequestSchema.safeParse({ placeId: ID, kind: "edit", contact: "123", message: "" }).success).toBe(false);
  });
});

describe("suggestionSchema", () => {
  it("메뉴 제안은 고친 곳이 하나는 있어야 한다", () => {
    expect(suggestionSchema.safeParse({ field: "menus", placeId: ID, edits: [], added: [] }).success).toBe(false);
    expect(suggestionSchema.safeParse({ field: "menus", placeId: ID, edits: [{ index: 0, name: "새우구이", removed: true }], added: [] }).success).toBe(true);
    expect(suggestionSchema.safeParse({ field: "hours", placeId: ID, hoursNote: "" }).success).toBe(false);
  });
});

describe("reviewInputSchema", () => {
  it("별점 1~5 정수, 후기 500자, 사진 1장 선택", () => {
    expect(reviewInputSchema.safeParse({ placeId: ID, rating: 5, text: "", photo: null }).success).toBe(true);
    expect(reviewInputSchema.safeParse({ placeId: ID, rating: 0, text: "", photo: null }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ placeId: ID, rating: 4.5, text: "", photo: null }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ placeId: ID, rating: 3, text: "가".repeat(501), photo: null }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ placeId: "rv001", rating: 3, text: "", photo: null }).success).toBe(false);
  });
});
