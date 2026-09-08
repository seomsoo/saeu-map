import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTO_HIDE_REPORT_COUNT,
  MAX_PHOTO_BYTES,
  MAX_PLACE_PHOTOS,
  MOCK_FAILURE_RATE,
  MOCK_WRITE_DELAY_MS,
  STATION_NEARBY_MAX_M,
  checkIn,
  deleteAccount,
  deleteReview,
  flagPlace,
  getBookmarkedPlaceIds,
  getCheckins,
  getEventCard,
  getGuOfPoint,
  getMyReports,
  getMyReviews,
  getPlaceById,
  getPlaceDetail,
  getAdminStats,
  getPlaceEdits,
  getReports,
  getPlaces,
  getReviews,
  getSeasonStats,
  getSession,
  addPlacePhotos,
  confirmPlace,
  deletePlace,
  reportPhoto,
  reportPlace,
  resolveReport,
  revertPlaceEdit,
  searchPlacesForAdmin,
  setAdmin,
  setPlaceHidden,
  signInWithKakao,
  signOut,
  submitOwnerRequest,
  submitReport,
  submitReview,
  submitSuggestion,
  setBookmark,
  updateNickname,
  updateReview,
  type OwnerRequestInput,
  type ReportInput,
  type ReviewInput,
} from "../data";
import { ratingSummary } from "../reviews";
import { formatKstDate, isInactive, kstDayIndex } from "../time";
import type { Place } from "../types";

/** 목 쓰기(400ms) 완료까지 가짜 타이머를 돌린다. 거부는 핸들러를 먼저 붙인 뒤 돌린다(unhandled rejection 방지). */
async function settle<T>(pending: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(MOCK_WRITE_DELAY_MS);
  return pending;
}
async function settleReject(pending: Promise<unknown>, message?: string): Promise<void> {
  const assertion = message ? expect(pending).rejects.toThrow(message) : expect(pending).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(MOCK_WRITE_DELAY_MS);
  await assertion;
}

