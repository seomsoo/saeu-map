import { beforeEach, describe, expect, it, vi } from "vitest";
import { expirePlace } from "../cache-tags";
import { notifyAdmin } from "../notify";
import type { Db } from "../supabase";
import { openWriteGate } from "../write-gate";
import { checkIn, reportPlace, setBookmark } from "../actions";

/**
 * 서버 액션의 계약 — 문(gate)의 실패는 그대로, DB 오류 코드는 실패 코드로, 성공은 캐시 만료·알림까지(코드 리뷰 2026-09-16 #21).
 * 권한·제한 자체는 pgTAP이 실제 역할로 본다. 여기는 그 결과를 액션이 어떻게 옮기는지만 본다.
 */
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, updateTag: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { SITE_URL: "https://xn--r02bv8jvof.kr" } }));
vi.mock("../write-gate", () => ({ openWriteGate: vi.fn(), isReadOnly: () => false, ipHashedClient: vi.fn() }));
vi.mock("../session", () => ({ ensureUser: () => Promise.resolve("user-1"), readSession: vi.fn(), requireKakao: vi.fn(), VISITOR: {} }));
vi.mock("../cache-tags", () => ({ TAG_PLACES: "places", TAG_SEASON: "season", expirePlace: vi.fn(), placeTag: (id: string) => `place:${id}` }));
vi.mock("../notify", () => ({ notifyAdmin: vi.fn(() => Promise.resolve()) }));
vi.mock("../observe", () => ({ reportError: vi.fn() }));
vi.mock("../photos", () => ({ deletePhotoObject: vi.fn(), forgetPhotoObjects: vi.fn(), photoKeys: () => [], storePhoto: vi.fn() }));
vi.mock("../supabase", () => ({ adminClient: vi.fn(), anonClient: vi.fn(), userClient: vi.fn() }));

const PLACE_ID = "3f2a9c1e-1111-4a1a-9b1b-000000000001";
const PLACE_ROW = {
  id: PLACE_ID,
  name: "나라수산",
  gu: "마포구",
  address_road: "서울 마포구 마포대로 1",
  address_jibun: "서울 마포구 도화동 1-1",
  lat: 37.54,
  lng: 126.95,
  nearest_station: null,
  tags: ["grill"],
  specialist: true,
  naver_place_url: null,
  hours_note: null,
  menus: [],
  sides: [],
  source: "seed",
  created_at: "2026-08-27T00:00:00+09:00",
  check_count: 4,
  last_checked_at: "2026-09-21T12:00:00+00:00",
  rating_count: 0,
  rating_avg: null,
  photos: [],
  is_new: false,
};

type Reply = { data?: unknown; error?: { code: string } | null };
type Op = "select" | "insert" | "upsert" | "update" | "delete";

/** supabase-js 쿼리 빌더 가짜 — 어떤 체인이든 받고, await하면 (표, 동작)에 맞는 답을 준다. 쓰기 호출은 기록한다. */
function fakeDb(reply: (table: string, op: Op) => Reply) {
  const writes: { table: string; op: Op; values: unknown }[] = [];
  const from = (table: string) => {
    let op: Op = "select";
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "order", "range", "maybeSingle", "single"]) chain[method] = () => chain;
    for (const method of ["insert", "upsert", "update", "delete"] as const) {
      chain[method] = (values?: unknown) => {
        op = method;
        writes.push({ table, op, values });
        return chain;
      };
    }
    chain["then"] = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null, ...reply(table, op) }).then(resolve, reject);
    return chain;
  };
  return { db: { from } as unknown as Db, writes };
}

