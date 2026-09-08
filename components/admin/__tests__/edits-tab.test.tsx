import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { makeMenu, makePlace } from "@/lib/__tests__/fixtures";
import type { Place, PlaceEdit } from "@/lib/types";
import { EditsTab } from "../edits-tab";

const data = vi.hoisted(() => ({
  getPlaceEdits: vi.fn<() => Promise<PlaceEdit[]>>(),
  getPlaces: vi.fn<(f: unknown, now: string) => Promise<Place[]>>(),
  revertPlaceEdit: vi.fn<(id: string, now: string) => Promise<Place>>(),
}));
vi.mock("@/lib/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data")>()),
  getPlaceEdits: data.getPlaceEdits,
  getPlaces: data.getPlaces,
  revertPlaceEdit: data.revertPlaceEdit,
}));

const NOW = "2026-09-08T12:00:00+09:00";
const grill = makeMenu({ name: "새우구이", price: 29900 });
const fried = makeMenu({ name: "새우머리튀김 0", price: null });

const edit = (o: Partial<PlaceEdit> = {}): PlaceEdit => ({
  id: "ed1",
  placeId: "nara",
  at: NOW,
  actor: "anon-local-1",
  field: "hours",
  before: {
    hoursNote: "23:00 라스트오더",
    addressRoad: "서울 마포구 마포대로12길 34",
    menus: [grill, fried],
    sides: { headButter: true, ramen: false, friedRice: false },
  },
  ...o,
});

function renderTab() {
  const onNotice = vi.fn();
  render(<EditsTab now={NOW} onNotice={onNotice} />);
  return { onNotice };
}

describe("수정 이력 탭 — '이전 → 지금'이 한 줄로 읽힌다 (design 화면 10-3)", () => {
  beforeEach(() => {
    data.getPlaceEdits.mockReset();
    data.getPlaces.mockReset();
    data.revertPlaceEdit.mockReset();
  });

  it("영업시간·주소는 이전 값과 지금 값을 나란히", async () => {
    data.getPlaceEdits.mockResolvedValue([edit()]);
    data.getPlaces.mockResolvedValue([
      makePlace({ id: "nara", name: "나라수산", hoursNote: "새벽 2시까지" }),
    ]);
    renderTab();
    const table = await screen.findByRole("table", { name: "수정 이력" });
    expect(within(table).getByText("나라수산")).toBeInTheDocument();
    expect(within(table).getByText("영업시간")).toBeInTheDocument();
    // 이전 값과 새 값은 **다른 요소로** 그려야 굵기·취소선으로 대비를 준다
    expect(within(table).getByText("23:00 라스트오더")).toBeInTheDocument();
    expect(within(table).getByText("새벽 2시까지")).toBeInTheDocument();
    expect(within(table).getByText("익명")).toBeInTheDocument();
  });

  it("메뉴는 바뀐 줄만 여러 줄로 — 가격 변경·삭제·추가", async () => {
    data.getPlaceEdits.mockResolvedValue([edit({ field: "menus" })]);
    data.getPlaces.mockResolvedValue([
      makePlace({
        id: "nara",
        name: "나라수산",
        menus: [
          makeMenu({ name: "새우구이", price: 32000 }),
          makeMenu({ name: "새우튀김", price: 15000 }),
        ],
      }),
    ]);
    renderTab();
    const table = await screen.findByRole("table", { name: "수정 이력" });
    // 가격 변경: 라벨(메뉴명) + 이전 → 지금
    expect(within(table).getByText("새우구이")).toBeInTheDocument();
    expect(within(table).getByText("29,900원")).toBeInTheDocument();
    expect(within(table).getByText("32,000원")).toBeInTheDocument();
    // 삭제·추가
    expect(within(table).getByText("삭제됨")).toBeInTheDocument();
    expect(within(table).getByText("추가")).toBeInTheDocument();
    expect(within(table).getByText(/새우튀김 15,000원/)).toBeInTheDocument();
  });

  it("사이드는 켜고 꺼진 것만", async () => {
    data.getPlaceEdits.mockResolvedValue([edit({ field: "sides" })]);
    data.getPlaces.mockResolvedValue([
      makePlace({
        id: "nara",
        name: "나라수산",
        sides: { headButter: true, ramen: true, friedRice: false },
      }),
    ]);
    renderTab();
    const table = await screen.findByRole("table", { name: "수정 이력" });
    expect(within(table).getByText("라면")).toBeInTheDocument();
    expect(within(table).getByText("없음")).toBeInTheDocument();
    expect(within(table).getByText("있음")).toBeInTheDocument();
    expect(within(table).queryByText(/머리버터구이/)).toBeNull();
  });

  it("탈퇴한 사람의 이력은 식별자 대신 '탈퇴한 사용자'", async () => {
    const withActor = edit();
    const rest: PlaceEdit = { ...withActor };
    delete rest.actor; // 탈퇴하면 actor가 떨어진다
    data.getPlaceEdits.mockResolvedValue([rest]);
    data.getPlaces.mockResolvedValue([makePlace({ id: "nara", name: "나라수산" })]);
    renderTab();
    expect(await screen.findByText("탈퇴한 사용자")).toBeInTheDocument();
  });

  it("되돌리기는 확인 없이 즉시 + 토스트, 그리고 목록을 다시 읽는다(되돌린 것도 이력이다)", async () => {
    data.getPlaceEdits.mockResolvedValue([edit()]);
    data.getPlaces.mockResolvedValue([makePlace({ id: "nara", name: "나라수산" })]);
    data.revertPlaceEdit.mockResolvedValue(makePlace({ id: "nara", name: "나라수산" }));
    const { onNotice } = renderTab();
    const table = await screen.findByRole("table", { name: "수정 이력" });
    fireEvent.click(within(table).getByRole("button", { name: "되돌리기" }));
    // 확인 모달이 없다 — 파괴적이지 않고 대칭이다
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => {
      expect(onNotice).toHaveBeenCalledWith("되돌렸어요");
    });
    expect(data.revertPlaceEdit).toHaveBeenCalledWith("ed1", NOW);
    expect(data.getPlaceEdits).toHaveBeenCalledTimes(2);
  });

  it("빈 목록·에러", async () => {
    data.getPlaces.mockResolvedValue([]);
    data.getPlaceEdits.mockRejectedValueOnce(new Error("forbidden")).mockResolvedValue([]);
    renderTab();
    expect(await screen.findByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("아직 고쳐진 곳이 없어요")).toBeInTheDocument();
  });
});