/** 사이드 기본값 — 이 파일의 제보·제안 입력이 공유한다. */
const SIDES = { headButter: true, ramen: false, friedRice: false } as const;

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
    // href는 설정값이고 없을 수 있다 — 지금은 링크할 곳이 없어 null이다(까주기 테스트는 Phase 7)
    expect(await getEventCard("2026-09-01T12:00:00+09:00")).toMatchObject({
      title: "새우 까주기 테스트",
      href: null,
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
    // 평점은 리뷰에서 읽을 때마다 집계해 붙이므로 매번 새 객체다 — 값이 같은지로 본다
    expect(await getPlaceById("p018", NOW)).toEqual(updated);
    expect(updated.rating).toEqual(before.rating);
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

describe("setBookmark — 목 쓰기 (400ms 지연, 10% 실패)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.99); // 성공 경로
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("원하는 상태를 그대로 쓴다(멱등) — 같은 값을 두 번 보내도 결과가 같다", async () => {
    expect(await settle(setBookmark("p018", true))).toEqual(["p018"]);
    expect(await getBookmarkedPlaceIds()).toEqual(["p018"]);
    expect(await settle(setBookmark("p018", false))).toEqual([]);
  });

  it("검증은 지연 전에 — 빈 id·없는 가게는 400ms를 기다리지 않고 거부한다", async () => {
    // 검증이 simulateWrite 뒤에 있으면 낙관 업데이트가 400ms 뒤에야 롤백된다
    await expect(setBookmark("", true)).rejects.toThrow();
    await expect(setBookmark("nonexistent", true)).rejects.toThrow("place not found");
    await expect(setBookmark("p108", true)).rejects.toThrow("place not found");
    expect(await getBookmarkedPlaceIds()).toEqual([]);
  });

  it("행위자는 지연 전에 잡는다 — 쓰기 도중 로그아웃해도 이전 사용자의 찜에 쓴다", async () => {
    const before = await getSession();
    const pending = setBookmark("p018", true);
    // 400ms가 흐르는 사이 세션이 바뀐다(로그아웃 = 새 익명)
    const nextSession = await signOut();
    expect(nextSession.userId).not.toBe(before.userId);
    await settle(pending);
    // 새 익명 사용자의 찜은 비어 있어야 한다 — 이전 요청이 넘어오면 안 된다
    expect(await getBookmarkedPlaceIds()).toEqual([]);
  });

  it("실패(10%)면 찜은 그대로 — 화면이 롤백할 수 있게 reject한다", async () => {
    vi.spyOn(Math, "random").mockReturnValue(MOCK_FAILURE_RATE / 2);
    await settleReject(setBookmark("p018", true));
    expect(await getBookmarkedPlaceIds()).toEqual([]);
  });
});

describe("getGuOfPoint", () => {
  it("서울은 구, 서울 밖은 '시군구(시도)', 한국 밖은 null", async () => {
    expect(await getGuOfPoint({ lat: 37.5571, lng: 126.9245 })).toBe("마포구");
    expect(await getGuOfPoint({ lat: 37.6, lng: 126.77 })).toBe("김포시(경기)");
    expect(await getGuOfPoint({ lat: 36.0, lng: 125.0 })).toBeNull();
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
    naverPlaceUrl: "",
  });
  const image = (name: string) => new File(["x"], name, { type: "image/jpeg" });

  beforeAll(async () => {
    // 경계 JSON(서울·전국) 동적 import를 가짜 타이머 밖에서 미리 끝낸다 (gu.ts가 캐시한다)
    await getGuOfPoint({ lat: 37.5571, lng: 126.9245 });
    await getGuOfPoint({ lat: 37.6, lng: 126.77 });
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
    // 고른 두 장이 그대로 새 가게의 스트립·대표가 된다 (2026-09-08 — 그전엔 버려졌다)
    expect(place.photos).toHaveLength(2);
    expect(place.thumbnailUrl).toBe(place.photos[0]?.url);
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
    expect(place.photos).toEqual([]);
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

  it("서울 밖(김포)도 등록되고 구 라벨은 '김포시(경기)', 한국 밖(바다)은 거부", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const pending = submitReport({ ...input(), lat: 37.6, lng: 126.77 }, NOW);
    await vi.advanceTimersByTimeAsync(MOCK_WRITE_DELAY_MS);
    expect((await pending).gu).toBe("김포시(경기)");
    await expect(submitReport({ ...input(), lat: 36.0, lng: 125.0 }, NOW)).rejects.toThrow(
      "outside korea",
    );
  });
});

/* ── Phase 4: 세션·찜(사용자별)·리뷰 쓰기·달라요. 세션은 모듈 상태라 각 테스트 끝에 로그아웃한다. ── */

const reportInput = (): ReportInput => ({
  name: "내가 제보한 집",
  lat: 37.5571,
  lng: 126.9245,
  menus: [{ name: "왕새우 소금구이", price: 35000, unit: "kg", unitRaw: "1", raw: false }],
  sides: { headButter: false, ramen: false, friedRice: false },
  hoursNote: "",
  photos: [],
  duplicateOf: null,
  naverPlaceUrl: "",
});

describe("세션 — 익명 기본, 카카오 로그인 승계, 로그아웃·닉네임", () => {
  const NOW = "2030-02-02T12:00:00+09:00";

  beforeAll(async () => {
    await getGuOfPoint({ lat: 37.5571, lng: 126.9245 });
  });
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.99);
  });
  afterEach(async () => {
    await signOut();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("기본은 익명 — 닉네임 없음, 찜 없음", async () => {
    const session = await getSession();
    expect(session.provider).toBe("anonymous");
    expect(session.nickname).toBeNull();
    expect(session.userId).toMatch(/^anon-local-/);
    expect(await getBookmarkedPlaceIds()).toEqual([]);
  });

  it("카카오 로그인: 익명의 찜·제보·확인이 카카오 id로 넘어온다 (linkIdentity)", async () => {
    const anonymous = await getSession();
    await settle(setBookmark("p018", true));
    await settle(checkIn("p041", NOW));
    const created = await settle(submitReport(reportInput(), NOW));
    expect(created.reporterId).toBe(anonymous.userId);

    const session = await settle(signInWithKakao());
    expect(session).toEqual({ userId: "u-kakao-1", provider: "kakao", nickname: "새우헌터" });
    expect(await getSession()).toBe(session);
    expect(await getBookmarkedPlaceIds()).toEqual(["p018"]);
    expect((await getMyReports(NOW)).map((p) => p.id)).toEqual([created.id]);
    expect((await getPlaceById(created.id, NOW))?.reporterId).toBe("u-kakao-1");
    const mine = (await getCheckins("p041", NOW)).filter((c) => c.actor === "u-kakao-1");
    expect(mine).toHaveLength(1);
    // 목 리뷰 2건의 작성자라 내 리뷰가 바로 보인다
    const reviews = await getMyReviews(NOW);
    expect(reviews.map((r) => r.nickname)).toEqual(["새우헌터", "새우헌터"]);
    expect(reviews[0]?.placeName).toBeTruthy();
    // 이미 카카오면 지연 없이 같은 세션
    expect(await signInWithKakao()).toBe(session);
  });

  it("로그인 실패(10%)면 익명 그대로, 찜도 그대로", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.05);
    // 찜은 성공 경로로 넣어 두고(로그인만 실패시킨다) 승계 여부를 본다
    vi.spyOn(Math, "random").mockReturnValueOnce(0.99);
    await settle(setBookmark("p018", true));
    const before = await getSession();
    await settleReject(signInWithKakao());
    expect(await getSession()).toBe(before);
    expect(await getBookmarkedPlaceIds()).toEqual(["p018"]);
  });

  it("로그아웃은 새 익명 — 찜은 기기 한정이라 비고, 다시 로그인하면 카카오 찜이 돌아온다", async () => {
    await settle(signInWithKakao());
    await settle(setBookmark("p041", true));
    const anonymous = await signOut();
    expect(anonymous.provider).toBe("anonymous");
    expect(await getBookmarkedPlaceIds()).toEqual([]);
    expect(await getMyReviews(NOW)).toEqual([]);
    await settle(signInWithKakao());
    expect(await getBookmarkedPlaceIds()).toContain("p041");
    await settle(setBookmark("p041", true)); // 다음 테스트를 위해 되돌린다
  });

  it("닉네임: 2~12자, 카카오만, 이미 쓴 리뷰의 표시 이름도 바뀌고 재로그인해도 남는다", async () => {
    await expect(updateNickname("새우왕")).rejects.toThrow("login required");
    await settle(signInWithKakao());
    await expect(updateNickname(" 새 ")).rejects.toThrow();
    await expect(updateNickname("열세글자가넘는닉네임입니다요")).rejects.toThrow();
    // 폭 없는 공백·방향 제어문자·기호는 거부, 전각은 NFKC로 반각이 된다
    await expect(updateNickname("\u200b\u200b")).rejects.toThrow();
    await expect(updateNickname("새우헌터\u202e")).rejects.toThrow();
    await expect(updateNickname("새우<b>")).rejects.toThrow();
    expect((await settle(updateNickname("ｓｈｒｉｍｐ"))).nickname).toBe("shrimp");
    const session = await settle(updateNickname(" 새우왕 "));
    expect(session.nickname).toBe("새우왕");
    expect((await getMyReviews(NOW)).every((r) => r.nickname === "새우왕")).toBe(true);
    await signOut();
    expect((await settle(signInWithKakao())).nickname).toBe("새우왕");
    await settle(updateNickname("새우헌터"));
  });
});

