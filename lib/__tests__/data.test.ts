import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_PLACE_PHOTOS,
  MOCK_FAILURE_RATE,
  MOCK_WRITE_DELAY_MS,
  STATION_NEARBY_MAX_M,
  checkIn,
  getBookmarkedPlaceIds,
  getCheckins,
  getEventCard,
  getGuOfPoint,
  getPlaceById,
  getPlaceDetail,
  getPlaces,
  getReviews,
  getSeasonStats,
  reportPhoto,
  submitReport,
  toggleBookmark,
  type ReportInput,
} from "../data";
import { isInactive, kstDayIndex } from "../time";

// 목 날짜는 now 기준으로 이동되므로, 어떤 now를 넣어도 같은 성질이 유지되어야 한다.
const NOWS = ["2026-09-01T12:00:00+09:00", "2027-03-15T09:30:00+09:00"];

describe("getPlaces", () => {
  it.each(NOWS)("now=%s — 검수 대기는 숨기고 날짜는 UTC ISO", async (now) => {
    const places = await getPlaces({}, now);
    expect(places.length).toBeGreaterThan(0);
    expect(places.some((p) => p.needsReview)).toBe(false);
    for (const p of places) {
      expect(p.lastCheckedAt).toMatch(/Z$/);
      expect(kstDayIndex(p.lastCheckedAt)).toBeLessThanOrEqual(kstDayIndex(now));
    }
  });

  it.each(NOWS)("now=%s — 신규는 등록 7일 이내로 파생 (목 3곳)", async (now) => {
    const fresh = await getPlaces({ isNew: true }, now);
    expect(fresh).toHaveLength(3);
    for (const p of fresh) expect(p.createdAt).toBeDefined();
  });

  it("6개월 무활동 표본 2곳 (p004, p115)", async () => {
    const now = NOWS[0] as string;
    const p004 = await getPlaceById("p004", now);
    const p115 = await getPlaceById("p115", now);
    expect(p004 && isInactive(p004.lastCheckedAt, now)).toBe(true);
    expect(p115 && isInactive(p115.lastCheckedAt, now)).toBe(true);
    const inactiveCount = (await getPlaces({}, now)).filter((p) =>
      isInactive(p.lastCheckedAt, now),
    ).length;
    expect(inactiveCount).toBe(2);
  });

  it("필터: tag / gu / query", async () => {
    const now = NOWS[0] as string;
    for (const p of await getPlaces({ tag: "raw" }, now)) expect(p.tags).toContain("raw");
    for (const p of await getPlaces({ gu: "마포구" }, now)) expect(p.gu).toBe("마포구");
    const [first] = await getPlaces({}, now);
    if (!first) throw new Error("no places");
    expect(await getPlaces({ query: first.name.slice(0, 2) }, now)).not.toHaveLength(0);
    expect(await getPlaces({ query: "없는동네" }, now)).toHaveLength(0);
  });

  it("getPlaceById: 없는 id는 undefined", async () => {
    expect(await getPlaceById("nonexistent")).toBeUndefined();
  });

  // 특정 id에 묶지 않는다 — 역 데이터를 재생성해도 성질은 그대로여야 한다.
  it("최근접역은 STATION_NEARBY_MAX_M 안이거나 null", async () => {
    const places = await getPlaces({}, NOWS[0]);
    for (const p of places) {
      if (p.nearestStation === null) continue;
      expect(p.nearestStation.distanceM).toBeLessThanOrEqual(STATION_NEARBY_MAX_M);
      expect(p.nearestStation.name).toMatch(/역$/);
      expect(p.nearestStation.lines.length).toBeGreaterThan(0);
    }
    // 두 분기가 목에 다 있어야 상세의 폴백이 실제로 검증된다
    expect(places.some((p) => p.nearestStation !== null)).toBe(true);
    expect(places.some((p) => p.nearestStation === null)).toBe(true);
  });
});

describe("getCheckins / getReviews", () => {
  it("전체와 placeId 필터", async () => {
    const all = await getCheckins();
    expect(all.length).toBeGreaterThan(0);
    const first = all[0];
    if (!first) throw new Error("no checkins");
    for (const c of await getCheckins(first.placeId)) expect(c.placeId).toBe(first.placeId);

    const reviews = await getReviews();
    expect(reviews.length).toBeGreaterThan(0);
    for (const r of await getReviews(reviews[0]?.placeId)) {
      expect(r.placeId).toBe(reviews[0]?.placeId);
    }
  });
});

