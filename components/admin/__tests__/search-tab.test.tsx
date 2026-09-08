import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { makePlace } from "@/lib/__tests__/fixtures";
import type { Place } from "@/lib/types";
import { SearchTab } from "../search-tab";

const data = vi.hoisted(() => ({
  searchPlacesForAdmin: vi.fn<(q: string, now: string) => Promise<Place[]>>(),
  setPlaceHidden: vi.fn<(id: string, hidden: boolean, now: string) => Promise<Place>>(),
  deletePlace: vi.fn<(id: string, now: string, byOwner?: boolean) => Promise<Place>>(),
}));
vi.mock("@/lib/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data")>()),
  searchPlacesForAdmin: data.searchPlacesForAdmin,
  setPlaceHidden: data.setPlaceHidden,
  deletePlace: data.deletePlace,
}));

const NOW = "2026-09-08T12:00:00+09:00";
const nara = makePlace({ id: "nara", name: "나라수산", gu: "마포구", createdAt: NOW });

function renderTab() {
  const onNotice = vi.fn();
  render(<SearchTab now={NOW} onNotice={onNotice} />);
  return { onNotice };
}
const search = (q = "나라") => {
  fireEvent.change(screen.getByRole("textbox", { name: "상호로 찾기" }), { target: { value: q } });
  fireEvent.click(screen.getByRole("button", { name: "검색" }));
};

describe("검색 탭 — 비상용 직접 조작 (design 화면 10-4)", () => {
  beforeEach(() => {
    data.searchPlacesForAdmin.mockReset();
    data.setPlaceHidden.mockReset();
    data.deletePlace.mockReset();
  });

  it("검색 전에는 안내 한 줄 — 빈 검색으로 목록을 부르지 않는다", async () => {
    data.searchPlacesForAdmin.mockResolvedValue([]);
    renderTab();
    expect(await screen.findByText("상호로 검색해보세요")).toBeInTheDocument();
    expect(data.searchPlacesForAdmin).not.toHaveBeenCalled();
  });

  it("숨긴 가게도 나온다 — 복구하려면 찾을 수 있어야 한다", async () => {
    data.searchPlacesForAdmin.mockResolvedValue([
      nara,
      makePlace({ id: "hid", name: "숨긴집", hiddenAt: NOW }),
      makePlace({ id: "own", name: "사장님내림", hiddenAt: NOW, removedByOwner: true }),
    ]);
    renderTab();
    search();
    const table = await screen.findByRole("table", { name: "검색 결과" });
    // 상태 셀로 좁힌다 — "숨김"은 액션 버튼 라벨과도 겹친다
    expect(within(table).getByRole("cell", { name: "정상" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "숨김" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "내림(사장님)" })).toBeInTheDocument();
    // 이미 내려간 가게엔 [삭제]가 없다
    expect(within(table).getAllByRole("button", { name: "삭제" })).toHaveLength(1);
    expect(within(table).getAllByRole("button", { name: "복구" })).toHaveLength(2);
  });

  it("숨김·복구는 원하는 상태를 보낸다", async () => {
    data.searchPlacesForAdmin.mockResolvedValue([nara]);
    data.setPlaceHidden.mockResolvedValue({ ...nara, hiddenAt: NOW });
    const { onNotice } = renderTab();
    search();
    const table = await screen.findByRole("table", { name: "검색 결과" });
    fireEvent.click(within(table).getByRole("button", { name: "숨김" }));
    await waitFor(() => {
      expect(onNotice).toHaveBeenCalledWith("숨겼어요");
    });
    expect(data.setPlaceHidden).toHaveBeenCalledWith("nara", true, NOW);
  });

  it("삭제만 확인 모달을 거친다 — 그만두면 아무 일도 없다", async () => {
    data.searchPlacesForAdmin.mockResolvedValue([nara]);
    renderTab();
    search();
    const table = await screen.findByRole("table", { name: "검색 결과" });
    fireEvent.click(within(table).getByRole("button", { name: "삭제" }));
    const dialog = await screen.findByRole("dialog", { name: "나라수산 삭제 확인" });
    expect(within(dialog).getByText(/기록은 남아요/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "그만두기" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(data.deletePlace).not.toHaveBeenCalled();
  });

  it("[내리기]는 소프트 삭제로 — 사장님 기록이 붙는다", async () => {
    data.searchPlacesForAdmin.mockResolvedValue([nara]);
    data.deletePlace.mockResolvedValue({ ...nara, hiddenAt: NOW, removedByOwner: true });
    const { onNotice } = renderTab();
    search();
    const table = await screen.findByRole("table", { name: "검색 결과" });
    fireEvent.click(within(table).getByRole("button", { name: "삭제" }));
    const dialog = await screen.findByRole("dialog", { name: "나라수산 삭제 확인" });
    fireEvent.click(within(dialog).getByRole("button", { name: "내리기" }));
    await waitFor(() => {
      expect(onNotice).toHaveBeenCalledWith("내렸어요");
    });
    expect(data.deletePlace).toHaveBeenCalledWith("nara", NOW, true);
  });

  it("결과 없음·에러", async () => {
    data.searchPlacesForAdmin.mockRejectedValueOnce(new Error("forbidden")).mockResolvedValue([]);
    renderTab();
    search("없는집");
    expect(await screen.findByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("찾는 가게가 없어요")).toBeInTheDocument();
  });
});