describe("리뷰 쓰기 — 카카오 필수, 확인일 갱신, 본인 수정·삭제(소프트)", () => {
  const NOW = "2030-03-03T12:00:00+09:00";
  const input = (overrides: Partial<ReviewInput> = {}): ReviewInput => ({
    placeId: "p004",
    rating: 4,
    text: " 새우가 실했어요 ",
    photo: null,
    ...overrides,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.99);
  });
  afterEach(async () => {
    await signOut();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("익명은 등록·수정·삭제 전부 거부 (지연 없이)", async () => {
    await expect(submitReview(input(), NOW)).rejects.toThrow("login required");
    await expect(updateReview("rv001", { rating: 3, text: "" }, NOW)).rejects.toThrow("forbidden");
    await expect(deleteReview("rv001")).rejects.toThrow("forbidden");
  });

  it("등록: 리뷰가 상세 맨 앞에, 확인일 = now·확인 +1·checkin", async () => {
    await settle(signInWithKakao());
    const before = await getPlaceById("p004", NOW);
    if (!before) throw new Error("no place");
    const { review, place } = await settle(
      submitReview(input({ photo: new File(["x"], "a.jpg", { type: "image/jpeg" }) }), NOW),
    );
    const at = new Date(Date.parse(NOW)).toISOString();
    expect(review).toMatchObject({
      placeId: "p004",
      authorId: "u-kakao-1",
      rating: 4,
      text: "새우가 실했어요",
      nickname: "새우헌터",
      at,
    });
    expect(review.id).toMatch(/^rv-local-\d+$/);
    // 고른 사진이 리뷰 행 썸네일이 된다 (2026-09-08 — 그전엔 버려졌다)
    expect(review.photoUrl).toMatch(/^blob:/);
    expect(place).toMatchObject({ checkCount: before.checkCount + 1, lastCheckedAt: at });
    expect(await getPlaceById("p004", NOW)).toBe(place);
    expect((await getPlaceDetail("p004", NOW))?.reviews[0]).toBe(review);
    expect((await getCheckins("p004", NOW)).at(-1)).toMatchObject({ actor: "u-kakao-1", at });
    expect((await getMyReviews(NOW))[0]).toMatchObject({ id: review.id, placeName: before.name });
  });

  it("검증: 별점 0·6·소수, 501자, 이미지 아닌 파일, 없는 가게", async () => {
    await settle(signInWithKakao());
    for (const bad of [
      input({ rating: 0 }),
      input({ rating: 6 }),
      input({ rating: 4.5 }),
      input({ text: "가".repeat(501) }),
      input({ photo: new File(["x"], "a.txt", { type: "text/plain" }) }),
    ]) {
      await expect(submitReview(bad, NOW)).rejects.toThrow();
    }
    await settleReject(submitReview(input({ placeId: "nonexistent" }), NOW), "place not found");
  });

  it("실패(10%): 등록되지 않고 가게도 그대로", async () => {
    await settle(signInWithKakao());
    vi.spyOn(Math, "random").mockReturnValue(0.05);
    const before = await getPlaceById("p004", NOW);
    const count = (await getReviews("p004", NOW)).length;
    await settleReject(submitReview(input(), NOW));
    expect(await getPlaceById("p004", NOW)).toBe(before);
    expect(await getReviews("p004", NOW)).toHaveLength(count);
  });

  it("수정: 본인만, editedAt 기록, 남의 리뷰는 forbidden", async () => {
    await settle(signInWithKakao());
    // 등록 테스트가 이미 p004에 남겼다 — 핀당 1개라 다른 가게에 쓴다
    const { review } = await settle(submitReview(input({ placeId: "p041" }), NOW));
    const updated = await settle(updateReview(review.id, { rating: 5, text: " 고쳤어요 " }, NOW));
    expect(updated).toMatchObject({ id: review.id, rating: 5, text: "고쳤어요" });
    expect(updated.editedAt).toBe(new Date(Date.parse(NOW)).toISOString());
    expect((await getPlaceDetail("p041", NOW))?.reviews.find((r) => r.id === review.id)).toBe(updated);
    // 남의 리뷰(rv003 성수사람)
    await expect(updateReview("rv003", { rating: 1, text: "" }, NOW)).rejects.toThrow("forbidden");
    await expect(updateReview(review.id, { rating: 9, text: "" }, NOW)).rejects.toThrow();
  });

  it("삭제: 소프트 — 상세·목록·내 리뷰·평균에서 빠지고 확인 기록은 남는다, 두 번 삭제·남의 리뷰는 거부", async () => {
    await settle(signInWithKakao());
    // 목 카카오 유저가 p018에 이미 가진 리뷰(rv004) — 핀당 1개라 새로 쓰지 않고 그걸 지운다
    const review = { id: "rv004" };
    const withMine = ratingSummary((await getPlaceDetail("p018", NOW))?.reviews ?? []);
    const checkins = (await getCheckins("p018", NOW)).length;
    await settle(deleteReview(review.id));
    const detail = await getPlaceDetail("p018", NOW);
    expect(detail?.reviews.some((r) => r.id === review.id)).toBe(false);
    expect((await getReviews("p018", NOW)).some((r) => r.id === review.id)).toBe(false);
    expect((await getMyReviews(NOW)).some((r) => r.id === review.id)).toBe(false);
    expect(ratingSummary(detail?.reviews ?? []).average).not.toBe(withMine.average);
    expect(await getCheckins("p018", NOW)).toHaveLength(checkins);
    await expect(deleteReview(review.id)).rejects.toThrow("forbidden");
    await expect(deleteReview("rv003")).rejects.toThrow("forbidden");
  });
});

describe("리뷰는 핀당 1개 (spec 5 스팸 4겹 2 — 두 번째는 수정)", () => {
  const NOW = "2030-03-04T12:00:00+09:00";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.99);
  });
  afterEach(async () => {
    await signOut();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("이미 내 리뷰가 있는 가게면 지연 없이 거부하고, 그 리뷰를 지우면 다시 쓸 수 있다", async () => {
    await settle(signInWithKakao());
    const input = { placeId: "p162", rating: 4, text: "", photo: null };
    // 목 카카오 유저는 p162에 이미 리뷰가 있다(rv001)
    await expect(submitReview(input, NOW)).rejects.toThrow("already reviewed");
    await settle(deleteReview("rv001"));
    const { review } = await settle(submitReview(input, NOW));
    expect(review.placeId).toBe("p162");
    // 두 번째는 다시 거부
    await expect(submitReview(input, NOW)).rejects.toThrow("already reviewed");
    await settle(deleteReview(review.id));
  });

  it("남이 쓴 리뷰는 상관없다 (같은 가게에 남의 리뷰만 있으면 쓸 수 있다)", async () => {
    await settle(signInWithKakao());
    // p019에는 남의 리뷰(성수부두단골)만 있다 — 내 리뷰만 판정에 쓰인다
    const { review } = await settle(
      submitReview({ placeId: "p019", rating: 5, text: "", photo: null }, NOW),
    );
    expect(review.authorId).toBe("u-kakao-1");
    await settle(deleteReview(review.id));
  });
});

