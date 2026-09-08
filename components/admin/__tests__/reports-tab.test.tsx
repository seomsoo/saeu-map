import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { makePlace } from "@/lib/__tests__/fixtures";
import type { Place, Report } from "@/lib/types";
import { ReportsTab } from "../reports-tab";

const data = vi.hoisted(() => ({
  getReports: vi.fn<(f?: unknown) => Promise<Report[]>>(),
  getPlaces: vi.fn<(f: unknown, now: string) => Promise<Place[]>>(),
  resolveReport: vi.fn<(id: string, status: string) => Promise<Report>>(),
  setPlaceHidden: vi.fn<(id: string, hidden: boolean, now: string) => Promise<Place>>(),
}));
vi.mock("@/lib/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data")>()),
  getReports: data.getReports,
  getPlaces: data.getPlaces,
  resolveReport: data.resolveReport,
  setPlaceHidden: data.setPlaceHidden,
}));

const NOW = "2026-09-08T12:00:00+09:00";
const nara = makePlace({ id: "nara", name: "나라수산" });
const report = (o: Partial<Report> = {}): Report => ({
  id: "rp1",
  kind: "place_report",
  placeId: "nara",
  reason: "duplicate",
  at: NOW,
  actor: "anon-local-1",
  status: "open",
  ...o,
});

function renderTab() {
  const onNotice = vi.fn();
  render(<ReportsTab now={NOW} onNotice={onNotice} />);
  return { onNotice };
}

describe("신고·요청 탭 (design 화면 10-2)", () => {
  beforeEach(() => {
    data.getReports.mockReset();
    data.getPlaces.mockReset();
    data.resolveReport.mockReset();
    data.setPlaceHidden.mockReset();
    data.getPlaces.mockResolvedValue([nara]);
  });

  it("네 종류가 한 표에 모이고 사유는 사용자 화면과 같은 말로 읽힌다", async () => {
    data.getReports.mockResolvedValue([
      report({ id: "rp1", kind: "place_report", reason: "duplicate" }),
      report({ id: "rp2", kind: "place_flag", reason: "closed" }),
      report({ id: "rp3", kind: "photo_report", reason: "spam", photoId: "nara-p1" }),
      report({
        id: "rp4",
        kind: "owner_request",
        ownerKind: "remove",
        contact: "010-1234-5678",
        message: "폐업했습니다",
      }),
    ]);
    renderTab();
    const table = await screen.findByRole("table", { name: "신고·요청" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => r.querySelector("td")?.textContent)).toEqual([
      "가게 신고",
      "정보 수정 제안",
      "사진 신고",
      "사장님 요청",
    ]);
    expect(within(table).getByText("중복 등록이에요")).toBeInTheDocument();
    expect(within(table).getByText("문 닫았어요")).toBeInTheDocument();
    expect(within(table).getByText("광고·도배 (nara-p1)")).toBeInTheDocument();
    expect(within(table).getByText("게재 삭제 · 010-1234-5678 · 폐업했습니다")).toBeInTheDocument();
  });

  it("종류 칩으로 거른다", async () => {
    data.getReports.mockResolvedValue([
      report({ id: "rp1", kind: "place_report" }),
      report({ id: "rp2", kind: "owner_request", ownerKind: "edit", contact: "a@b.com" }),
    ]);
    renderTab();
    await screen.findByRole("table", { name: "신고·요청" });
    fireEvent.click(screen.getByRole("button", { name: "사장님 요청" }));
    const table = screen.getByRole("table", { name: "신고·요청" });
    expect(within(table).getAllByRole("row").slice(1)).toHaveLength(1);
    expect(within(table).getByText("사장님 요청")).toBeInTheDocument();
  });

  it("[처리함]·[무시]는 상태를 정해 보내고 목록을 다시 읽는다", async () => {
    data.getReports.mockResolvedValue([report()]);
    data.resolveReport.mockResolvedValue(report({ status: "done" }));
    const { onNotice } = renderTab();
    const table = await screen.findByRole("table", { name: "신고·요청" });
    fireEvent.click(within(table).getByRole("button", { name: "처리함" }));
    await waitFor(() => {
      expect(onNotice).toHaveBeenCalledWith("처리했어요");
    });
    expect(data.resolveReport).toHaveBeenCalledWith("rp1", "done");
    // 열린 목록을 다시 읽는다 — 처리한 행은 빠져야 한다
    expect(data.getReports).toHaveBeenCalledTimes(2);
  });

  it("가게 신고에만 [숨김]이 붙고, 이미 숨겨진 가게면 [복구]다", async () => {
    data.getReports.mockResolvedValue([
      report({ id: "rp1", kind: "place_report" }),
      report({ id: "rp2", kind: "place_flag" }),
    ]);
    data.setPlaceHidden.mockResolvedValue({ ...nara, hiddenAt: NOW });
    const { onNotice } = renderTab();
    const table = await screen.findByRole("table", { name: "신고·요청" });
    expect(within(table).getAllByRole("button", { name: "숨김" })).toHaveLength(1);
    fireEvent.click(within(table).getByRole("button", { name: "숨김" }));
    await waitFor(() => {
      expect(onNotice).toHaveBeenCalledWith("숨겼어요");
    });
    expect(data.setPlaceHidden).toHaveBeenCalledWith("nara", true, NOW);
  });

  it("사장님 요청은 [연락처 복사] — 클립보드에 연락처만 들어간다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    data.getReports.mockResolvedValue([
      report({ id: "rp4", kind: "owner_request", ownerKind: "edit", contact: "owner@example.com", message: "영업시간이 바뀌었어요" }),
    ]);
    const { onNotice } = renderTab();
    const table = await screen.findByRole("table", { name: "신고·요청" });
    fireEvent.click(within(table).getByRole("button", { name: "연락처 복사" }));
    await waitFor(() => {
      expect(onNotice).toHaveBeenCalledWith("연락처를 복사했어요");
    });
    expect(writeText).toHaveBeenCalledWith("owner@example.com");
  });

  it("실패하면 토스트만 — 목록은 그대로", async () => {
    data.getReports.mockResolvedValue([report()]);
    data.resolveReport.mockRejectedValue(new Error("forbidden"));
    const { onNotice } = renderTab();
    const table = await screen.findByRole("table", { name: "신고·요청" });
    fireEvent.click(within(table).getByRole("button", { name: "처리함" }));
    await waitFor(() => {
      expect(onNotice).toHaveBeenCalledWith("처리하지 못했어요");
    });
    expect(screen.getByRole("table", { name: "신고·요청" })).toBeInTheDocument();
  });

  it("빈 목록·에러 상태", async () => {
    data.getReports.mockRejectedValueOnce(new Error("boom")).mockResolvedValue([]);
    renderTab();
    expect(await screen.findByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("들어온 신고가 없어요")).toBeInTheDocument();
  });
});
