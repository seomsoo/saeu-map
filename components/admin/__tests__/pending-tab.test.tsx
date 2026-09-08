import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { makeMenu, makePlace } from "@/lib/__tests__/fixtures";
import type { Place } from "@/lib/types";
import { PendingTab } from "../pending-tab";

const data = vi.hoisted(() => ({
  getPlaces: vi.fn<(filter: unknown, now: string) => Promise<Place[]>>(),
  confirmPlace: vi.fn<(id: string, now: string) => Promise<Place>>(),
}));
vi.mock("@/lib/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data")>()),
  getPlaces: data.getPlaces,
  confirmPlace: data.confirmPlace,
}));

const NOW = "2026-09-08T12:00:00+09:00";
const day = (d: number) => new Date(Date.parse(NOW) - d * 86_400_000).toISOString();

const reported = (overrides: Partial<Place> = {}): Place =>
  makePlace({
    id: "r001",
    name: "새우한상",
    gu: "송파구",
    source: "report",
    isNew: true,
    createdAt: day(0),
    naverPlaceUrl: "https://m.place.naver.com/restaurant/1/home",
    menus: [makeMenu({ name: "왕새우 소금구이", price: 35000, unit: "kg", unit_raw: "1" })],
    ...overrides,
  });

function renderTab() {
  const onNotice = vi.fn();
  render(<PendingTab now={NOW} onNotice={onNotice} />);
  return { onNotice };
}

describe("사후 확인 탭 (design 화면 10-1)", () => {
  beforeEach(() => {
    data.getPlaces.mockReset();
    data.confirmPlace.mockReset();
  });

  it("확인 안 된 제보 핀만 최신순으로 — 시드·확인된 것은 빠진다", async () => {
    data.getPlaces.mockResolvedValue([
      makePlace({ id: "seed1", name: "시드집", source: "seed" }),
      reported({ id: "r002", name: "확인된집", verifiedAt: day(1) }),
      reported({ id: "r003", name: "어제집", createdAt: day(1) }),
      reported({ id: "r001", name: "오늘집", createdAt: day(0) }),
    ]);
    renderTab();
    const table = await screen.findByRole("table", { name: "사후 확인" });
    const names = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((r) => r.querySelector("td")?.textContent);
    expect(names).toEqual(["오늘집", "어제집"]);
  });

  it("[확인]은 목록에서 즉시 빼고(낙관) 토스트 — 실패하면 되돌아온다", async () => {
    data.getPlaces.mockResolvedValue([reported()]);
    // 응답을 내가 쥔다 — 바로 reject하면 act가 마이크로태스크까지 흘려 "낙관" 순간을 볼 수 없다
    let fail!: (e: Error) => void;
    data.confirmPlace.mockReturnValue(
      new Promise((_, reject) => {
        fail = reject;
      }),
    );
    const { onNotice } = renderTab();
    const table = await screen.findByRole("table", { name: "사후 확인" });
    expect(within(table).getByText("새우한상")).toBeInTheDocument();

    fireEvent.click(within(table).getByRole("button", { name: "확인" }));
    // 응답을 기다리지 않고 사라진다. 마지막 행이라 표가 통째로 빠지므로 `screen`으로 본다
    // (`table` 참조는 이 시점에 떼어진 노드다 — 거기서 찾으면 옛 마크업이 그대로 나온다)
    expect(screen.queryByRole("table", { name: "사후 확인" })).toBeNull();
    expect(screen.getByText("확인할 새 제보가 없어요")).toBeInTheDocument();

    fail(new Error("mock write failed"));
    await waitFor(() => {
      expect(onNotice).toHaveBeenCalledWith("확인을 저장하지 못했어요");
    });
    // 실패 롤백 — 중복 없이 한 행만 돌아온다
    const back = await screen.findByRole("table", { name: "사후 확인" });
    expect(within(back).getAllByText("새우한상")).toHaveLength(1);
  });

  it("성공하면 목록에서 빠진 채로 남고 토스트", async () => {
    data.getPlaces.mockResolvedValue([reported()]);
    data.confirmPlace.mockResolvedValue(reported({ verifiedAt: NOW }));
    const { onNotice } = renderTab();
    const table = await screen.findByRole("table", { name: "사후 확인" });
    fireEvent.click(within(table).getByRole("button", { name: "확인" }));
    await waitFor(() => {
      expect(onNotice).toHaveBeenCalledWith("확인했어요");
    });
    expect(await screen.findByText("확인할 새 제보가 없어요")).toBeInTheDocument();
    expect(screen.queryByText("새우한상")).toBeNull();
  });

  it("[플레이스 열기]는 허용 호스트일 때만 — 링크는 새 탭·noopener", async () => {
    data.getPlaces.mockResolvedValue([
      reported({ id: "r001", name: "링크있음" }),
      reported({ id: "r002", name: "링크없음", naverPlaceUrl: null }),
      reported({ id: "r003", name: "이상한링크", naverPlaceUrl: "https://evil.example.com/x" }),
    ]);
    renderTab();
    const table = await screen.findByRole("table", { name: "사후 확인" });
    // 세 행 중 허용 호스트인 한 곳만 링크를 갖는다 (evil.example.com·null은 없다)
    const links = within(table).getAllByRole("link", { name: /플레이스 열기/ });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("target", "_blank");
    expect(links[0]).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("에러면 [다시 시도], 빈 목록이면 한 줄", async () => {
    data.getPlaces.mockRejectedValueOnce(new Error("boom")).mockResolvedValue([]);
    renderTab();
    expect(await screen.findByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("확인할 새 제보가 없어요")).toBeInTheDocument();
  });
});