describe("flagPlace — [정보가 달라요] (목 쓰기)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("성공은 400ms 뒤 resolve, 실패는 reject, 검증 실패는 지연 없이 거부", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    await expect(settle(flagPlace({ placeId: "p019", reason: "closed" }))).resolves.toBeUndefined();
    vi.spyOn(Math, "random").mockReturnValue(0.05);
    await settleReject(flagPlace({ placeId: "p019", reason: "menu" }));
    await expect(flagPlace({ placeId: "", reason: "other" })).rejects.toThrow();
    await expect(flagPlace({ placeId: "p019", reason: "nope" as never })).rejects.toThrow();
  });
});

describe("submitSuggestion — 값 제안 (즉시 반영 + 이력)", () => {
  // 다른 테스트의 데이터셋을 건드리지 않도록 별도 날짜
  const NOW = "2032-06-06T12:00:00+09:00";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.99);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("영업시간·주소·사이드는 그 자리에서 바뀌고 조회에도 바로 보인다", async () => {
    const target = (await getPlaces({}, NOW))[0];
    if (!target) throw new Error("no place");
    const hours = await settle(
      submitSuggestion({ field: "hours", placeId: target.id, hoursNote: "23:00 라스트오더" }, NOW),
    );
    expect(hours.hoursNote).toBe("23:00 라스트오더");
    expect(await getPlaceById(target.id, NOW)).toBe(hours);

    const address = await settle(
      submitSuggestion(
        { field: "address", placeId: target.id, addressRoad: "서울 마포구 마포대로12길 34" },
        NOW,
      ),
    );
    expect(address.addressRoad).toBe("서울 마포구 마포대로12길 34");
    // 지번은 건드리지 않는다 — 사용자가 준 건 도로명뿐이다
    expect(address.addressJibun).toBe(target.addressJibun);

    const sides = await settle(
      submitSuggestion(
        { field: "sides", placeId: target.id, sides: { headButter: true, ramen: true, friedRice: true } },
        NOW,
      ),
    );
    expect(sides.sides).toEqual({ headButter: true, ramen: true, friedRice: true });
  });

  it("메뉴는 가격 교체·삭제를 원래 인덱스로 한 번에 하고 추가 줄은 뒤에 붙는다", async () => {
    const target = (await getPlaces({}, NOW)).find((p) => p.menus.length >= 3);
    if (!target) throw new Error("no place with 3+ menus");
    const [first, , third] = target.menus;
    const place = await settle(
      submitSuggestion(
        {
          field: "menus",
          placeId: target.id,
          edits: [
            { index: 0, name: first?.name ?? "", price: 32_000, removed: false },
            { index: 2, name: third?.name ?? "", removed: true },
          ],
          added: [{ name: "새우튀김", price: 15_000, unit: "pan", unitRaw: "한판", raw: false }],
        },
        NOW,
      ),
    );
    expect(place.menus).toHaveLength(target.menus.length - 1 + 1);
    expect(place.menus[0]).toMatchObject({ name: first?.name, price: 32_000 });
    // 삭제한 줄은 빠지고, 그 뒤 줄의 가격이 밀려 바뀌지 않는다
    expect(place.menus.some((m) => m.name === third?.name)).toBe(false);
    expect(place.menus.at(-1)).toEqual({
      raw: "새우튀김",
      name: "새우튀김",
      price: 15_000,
      unit: "pan",
      unit_raw: "한판",
    });
    // 구이/회 태그는 건드리지 않는다 — 사후 확인에서 운영자가 정한다
    expect(place.tags).toEqual(target.tags);
  });

  it("파생 평점을 얹어 돌려준다 — 안 그러면 고칠 때마다 별점이 사라진다", async () => {
    /*
     * 평점은 리뷰 3개 이상일 때만 붙는다(spec 4.2-8). 앞선 테스트가 목 리뷰를 지웠을 수 있어
     * **이 테스트가 조건을 직접 만든다** — 픽스처 상태에 기대면 순서에 따라 조용히 무의미해진다.
     */
    await settle(signInWithKakao());
    await settle(submitReview({ placeId: "p018", rating: 5, text: "", photo: null }, NOW));
    const rated = await getPlaceById("p018", NOW);
    expect(rated?.rating).toBeDefined();

    const after = await settle(
      submitSuggestion({ field: "hours", placeId: "p018", hoursNote: "밤 11시까지" }, NOW),
    );
    // 쓰기 응답이 읽기와 같은 모양이어야 한다 — 호출자가 이걸로 통째로 갈아끼운다 (Codex PR #11 #2)
    expect(after.rating).toEqual(rated?.rating);
    expect(after).toEqual(await getPlaceById("p018", NOW));

    vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:rating.jpg");
    const withPhoto = await settle(
      addPlacePhotos("p018", [new File(["x"], "rating.jpg", { type: "image/jpeg" })], NOW),
    );
    expect(withPhoto.rating).toEqual(rated?.rating);
    await signOut();
  });

  it("되돌릴 수 있게 이전 값이 이력에 남는다 (즉시 반영의 전제)", async () => {
    const target = (await getPlaces({}, NOW)).find((p) => p.hoursNote !== null);
    if (!target) throw new Error("no place with hours");
    await settle(submitSuggestion({ field: "hours", placeId: target.id, hoursNote: "새벽 3시까지" }, NOW));
    const [latest] = await getPlaceEdits();
    expect(latest).toMatchObject({ placeId: target.id, field: "hours" });
    expect(latest?.before.hoursNote).toBe(target.hoursNote);
    expect(latest?.actor).toMatch(/^anon-/);
    expect(latest?.at).toBe(new Date(Date.parse(NOW)).toISOString());
  });

  it("실패는 reject하고 값도 그대로, 검증 실패는 지연도 타지 않는다", async () => {
    const target = (await getPlaces({}, NOW))[0];
    if (!target) throw new Error("no place");
    vi.spyOn(Math, "random").mockReturnValue(MOCK_FAILURE_RATE / 2);
    await settleReject(
      submitSuggestion({ field: "hours", placeId: target.id, hoursNote: "월 휴무" }, NOW),
    );
    expect((await getPlaceById(target.id, NOW))?.hoursNote).not.toBe("월 휴무");

    await expect(
      submitSuggestion({ field: "hours", placeId: target.id, hoursNote: "  " }, NOW),
    ).rejects.toThrow();
    await expect(
      submitSuggestion({ field: "address", placeId: target.id, addressRoad: "가" }, NOW),
    ).rejects.toThrow();
    // 아무것도 안 고친 제안은 거부한다
    await expect(
      submitSuggestion({ field: "menus", placeId: target.id, edits: [], added: [] }, NOW),
    ).rejects.toThrow();
    await expect(
      submitSuggestion({ field: "sides", placeId: "", sides: SIDES } as never, NOW),
    ).rejects.toThrow();
    // 없는 가게는 지연을 통과한 뒤 걸린다 — 실패 주입을 풀고 확인한다
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    await settleReject(
      submitSuggestion({ field: "hours", placeId: "nope", hoursNote: "밤 12시" }, NOW),
      "place not found",
    );
  });
});