describe("getSeasonStats", () => {
  it("목 최신 체크인이 오늘로 이동되므로 하루 끝엔 오늘 건수 > 0", async () => {
    const stats = await getSeasonStats("2026-09-01T23:59:00+09:00");
    expect(stats.todayCheckinCount).toBeGreaterThan(0);
    expect(stats.weekPlaceCount).toBeGreaterThan(0);
    expect(stats.topPlace).not.toBeNull();
    expect(stats.topPlace?.count).toBeGreaterThanOrEqual(1);
  });

  it("now 이후 시각의 이벤트는 세지 않는다 (월요일 자정 직후 = 0)", async () => {
    const stats = await getSeasonStats("2026-08-31T00:00:30+09:00");
    expect(stats.todayCheckinCount).toBe(0);
    expect(stats.weekPlaceCount).toBe(0);
    expect(stats.topPlace).toBeNull();
  });
});

describe("getEventCard", () => {
  it("기간 안이면 카드, 밖이면 null", async () => {
    expect(await getEventCard("2026-09-01T12:00:00+09:00")).toMatchObject({
      href: "/test",
    });
    expect(await getEventCard("2027-06-01T12:00:00+09:00")).toBeNull();
  });
});

describe("getBookmarkedPlaceIds", () => {
  it("목 초기값은 빈 배열", async () => {
    expect(await getBookmarkedPlaceIds()).toEqual([]);
  });
});

describe("getPlaceDetail", () => {
  it("가게 + 리뷰(최신순), hoursNote 정규화", async () => {
    const now = NOWS[0] as string;
    const detail = await getPlaceDetail("p018", now);
    expect(detail?.place.hoursNote).toBe("17:00 오픈, 새벽 1시까지");
    expect(detail?.reviews.length).toBeGreaterThanOrEqual(3);
    const times = detail?.reviews.map((r) => Date.parse(r.at)) ?? [];
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(detail?.reviews.some((r) => r.photoUrl?.startsWith("/mock/"))).toBe(true);

    const noNote = await getPlaceDetail("p004", now);
    expect(noNote?.place.hoursNote).toBeNull();
    expect(await getPlaceDetail("nonexistent", now)).toBeUndefined();
  });

  it.each(NOWS)("now=%s — 사진은 여러 장, 대표(thumbnailUrl)는 첫 장, 업로드일도 이동한다", async (now) => {
    const withPhotos = await getPlaceDetail("p018", now);
    const photos = withPhotos?.place.photos ?? [];
    expect(photos.length).toBeGreaterThan(1);
    expect(withPhotos?.place.thumbnailUrl).toBe(photos[0]?.url);
    for (const photo of photos) {
      expect(photo.id).toMatch(/^p018-p\d+$/);
      expect(photo.url.startsWith("/")).toBe(true);
      // 다른 목 날짜와 같은 shift를 타야 "오늘 올린 사진"이 미래가 되지 않는다
      expect(photo.uploadedAt).toBe(new Date(photo.uploadedAt).toISOString());
      expect(Date.parse(photo.uploadedAt)).toBeLessThanOrEqual(Date.parse(now));
    }
    // 업로드 순서 유지
    const times = photos.map((p) => Date.parse(p.uploadedAt));
    expect([...times].sort((a, b) => a - b)).toEqual(times);

    const noPhoto = await getPlaceDetail("p004", now);
    expect(noPhoto?.place.photos).toEqual([]);
    expect(noPhoto?.place.thumbnailUrl).toBeNull();
  });

  it(`한 가게 ${String(MAX_PLACE_PHOTOS)}장까지만 (목 데이터에 꽉 찬 케이스가 있다)`, async () => {
    const places = await getPlaces({}, NOWS[0]);
    for (const place of places) {
      expect(place.photos.length).toBeLessThanOrEqual(MAX_PLACE_PHOTOS);
    }
    expect(places.some((p) => p.photos.length === MAX_PLACE_PHOTOS)).toBe(true);
  });
});

