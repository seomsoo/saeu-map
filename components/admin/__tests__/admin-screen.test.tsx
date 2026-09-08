import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { AdminStats, Session } from "@/lib/types";
import { AdminScreen } from "../admin-screen";

const ANON: Session = { userId: "anon-local-1", provider: "anonymous", nickname: null };
const ADMIN: Session = { userId: "u-kakao-1", provider: "kakao", nickname: "새우헌터", isAdmin: true };

const data = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<Session>>(),
  getAdminStats: vi.fn<(now: string) => Promise<AdminStats>>(),
}));
vi.mock("@/lib/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data")>()),
  getSession: data.getSession,
  getAdminStats: data.getAdminStats,
}));

const NOW = "2026-09-08T12:00:00+09:00";
const stats = (overrides: Partial<AdminStats> = {}): AdminStats => ({
  openReports: 0,
  unverified: 0,
  today: { date: "2026.09.08", reports: 0, checkins: 0, reviews: 0, edits: 0 },
  daily: [],
  participants: { anonymous: 0, kakao: 0 },
  topPlaces: [],
  ...overrides,
});

describe("/admin 그릇 — 권한 게이트와 탭 (design 화면 10)", () => {
  beforeEach(() => {
    data.getAdminStats.mockResolvedValue(stats());
  });

  it("비관리자에게는 404 위장 — 관리자 화면이 있다는 사실 자체를 알리지 않는다", async () => {
    data.getSession.mockResolvedValue(ANON);
    render(<AdminScreen now={NOW} />);
    expect(await screen.findByText("페이지를 찾을 수 없어요")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "새우맵 관리" })).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    // 숙제 수도 읽지 않는다 — 없는 화면이 데이터를 부르면 존재가 드러난다
    expect(data.getAdminStats).not.toHaveBeenCalled();
  });

  it("관리자면 탭 5개와 계정·[사용자 화면으로]", async () => {
    data.getSession.mockResolvedValue(ADMIN);
    render(<AdminScreen now={NOW} />);
    expect(await screen.findByRole("heading", { name: "새우맵 관리" })).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      "사후 확인",
      "신고·요청",
      "수정 이력",
      "검색",
      "통계",
    ]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("새우헌터")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "사용자 화면으로" })).toHaveAttribute("href", "/");
  });

  it("숙제가 있는 탭에만 배지가 붙는다", async () => {
    data.getSession.mockResolvedValue(ADMIN);
    data.getAdminStats.mockResolvedValue(stats({ openReports: 3, unverified: 0 }));
    render(<AdminScreen now={NOW} />);
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /신고·요청/ })).toHaveTextContent("신고·요청3");
    });
    // 0이면 안 그린다 — 0을 보여주면 숙제가 있는 것처럼 읽힌다
    expect(screen.getByRole("tab", { name: /사후 확인/ })).toHaveTextContent("사후 확인");
    expect(screen.getByRole("tab", { name: /사후 확인/ }).textContent).not.toMatch(/\d/);
  });

  it("배지 읽기가 실패해도 화면은 뜬다 — 배지는 숙제 수일 뿐 본문이 아니다", async () => {
    data.getSession.mockResolvedValue(ADMIN);
    data.getAdminStats.mockRejectedValue(new Error("boom"));
    render(<AdminScreen now={NOW} />);
    expect(await screen.findByRole("heading", { name: "새우맵 관리" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(5);
  });
});