describe("reportPlace — 가게 신고 (목 쓰기)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("사유 4개는 통과, 정보 수정 제안의 사유(closed)는 거부한다", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    for (const reason of ["not_shrimp", "fake", "duplicate", "other"] as const) {
      await expect(settle(reportPlace({ placeId: "p019", reason }))).resolves.toBeUndefined();
    }
    // 신고는 "이 등록이 잘못됐다", 수정 제안은 "값이 틀렸다" — 사유를 섞지 않는다
    await expect(reportPlace({ placeId: "p019", reason: "closed" as never })).rejects.toThrow();
    await expect(reportPlace({ placeId: "", reason: "fake" })).rejects.toThrow();
  });

  it("실패는 reject", async () => {
    vi.spyOn(Math, "random").mockReturnValue(MOCK_FAILURE_RATE / 2);
    await settleReject(reportPlace({ placeId: "p019", reason: "duplicate" }));
  });
});

describe("submitOwnerRequest — 사장님 요청 (목 쓰기)", () => {
  const request = (overrides: Partial<OwnerRequestInput> = {}): OwnerRequestInput => ({
    placeId: "p019",
    kind: "edit",
    contact: "owner@example.com",
    message: "영업시간이 바뀌었어요",
    ...overrides,
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("정보 수정·게재 삭제 둘 다 접수, 내용은 비어도 된다", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    await expect(settle(submitOwnerRequest(request()))).resolves.toBeUndefined();
    await expect(
      settle(submitOwnerRequest(request({ kind: "remove", message: "" }))),
    ).resolves.toBeUndefined();
  });

  it("연락처는 필수 — 없거나 너무 짧으면 지연 없이 거부한다(24시간 내 회신이 성립해야 한다)", async () => {
    await expect(submitOwnerRequest(request({ contact: "" }))).rejects.toThrow();
    await expect(submitOwnerRequest(request({ contact: "  a " }))).rejects.toThrow();
    await expect(submitOwnerRequest(request({ message: "가".repeat(301) }))).rejects.toThrow();
    await expect(submitOwnerRequest(request({ kind: "delete" as never }))).rejects.toThrow();
  });
});

describe("사진 보관 — 상세 업로드·제보·리뷰", () => {
  const NOW = "2031-02-02T12:00:00+09:00";
  const image = (name: string) => new File(["x"], name, { type: "image/jpeg" });

  beforeEach(() => {
    // jsdom의 blob URL은 값이 무작위다 — 어떤 파일이 어디로 갔는지 보려고 예측 가능하게 고정한다
    vi.spyOn(URL, "createObjectURL").mockImplementation((file) => `blob:${(file as File).name}`);
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.99);
  });
  afterEach(async () => {
    await signOut();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("첫 장이 올라가면 스트립과 대표 썸네일이 같이 생기고, 조회에도 바로 보인다", async () => {
    const empty = (await getPlaces({}, NOW)).find((p) => p.photos.length === 0);
    if (!empty) throw new Error("no photo-less place");
    const place = await settle(addPlacePhotos(empty.id, [image("a.jpg")], NOW));
    expect(place.photos).toHaveLength(1);
    expect(place.photos[0]?.url).toBe("blob:a.jpg");
    expect(place.photos[0]?.uploadedAt).toBe(new Date(Date.parse(NOW)).toISOString());
    expect(place.thumbnailUrl).toBe("blob:a.jpg");
    expect(await getPlaceById(empty.id, NOW)).toBe(place);
  });

  it("남은 자리만큼만 채우고, 10장이 차 있으면 거부한다", async () => {
    const target = (await getPlaces({}, NOW)).find(
      (p) => p.photos.length > 0 && p.photos.length < MAX_PLACE_PHOTOS,
    );
    if (!target) throw new Error("no partially filled place");
    const room = MAX_PLACE_PHOTOS - target.photos.length;
    // 남은 자리보다 많이 고른다 — 한 번에 보낼 수 있는 상한(10장)은 넘지 않는다
    const files = Array.from({ length: Math.min(room + 2, MAX_PLACE_PHOTOS) }, (_, i) =>
      image(`${String(i)}.jpg`),
    );
    const place = await settle(addPlacePhotos(target.id, files, NOW));
    expect(place.photos).toHaveLength(MAX_PLACE_PHOTOS);
    // 대표는 원래 첫 장 그대로 — 나중에 올린 사진이 썸네일을 빼앗지 않는다
    expect(place.thumbnailUrl).toBe(target.photos[0]?.url);
    await settleReject(addPlacePhotos(target.id, [image("z.jpg")], NOW), "photo limit reached");
  });

  it("10MB를 넘는 사진은 지연 없이 거부한다 (blob을 revoke하지 않고 들고 있어서다)", async () => {
    const big = image("big.jpg");
    // 실제로 10MB를 만들면 테스트가 느려진다 — 크기만 크게 속인다
    Object.defineProperty(big, "size", { value: MAX_PHOTO_BYTES + 1 });
    await expect(addPlacePhotos("p019", [big], NOW)).rejects.toThrow();
  });

  it("검증: 이미지가 아니거나 빈 목록·11장·없는 가게는 거부한다", async () => {
    await expect(
      addPlacePhotos("p019", [new File(["x"], "a.txt", { type: "text/plain" })], NOW),
    ).rejects.toThrow();
    await expect(addPlacePhotos("p019", [], NOW)).rejects.toThrow();
    await expect(
      addPlacePhotos(
        "p019",
        Array.from({ length: MAX_PLACE_PHOTOS + 1 }, (_, i) => image(`${String(i)}.jpg`)),
        NOW,
      ),
    ).rejects.toThrow();
    await settleReject(addPlacePhotos("nope", [image("a.jpg")], NOW), "place not found");
  });

  it("제보로 고른 사진이 순서 그대로 새 가게의 스트립·대표가 된다", async () => {
    const place = await settle(
      submitReport(
        {
          name: "사진 있는 제보",
          lat: 37.5571,
          lng: 126.9245,
          menus: [{ name: "왕새우 소금구이", price: 35000, unit: "kg", unitRaw: "1", raw: false }],
          sides: SIDES,
          hoursNote: "",
          photos: [image("first.jpg"), image("second.jpg")],
          duplicateOf: null,
          naverPlaceUrl: "",
        },
        NOW,
      ),
    );
    expect(place.photos.map((photo) => photo.url)).toEqual(["blob:first.jpg", "blob:second.jpg"]);
    expect(place.thumbnailUrl).toBe("blob:first.jpg");
  });

  it("리뷰로 고른 사진이 photoUrl이 된다", async () => {
    await settle(signInWithKakao());
    const { review } = await settle(
      submitReview({ placeId: "p004", rating: 5, text: "", photo: image("review.jpg") }, NOW),
    );
    expect(review.photoUrl).toBe("blob:review.jpg");
  });
});

describe("관리자 — 신고·요청 저장, 권한, 사후 확인·숨김·되돌리기", () => {
  const NOW = "2033-07-07T12:00:00+09:00";

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    await setAdmin(false);
  });
  afterEach(async () => {
    await setAdmin(false);
    await signOut();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("네 입구가 모두 신고·요청 목록에 쌓인다 (그전엔 검증만 하고 버렸다)", async () => {
    const before = (await getReports()).length;
    await settle(flagPlace({ placeId: "p019", reason: "closed" }));
    await settle(reportPlace({ placeId: "p019", reason: "duplicate" }));
    await settle(reportPhoto({ placeId: "p018", photoId: "p018-p1", reason: "spam" }));
    await settle(
      submitOwnerRequest({
        placeId: "p019",
        kind: "remove",
        contact: "owner@example.com",
        message: "폐업했습니다",
      }),
    );
    const rows = await getReports();
    expect(rows).toHaveLength(before + 4);
    // 최신순
    expect(rows[0]).toMatchObject({ kind: "owner_request", ownerKind: "remove", contact: "owner@example.com", status: "open" });
    expect(rows.slice(0, 4).map((r) => r.kind)).toEqual([
      "owner_request",
      "photo_report",
      "place_report",
      "place_flag",
    ]);
    expect(await getReports({ kind: "place_flag" })).toHaveLength(
      (await getReports()).filter((r) => r.kind === "place_flag").length,
    );
  });

  it("신고 3회 자동 숨김은 **사람 기준**이다 — 혼자 세 번은 안 숨긴다", async () => {
    const target = (await getPlaces({}, NOW)).find((p) => p.id === "p012") ?? (await getPlaces({}, NOW))[0];
    if (!target) throw new Error("no place");
    for (let i = 0; i < AUTO_HIDE_REPORT_COUNT + 1; i += 1) {
      await settle(reportPlace({ placeId: target.id, reason: "fake" }));
    }
    expect((await getPlaces({}, NOW)).some((p) => p.id === target.id)).toBe(true);

    // 서로 다른 사람 셋이면 숨는다
    for (let i = 0; i < AUTO_HIDE_REPORT_COUNT; i += 1) {
      await signOut(); // 새 익명 id
      await settle(reportPlace({ placeId: target.id, reason: "fake" }));
    }
    expect((await getPlaces({}, NOW)).some((p) => p.id === target.id)).toBe(false);
    expect(await getPlaceById(target.id, NOW)).toBeUndefined();
    expect(await getPlaceDetail(target.id, NOW)).toBeUndefined();
    // 관리자 검색에는 보인다 — 복구하려면 찾을 수 있어야 한다
    expect((await searchPlacesForAdmin(target.name, NOW)).some((p) => p.id === target.id)).toBe(true);

    await setAdmin(true);
    const restored = await settle(setPlaceHidden(target.id, false, NOW));
    expect("hiddenAt" in restored).toBe(false);
    expect((await getPlaces({}, NOW)).some((p) => p.id === target.id)).toBe(true);
  });

  it("쓰기는 관리자만 — 프론트 게이트를 우회해도 여기서 막힌다", async () => {
    await expect(resolveReport("rp-local-1", "done")).rejects.toThrow("forbidden");
    await expect(confirmPlace("p019", NOW)).rejects.toThrow("forbidden");
    await expect(setPlaceHidden("p019", true, NOW)).rejects.toThrow("forbidden");
    await expect(revertPlaceEdit("ed-local-1", NOW)).rejects.toThrow("forbidden");
    await expect(deletePlace("p019", NOW)).rejects.toThrow("forbidden");
  });

  it("[확인]은 배지만 찍는다 — '새로 제보됨'(isNew)은 그대로다", async () => {
    await setAdmin(true);
    const reported = await settle(
      submitReport(
        {
          name: "확인 대상 새우집",
          lat: 37.5571,
          lng: 126.9245,
          menus: [{ name: "왕새우 소금구이", price: 35000, unit: "kg", unitRaw: "1", raw: false }],
          sides: SIDES,
          hoursNote: "",
          photos: [],
          duplicateOf: null,
          naverPlaceUrl: "",
        },
        NOW,
      ),
    );
    expect(reported.isNew).toBe(true);
    expect(reported.verifiedAt).toBeUndefined();
    const confirmed = await settle(confirmPlace(reported.id, NOW));
    expect(confirmed.verifiedAt).toBe(new Date(Date.parse(NOW)).toISOString());
    // 라벨은 정보지 검증 표시가 아니다 (decisions 2026-09-08)
    expect(confirmed.isNew).toBe(true);
  });

  it("되돌리기는 대칭이다 — 되돌린 것도 이력에 남아 다시 되돌릴 수 있다", async () => {
    const target = (await getPlaces({}, NOW)).find((p) => p.hoursNote !== null);
    if (!target) throw new Error("no place with hours");
    const original = target.hoursNote;
    await settle(submitSuggestion({ field: "hours", placeId: target.id, hoursNote: "새벽 4시까지" }, NOW));
    expect((await getPlaceById(target.id, NOW))?.hoursNote).toBe("새벽 4시까지");

    await setAdmin(true);
    const [edit] = await getPlaceEdits();
    if (!edit) throw new Error("no edit");
    const reverted = await settle(revertPlaceEdit(edit.id, NOW));
    expect(reverted.hoursNote).toBe(original);

    // 되돌린 것도 이력이다 → 다시 되돌리면 원래 제안 값으로 간다
    const [latest] = await getPlaceEdits();
    expect(latest?.id).not.toBe(edit.id);
    expect(latest?.before.hoursNote).toBe("새벽 4시까지");
    const again = await settle(revertPlaceEdit(latest?.id ?? "", NOW));
    expect(again.hoursNote).toBe("새벽 4시까지");
  });

  it("삭제는 소프트다 — 기록이 남아야 재제보 때 경고할 수 있다", async () => {
    await setAdmin(true);
    const target = (await getPlaces({}, NOW))[0];
    if (!target) throw new Error("no place");
    const removed = await settle(deletePlace(target.id, NOW, true));
    expect(removed.hiddenAt).toBeTruthy();
    expect(removed.removedByOwner).toBe(true);
    expect((await getPlaces({}, NOW)).some((p) => p.id === target.id)).toBe(false);
    // 데이터는 남아 있다
    expect((await searchPlacesForAdmin(target.name, NOW)).some((p) => p.id === target.id)).toBe(true);
  });

  it("통계는 우리 DB로 셀 수 있는 것만 — 14일 버킷과 숙제 수", async () => {
    const stats = await getAdminStats(NOW);
    expect(stats.daily).toHaveLength(14);
    expect(stats.daily.at(-1)?.date).toBe(formatKstDate(NOW));
    expect(stats.today).toEqual(stats.daily.at(-1));
    expect(stats.openReports).toBe((await getReports({ status: "open" })).length);
    expect(stats.topPlaces.length).toBeLessThanOrEqual(10);
    // 확인 많은 순
    const counts = stats.topPlaces.map((p) => p.checkCount);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
    expect(stats.participants.anonymous + stats.participants.kakao).toBeGreaterThanOrEqual(0);
  });

  it("처리함·무시함은 원하는 상태를 받는다 (토글이 아니다)", async () => {
    await settle(flagPlace({ placeId: "p019", reason: "menu" }));
    const [row] = await getReports();
    if (!row) throw new Error("no report");
    await setAdmin(true);
    expect((await settle(resolveReport(row.id, "done"))).status).toBe("done");
    // 같은 값을 다시 보내도 뒤집히지 않는다 (멱등)
    expect((await settle(resolveReport(row.id, "done"))).status).toBe("done");
    expect((await settle(resolveReport(row.id, "dismissed"))).status).toBe("dismissed");
    await settleReject(resolveReport("nope", "done"), "report not found");
  });
});

/* 탈퇴는 목 카카오 유저의 리뷰를 영구히 지우므로 이 파일의 맨 마지막이다. */
describe("탈퇴 — 내 리뷰·찜 삭제, 제보 작성자 해제, 새 익명", () => {
  const NOW = "2030-04-04T12:00:00+09:00";

  beforeAll(async () => {
    await getGuOfPoint({ lat: 37.5571, lng: 126.9245 });
  });
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.99);
  });
  afterEach(async () => {
    await signOut();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("익명은 탈퇴할 수 없다", async () => {
    await expect(deleteAccount()).rejects.toThrow("login required");
  });

  it("올린 사진은 남고 업로더만 떨어진다 (제보 가게의 reporterId와 같은 규칙)", async () => {
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:mine.jpg");
    await settle(signInWithKakao());
    const target = (await getPlaces({}, NOW)).find((p) => p.photos.length < MAX_PLACE_PHOTOS);
    if (!target) throw new Error("no place with room");
    const uploaded = await settle(
      addPlacePhotos(target.id, [new File(["x"], "mine.jpg", { type: "image/jpeg" })], NOW),
    );
    const mine = uploaded.photos.at(-1);
    expect(mine?.uploaderId).toBe("u-kakao-1");

    await settle(deleteAccount());
    const after = await getPlaceById(target.id, NOW);
    const same = after?.photos.find((photo) => photo.id === mine?.id);
    // 사진은 가게 정보라 남는다 — 개인 식별자만 뗀다
    expect(same?.url).toBe(mine?.url);
    expect("uploaderId" in (same ?? {})).toBe(false);
  });

  it("탈퇴 뒤에는 내 리뷰가 화면에서 빠지고 찜은 비고 제보는 남되 작성자가 없다", async () => {
    await settle(signInWithKakao());
    await settle(setBookmark("p018", true));
    await settle(checkIn("p041", NOW));
    const created: Place = await settle(submitReport(reportInput(), NOW));
    // 앞 테스트들이 목 리뷰를 지웠을 수 있다 — 지울 내 리뷰를 여기서 직접 만든다
    await settle(submitReview({ placeId: "p045", rating: 4, text: "", photo: null }, NOW));
    const mineBefore = await getMyReviews(NOW);
    expect(mineBefore.length).toBeGreaterThan(0);

    const session = await settle(deleteAccount());
    expect(session.provider).toBe("anonymous");
    expect(await getMyReviews(NOW)).toEqual([]);
    for (const r of mineBefore) {
      expect((await getReviews(r.placeId, NOW)).some((x) => x.id === r.id)).toBe(false);
    }
    const kept = await getPlaceById(created.id, NOW);
    expect(kept).toBeDefined();
    expect(kept && "reporterId" in kept).toBe(false);
    // 확인 이벤트는 집계에 남되 개인 식별자는 뗀다
    expect((await getCheckins(undefined, NOW)).some((c) => c.actor === "u-kakao-1")).toBe(false);
    await settle(signInWithKakao());
    expect(await getBookmarkedPlaceIds()).toEqual([]);
    expect(await getMyReviews(NOW)).toEqual([]);
  });
});