function openGateWith(reply: (table: string, op: Op) => Reply) {
  const fake = fakeDb(reply);
  vi.mocked(openWriteGate).mockResolvedValue({ db: fake.db });
  return fake;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("쓰기 문(gate)의 실패는 DB에 닿지 않고 그대로 돌아온다", () => {
  it.each(["read only", "rate limited", "bot check failed", "session changed"] as const)("%s", async (failure) => {
    vi.mocked(openWriteGate).mockResolvedValue({ failure });
    expect(await checkIn(PLACE_ID, "token")).toEqual({ ok: false, error: failure });
    expect(await setBookmark(PLACE_ID, true, "token")).toEqual({ ok: false, error: failure });
    expect(await reportPlace({ placeId: PLACE_ID, reason: "fake" }, "token")).toEqual({ ok: false, error: failure });
    expect(expirePlace).not.toHaveBeenCalled();
  });

  it("행위자(actor)를 문에 그대로 넘긴다 — 대조는 문이 한다", async () => {
    openGateWith((table) => (table === "places_public" ? { data: PLACE_ROW } : {}));
    await checkIn(PLACE_ID, "token", undefined, "user-1");
    expect(openWriteGate).toHaveBeenCalledWith("token", "user-1");
  });
});

describe("checkIn — 다녀왔어요", () => {
  it("성공하면 그 가게 캐시를 만료하고 새 가게를 돌려준다", async () => {
    const { writes } = openGateWith((table) => (table === "places_public" ? { data: PLACE_ROW } : {}));
    const result = await checkIn(PLACE_ID, "token");
    expect(writes).toEqual([{ table: "checkins", op: "insert", values: { place_id: PLACE_ID, actor: "user-1", type: "visited" } }]);
    expect(expirePlace).toHaveBeenCalledWith(PLACE_ID);
    expect(result).toMatchObject({ ok: true, value: { id: PLACE_ID, checkCount: 4 } });
  });

  it.each([
    ["23505", "already checked"], // 핀당 하루 1회 유니크
    ["42501", "rate limited"], // RLS with check — 보이는 가게만 화면에 있으니 실제로는 제한이다
    ["23503", "place not found"], // 없는 가게(FK)
    ["XX000", "forbidden"],
  ])("DB 오류 %s → %s, 캐시는 건드리지 않는다", async (code, error) => {
    openGateWith((table, op) => (table === "checkins" && op === "insert" ? { error: { code } } : {}));
    expect(await checkIn(PLACE_ID, "token")).toEqual({ ok: false, error });
    expect(expirePlace).not.toHaveBeenCalled();
  });

  it("uuid가 아닌 id는 문을 열기도 전에 던진다", async () => {
    await expect(checkIn("not-a-uuid", "token")).rejects.toThrow();
    expect(openWriteGate).not.toHaveBeenCalled();
  });
});

describe("setBookmark — 원하는 상태를 받는다(멱등)", () => {
  it("켜기는 upsert(중복 무시), 끄기는 delete — 어느 쪽이든 지금의 찜 목록을 돌려준다", async () => {
    const on = openGateWith((table, op) => (table === "bookmarks" && op === "select" ? { data: [{ place_id: PLACE_ID }] } : {}));
    expect(await setBookmark(PLACE_ID, true, "token")).toEqual({ ok: true, value: [PLACE_ID] });
    expect(on.writes).toEqual([{ table: "bookmarks", op: "upsert", values: { user_id: "user-1", place_id: PLACE_ID } }]);

    const off = openGateWith((table, op) => (table === "bookmarks" && op === "select" ? { data: [] } : {}));
    expect(await setBookmark(PLACE_ID, false, "token")).toEqual({ ok: true, value: [] });
    expect(off.writes.map((w) => w.op)).toEqual(["delete"]);
  });

  it("없는 가게(23503)는 place not found", async () => {
    openGateWith((table, op) => (table === "bookmarks" && op === "upsert" ? { error: { code: "23503" } } : {}));
    expect(await setBookmark(PLACE_ID, true, "token")).toEqual({ ok: false, error: "place not found" });
  });
});

describe("reportPlace — 가게 신고", () => {
  it("들어가면 관리자에게 알린다(가게 이름과 사유, 연락처 없음)", async () => {
    openGateWith((table, op) => {
      if (table === "reports" && op === "insert") return { data: [{ id: "r1" }] };
      if (table === "places_public") return { data: { name: "나라수산" } };
      return {};
    });
    expect(await reportPlace({ placeId: PLACE_ID, reason: "fake" }, "token")).toEqual({ ok: true, value: undefined });
    expect(notifyAdmin).toHaveBeenCalledWith({ kind: "place_report", placeId: PLACE_ID, name: "나라수산", reason: "fake" });
  });

  it("섀도 밴(트리거가 행을 버려 0행)은 성공한 척하고 알리지 않는다", async () => {
    openGateWith((table, op) => (table === "reports" && op === "insert" ? { data: [] } : {}));
    expect(await reportPlace({ placeId: PLACE_ID, reason: "fake" }, "token")).toEqual({ ok: true, value: undefined });
    expect(notifyAdmin).not.toHaveBeenCalled();
  });

  it("속도 제한(42501)은 rate limited — 알리지 않는다", async () => {
    openGateWith((table, op) => (table === "reports" && op === "insert" ? { error: { code: "42501" } } : {}));
    expect(await reportPlace({ placeId: PLACE_ID, reason: "fake" }, "token")).toEqual({ ok: false, error: "rate limited" });
    expect(notifyAdmin).not.toHaveBeenCalled();
  });
});
