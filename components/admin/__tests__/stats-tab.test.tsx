import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { AdminDayCount, AdminStats } from "@/lib/types";
import { StatsTab } from "../stats-tab";

const data = vi.hoisted(() => ({
  getAdminStats: vi.fn<(now: string) => Promise<AdminStats>>(),
}));
vi.mock("@/lib/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data")>()),
  getAdminStats: data.getAdminStats,
}));

const NOW = "2026-09-08T12:00:00+09:00";
/** 13일 전부터 오늘까지 — 마지막 칸이 오늘이다 */
const day = (n: number): AdminDayCount => {
  const d = new Date(Date.parse("2026-09-08T00:00:00+09:00") - (13 - n) * 86_400_000);
  const kst = new Date(d.getTime() + 9 * 3_600_000);
  const date = `${String(kst.getUTCFullYear())}.${String(kst.getUTCMonth() + 1).padStart(2, "0")}.${String(kst.getUTCDate()).padStart(2, "0")}`;
  return { date, reports: n, checkins: n * 2, reviews: 1, edits: 0 };
};

const stats = (): AdminStats => {
  const daily = Array.from({ length: 14 }, (_, i) => day(i));
  return {
    openReports: 2,
    unverified: 3,
    today: daily.at(-1) as AdminDayCount,
    daily,
    participants: { anonymous: 41, kakao: 7 },
    topPlaces: [
      { placeId: "a", name: "나라수산", checkCount: 12 },
      { placeId: "b", name: "뚝섬포구", checkCount: 9 },
    ],
  };
};

describe("통계 탭 (design 화면 10-5)", () => {
  beforeEach(() => {
    data.getAdminStats.mockReset();
  });

  it("오늘 옆에 최근 7일 합계 — 오늘만 두면 많은지 적은지 모른다", async () => {
    data.getAdminStats.mockResolvedValue(stats());
    render(<StatsTab now={NOW} />);
    expect(await screen.findByText("오늘 제보")).toBeInTheDocument();
    // 최근 7일 = 인덱스 7~13의 reports 합 = 7+8+…+13 = 70
    expect(screen.getByText("7일 70")).toBeInTheDocument();
    // 오늘 값(13)은 요약 칸에 — 일별 표에도 13이 있어 요약 칸으로 좁힌다
    const tile = screen.getByText("오늘 제보").parentElement;
    expect(within(tile as HTMLElement).getByText("13")).toBeInTheDocument();
  });

  it("일별 표는 14일, 최신이 위", async () => {
    data.getAdminStats.mockResolvedValue(stats());
    render(<StatsTab now={NOW} />);
    const table = await screen.findByRole("table", { name: "일별 참여" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(14);
    expect(rows[0]?.querySelector("td")?.textContent).toBe("2026.09.08");
  });

  it("참여자는 익명·카카오로 나뉘고 상위 가게는 확인 많은 순", async () => {
    data.getAdminStats.mockResolvedValue(stats());
    render(<StatsTab now={NOW} />);
    expect(await screen.findByText("41")).toBeInTheDocument();
    const kakao = screen.getByText("카카오").parentElement;
    expect(within(kakao as HTMLElement).getByText("7")).toBeInTheDocument();
    const top = screen.getByRole("table", { name: "상위 가게" });
    const names = within(top)
      .getAllByRole("row")
      .slice(1)
      .map((r) => r.querySelector("td")?.textContent);
    expect(names).toEqual(["나라수산", "뚝섬포구"]);
  });

  it("에러면 [다시 시도]", async () => {
    data.getAdminStats.mockRejectedValueOnce(new Error("forbidden")).mockResolvedValue(stats());
    render(<StatsTab now={NOW} />);
    expect(await screen.findByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("오늘 제보")).toBeInTheDocument();
  });
});