describe("reportPhoto — 목 쓰기", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("성공: 400ms 뒤 resolve", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const promise = reportPhoto({ placeId: "p018", photoId: "p018-p1", reason: "inappropriate" });
    await vi.advanceTimersByTimeAsync(MOCK_WRITE_DELAY_MS);
    await expect(promise).resolves.toBeUndefined();
  });

  it("실패: 10% 확률에 걸리면 reject (컴포넌트가 토스트로 되돌린다)", async () => {
    vi.spyOn(Math, "random").mockReturnValue(MOCK_FAILURE_RATE / 2);
    const promise = reportPhoto({ placeId: "p018", photoId: "p018-p1", reason: "spam" });
    // 핸들러를 타이머 진행 전에 붙인다 — 안 그러면 reject 시점에 unhandled rejection으로 잡힌다
    const assertion = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(MOCK_WRITE_DELAY_MS);
    await assertion;
  });

  it("검증: 빈 id·모르는 사유는 거부하고 지연도 타지 않는다", async () => {
    await expect(reportPhoto({ placeId: "", photoId: "p018-p1", reason: "other" })).rejects.toThrow();
    await expect(
      reportPhoto({ placeId: "p018", photoId: "p018-p1", reason: "nope" as never }),
    ).rejects.toThrow();
  });
});

describe("checkIn — 목 쓰기 (400ms 지연, 10% 실패)", () => {
  // 다른 테스트의 데이터셋(NOWS)을 건드리지 않도록 별도 날짜의 데이터셋을 쓴다
  const NOW = "2028-01-10T12:00:00+09:00";

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("성공: 확인 +1, 확인일 = now, 새 객체, checkins에 visited 추가", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const before = await getPlaceById("p018", NOW);
    if (!before) throw new Error("no place");
    const pending = checkIn("p018", NOW);
    await vi.advanceTimersByTimeAsync(MOCK_WRITE_DELAY_MS);
    const updated = await pending;
    expect(updated.checkCount).toBe(before.checkCount + 1);
    expect(updated.lastCheckedAt).toBe(new Date(Date.parse(NOW)).toISOString());
    expect(updated).not.toBe(before);
    expect(await getPlaceById("p018", NOW)).toBe(updated);
    const visited = (await getCheckins("p018", NOW)).filter((c) => c.type === "visited");
    expect(visited.at(-1)?.at).toBe(updated.lastCheckedAt);
  });

  it("실패(10%): reject하고 데이터는 그대로", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.05);
    const before = await getPlaceById("p019", NOW);
    const pending = checkIn("p019", NOW);
    const assertion = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(MOCK_WRITE_DELAY_MS);
    await assertion;
    expect(await getPlaceById("p019", NOW)).toBe(before);
  });

  it("지연 전에는 resolve되지 않는다", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    let settled = false;
    const pending = checkIn("p018", NOW).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(MOCK_WRITE_DELAY_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(settled).toBe(true);
  });

  it("빈 placeId는 zod가 거부", async () => {
    await expect(checkIn("", NOW)).rejects.toThrow();
  });
});

describe("toggleBookmark", () => {
  it("켜고 끄기, 목록 반환", async () => {
    expect(await toggleBookmark("p018")).toEqual(["p018"]);
    expect(await getBookmarkedPlaceIds()).toEqual(["p018"]);
    expect(await toggleBookmark("p018")).toEqual([]);
    await expect(toggleBookmark("")).rejects.toThrow();
  });
});

describe("getGuOfPoint", () => {
  it("서울 안이면 구, 밖이면 null", async () => {
    expect(await getGuOfPoint({ lat: 37.5571, lng: 126.9245 })).toBe("마포구");
    expect(await getGuOfPoint({ lat: 37.6, lng: 126.77 })).toBeNull();
  });
});

