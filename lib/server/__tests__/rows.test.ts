import { describe, expect, it } from "vitest";
import { STATION_NEARBY_MAX_M } from "@/lib/schemas";
import { DELETED_AUTHOR, DELETED_NICKNAME, photoUrl, toAdminPlace, toPlace, toReview } from "../rows";

const PLACE_ID = "3f2a9c1e-1111-4a1a-9b1b-000000000001";
const PHOTO_ID = "3f2a9c1e-2222-4a1a-9b1b-000000000002";
const USER_ID = "3f2a9c1e-3333-4a1a-9b1b-000000000003";

function publicRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PLACE_ID,
    name: "나라수산",
    gu: "마포구",
    address_road: "서울 마포구 마포대로 1",
    address_jibun: "서울 마포구 도화동 1-1",
    lat: 37.54,
    lng: 126.95,
    nearest_station: { name: "공덕역", exit: "2", distanceM: 120, lines: ["5", "6"] },
    tags: ["grill"],
    specialist: true,
    naver_place_url: null,
    hours_note: null,
    menus: [{ raw: "새우소금구이 1kg 60,000", name: "새우소금구이", price: 60000, unit: "kg", unit_raw: "1" }],
    sides: ["ramen", "headButter"],
    source: "seed",
    created_at: "2026-08-27T00:00:00+09:00",
    check_count: 3,
    last_checked_at: "2026-09-01T12:00:00+00:00",
    rating_count: 0,
    rating_avg: null,
    photos: [],
    is_new: false,
    ...overrides,
  };
}

describe("toPlace — places_public 행 → Place", () => {
  it("열 이름·사이드·역·사진 경로를 앱 모양으로 옮긴다", () => {
    const place = toPlace(publicRow({ photos: [{ id: PHOTO_ID, key: `places/${PLACE_ID}/a.webp`, uploadedAt: "2026-09-02T00:00:00Z" }] }));
    expect(place.addressRoad).toBe("서울 마포구 마포대로 1");
    expect(place.sides).toEqual({ headButter: true, ramen: true, friedRice: false });
    expect(place.nearestStation?.name).toBe("공덕역");
    expect(place.photos[0]?.url).toBe(`/photos/places/${PLACE_ID}/a.webp`);
    expect(place.thumbnailUrl).toBe(place.photos[0]?.url);
    expect(place.rating).toBeUndefined();
    expect(place.needsReview).toBe(false);
  });

  it(`역이 ${String(STATION_NEARBY_MAX_M)}m 밖이면 null — 컷은 DB가 아니라 코드가 갖는다`, () => {
    const far = toPlace(publicRow({ nearest_station: { name: "먼역", exit: null, distanceM: STATION_NEARBY_MAX_M + 1, lines: [] } }));
    expect(far.nearestStation).toBeNull();
    const edge = toPlace(publicRow({ nearest_station: { name: "경계역", exit: null, distanceM: STATION_NEARBY_MAX_M, lines: [] } }));
    expect(edge.nearestStation?.name).toBe("경계역");
  });

  it("확인 0회면 last_checked_at이 비어 온다 → 등록 시각을 기준으로(카드는 '○일 전 등록')", () => {
    const place = toPlace(publicRow({ check_count: 0, last_checked_at: null, source: "report", is_new: true }));
    expect(place.lastCheckedAt).toBe("2026-08-27T00:00:00+09:00");
    expect(place.isNew).toBe(true);
  });

  it("평점은 뷰가 3개 미만이면 null을 준다 — 값이 오면 그대로 얹는다", () => {
    const place = toPlace(publicRow({ rating_count: 3, rating_avg: 4.33 }));
    expect(place.rating).toEqual({ count: 3, average: 4.33 });
  });

  it("모양이 어긋난 행은 조용히 넘기지 않고 던진다", () => {
    expect(() => toPlace(publicRow({ tags: [] }))).toThrow();
    expect(() => toPlace(publicRow({ id: "p018" }))).toThrow();
  });
});

describe("toAdminPlace — places 표 행(admin_places)", () => {
  it("숨김·확인·사장님 삭제·중복 의심·제보자를 옮기고, 없는 값은 키 자체를 안 만든다(exactOptionalPropertyTypes)", () => {
    const row = {
      ...publicRow(),
      reporter_id: USER_ID,
      duplicate_suspect_of: null,
      merged_into: null,
      needs_review: true,
      verified_at: null,
      hidden_at: "2026-09-10T00:00:00Z",
      removed_by_owner: true,
    };
    const place = toAdminPlace(row, [{ id: PHOTO_ID, url: photoUrl("k.webp"), uploadedAt: "2026-09-02T00:00:00Z" }]);
    expect(place.hiddenAt).toBe("2026-09-10T00:00:00Z");
    expect(place.removedByOwner).toBe(true);
    expect(place.reporterId).toBe(USER_ID);
    expect("verifiedAt" in place).toBe(false);
    expect("duplicateSuspectOf" in place).toBe(false);
    expect(place.needsReview).toBe(true);
    expect(place.thumbnailUrl).toBe("/photos/k.webp");
  });
});

describe("toReview — reviews_public 행", () => {
  const row = {
    id: PHOTO_ID,
    place_id: PLACE_ID,
    author_id: USER_ID,
    rating: 4,
    text: "좋았어요",
    photo_key: null,
    created_at: "2026-09-01T00:00:00Z",
    edited_at: null,
    nickname: "새우헌터",
  };
  it("닉네임·시각·수정 표시", () => {
    const r = toReview({ ...row, edited_at: "2026-09-02T00:00:00Z", photo_key: "reviews/x.webp" });
    expect(r.nickname).toBe("새우헌터");
    expect(r.at).toBe("2026-09-01T00:00:00Z");
    expect(r.editedAt).toBe("2026-09-02T00:00:00Z");
    expect(r.photoUrl).toBe("/photos/reviews/x.webp");
  });
  it("탈퇴한 작성자는 식별자 없는 표시값으로", () => {
    const r = toReview({ ...row, author_id: null, nickname: null });
    expect(r.authorId).toBe(DELETED_AUTHOR);
    expect(r.nickname).toBe(DELETED_NICKNAME);
    expect("editedAt" in r).toBe(false);
  });
});