describe("submitReport — 제보 등록 (목 쓰기)", () => {
  // 다른 테스트의 데이터셋을 건드리지 않도록 별도 날짜
  const NOW = "2029-05-05T12:00:00+09:00";
  const input = (): ReportInput => ({
    name: "테스트 새우집",
    lat: 37.5571, // 홍대입구 → 마포구
    lng: 126.9245,
    menus: [{ name: "왕새우 소금구이", price: 35000, unit: "kg", unitRaw: "1", raw: false }],
    sides: { headButter: true, ramen: false, friedRice: false },
    hoursNote: "",
    photos: [],
    duplicateOf: null,
  });
  const image = (name: string) => new File(["x"], name, { type: "image/jpeg" });

  beforeAll(async () => {
    // 경계 JSON 동적 import를 가짜 타이머 밖에서 미리 끝낸다 (gu.ts가 캐시한다)
    await getGuOfPoint({ lat: 37.5571, lng: 126.9245 });
  });
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("성공: 구는 경계로 판정, 주소·역은 비고, 데이터셋 끝에 붙어 조회된다", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const before = await getPlaces({}, NOW);
    const pending = submitReport(
      {
        ...input(),
        menus: [...input().menus, { name: "생새우회", price: 40000, unit: "g", unitRaw: "500", raw: true }],
        hoursNote: " 새벽 2시까지 ",
        photos: [image("a.jpg"), image("b.jpg")],
        duplicateOf: "p018",
      },
      NOW,
    );
    await vi.advanceTimersByTimeAsync(MOCK_WRITE_DELAY_MS);
    const place = await pending;
    const at = new Date(Date.parse(NOW)).toISOString();
    expect(place).toMatchObject({
      name: "테스트 새우집",
      gu: "마포구",
      addressRoad: null,
      addressJibun: null,
      nearestStation: null,
      tags: ["grill", "raw"],
      specialist: false,
      naverPlaceUrl: null,
      photos: [], // 목은 파일을 버린다 (Phase 6 저장소)
      thumbnailUrl: null,
      hoursNote: "새벽 2시까지",
      source: "report",
      needsReview: false,
      lastCheckedAt: at,
      createdAt: at,
      checkCount: 0,
      isNew: true,
      duplicateSuspectOf: "p018",
    });
    expect(place.menus).toEqual([
      { raw: "왕새우 소금구이", name: "왕새우 소금구이", price: 35000, unit: "kg", unit_raw: "1" },
      { raw: "생새우회", name: "생새우회", price: 40000, unit: "g", unit_raw: "500" },
    ]);
    const after = await getPlaces({}, NOW);
    expect(after).toHaveLength(before.length + 1);
    expect(after.at(-1)).toBe(place);
    expect(await getPlaceById(place.id, NOW)).toBe(place);
    expect(await getPlaces({ isNew: true }, NOW)).toContain(place);
  });

  it("구이 줄만이면 tags는 grill, 빈 영업시간은 null, 중복 후보 없으면 duplicateSuspectOf 없음", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const pending = submitReport(input(), NOW);
    await vi.advanceTimersByTimeAsync(MOCK_WRITE_DELAY_MS);
    const place = await pending;
    expect(place.tags).toEqual(["grill"]);
    expect(place.hoursNote).toBeNull();
    expect("duplicateSuspectOf" in place).toBe(false);
    expect(place.id).toMatch(/^r\d{3}$/);
  });

  it("실패(10%): reject하고 데이터는 그대로", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.05);
    const before = await getPlaces({}, NOW);
    const pending = submitReport(input(), NOW);
    const assertion = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(MOCK_WRITE_DELAY_MS);
    await assertion;
    expect(await getPlaces({}, NOW)).toHaveLength(before.length);
  });

  it("검증: 빈 이름·메뉴 0줄·낮은 가격·이미지 아닌 파일·11장·좌표 범위 밖은 지연 없이 거부", async () => {
    const cases: Array<Partial<ReportInput>> = [
      { name: "  " },
      { menus: [] },
      { menus: [{ name: "왕새우 소금구이", price: 50, unit: "kg", unitRaw: "1", raw: false }] },
      { photos: [new File(["x"], "a.txt", { type: "text/plain" })] },
      { photos: Array.from({ length: MAX_PLACE_PHOTOS + 1 }, (_, i) => image(`${i}.jpg`)) },
      { lat: 50 },
    ];
    for (const c of cases) {
      await expect(submitReport({ ...input(), ...c }, NOW)).rejects.toThrow();
    }
  });

  it("서울 밖 좌표(김포)는 거부", async () => {
    await expect(submitReport({ ...input(), lat: 37.6, lng: 126.77 }, NOW)).rejects.toThrow(
      "outside seoul",
    );
  });
});
