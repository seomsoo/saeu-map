import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { makeMenu, makePlace } from "@/lib/__tests__/fixtures";
import { CHECKIN_FAILED_NOTICE } from "@/components/place-detail/use-check-in";
import type { Place, PlaceFlagReason } from "@/lib/types";
import { FLAG_FAILED_MESSAGE } from "../flag-sheet";
import { FLAGGED_NOTICE, NewPlacesPanel } from "../new-places-panel";

const data = vi.hoisted(() => ({
  checkIn: vi.fn<(id: string, now: string) => Promise<Place>>(),
  flagPlace: vi.fn<(input: { placeId: string; reason: PlaceFlagReason }) => Promise<void>>(),
}));
vi.mock("@/lib/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data")>()),
  checkIn: data.checkIn,
  flagPlace: data.flagPlace,
}));

const NOW = "2026-09-01T12:00:00+09:00";
const day = (d: number) => new Date(Date.parse(NOW) - d * 86_400_000).toISOString();

function places(): Place[] {
  return [
    makePlace({
      id: "suseong",
      name: "수성2호왕새우소금구이",
      gu: "관악구",
      isNew: true,
      createdAt: day(2),
      lastCheckedAt: day(2),
      checkCount: 0,
      menus: [makeMenu({ name: "왕새우소금구이", price: 45000, unit: "pan", unit_raw: "한판" })],
    }),
    makePlace({
      id: "seongsu",
      name: "성수부두",
      gu: "성동구",
      isNew: true,
      createdAt: day(3),
      lastCheckedAt: day(1),
      checkCount: 1,
      menus: [],
    }),
  ];
}

function renderPanel(overrides: Partial<Parameters<typeof NewPlacesPanel>[0]> = {}) {
  const props = {
    places: places(),
    now: NOW,
    checkedIds: new Set<string>(),
    onOpen: vi.fn(),
    onPatchPlace: vi.fn(),
    onChecked: vi.fn(),
    onNotice: vi.fn(),
    ...overrides,
  };
  render(<NewPlacesPanel {...props} />);
  return props;
}

const rowOf = (name: string) => {
  const heading = screen.getByRole("heading", { name });
  const li = heading.closest("li");
  if (!li) throw new Error("row expected");
  return within(li);
};

describe("NewPlacesPanel — 화면 4 행: 등록일·구·카테고리·대표 메뉴·상태·맞아요/달라요", () => {
  beforeEach(() => {
    vi.spyOn(window.history, "pushState").mockImplementation(() => {});
    vi.spyOn(window.history, "back").mockImplementation(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("행 구성과 상태 라벨: 확인 0회는 검증 전, 1회 이상은 확인됨", () => {
    renderPanel();
    const suseong = rowOf("수성2호왕새우소금구이");
    expect(suseong.getByText("2026.08.30 등록")).toBeInTheDocument();
    expect(suseong.getByText("관악구 · 새우구이")).toBeInTheDocument();
    expect(suseong.getByText("왕새우소금구이 한판 45,000원")).toBeInTheDocument();
    expect(suseong.getByText("검증 전")).toBeInTheDocument();
    expect(suseong.getByRole("button", { name: "맞아요" })).toBeInTheDocument();
    expect(suseong.getByRole("button", { name: "달라요" })).toBeInTheDocument();

    const seongsu = rowOf("성수부두");
    expect(seongsu.getByText("확인됨")).toBeInTheDocument();
    expect(seongsu.getByText("메뉴 정보가 없어요")).toBeInTheDocument();
    // 카드 버튼 안에 액션 버튼이 들어가지 않는다
    expect(screen.getByRole("button", { name: "수성2호왕새우소금구이, 관악구" }).querySelector("button")).toBeNull();
  });

  it("행 본문을 누르면 상세로(onOpen)", () => {
    const { onOpen } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "성수부두, 성동구" }));
    expect(onOpen).toHaveBeenCalledWith("seongsu");
  });

  it("맞아요: 즉시 확인됨 + 틴트 [확인했어요], 성공하면 부모에 확정", async () => {
    let resolve: (p: Place) => void = () => {};
    data.checkIn.mockImplementationOnce(
      () =>
        new Promise<Place>((r) => {
          resolve = r;
        }),
    );
    const { onPatchPlace, onChecked } = renderPanel();
    const row = rowOf("수성2호왕새우소금구이");
    fireEvent.click(row.getByRole("button", { name: "맞아요" }));
    expect(row.getByText("확인됨")).toBeInTheDocument();
    expect(row.getByRole("status")).toHaveTextContent("확인했어요");
    expect(row.queryByRole("button", { name: "맞아요" })).not.toBeInTheDocument();
    const updated = { ...makePlace({ id: "suseong" }), checkCount: 1, lastCheckedAt: NOW };
    await act(async () => {
      resolve(updated);
      await Promise.resolve();
    });
    expect(onPatchPlace).toHaveBeenCalledWith(updated);
    expect(onChecked).toHaveBeenCalledWith("suseong");
  });

  it("맞아요 실패: 검증 전으로 돌아오고 토스트", async () => {
    data.checkIn.mockRejectedValueOnce(new Error("mock write failed"));
    const { onNotice, onPatchPlace } = renderPanel();
    const row = rowOf("수성2호왕새우소금구이");
    fireEvent.click(row.getByRole("button", { name: "맞아요" }));
    await waitFor(() => {
      expect(onNotice).toHaveBeenCalledWith(CHECKIN_FAILED_NOTICE);
    });
    expect(row.getByText("검증 전")).toBeInTheDocument();
    expect(row.getByRole("button", { name: "맞아요" })).toBeInTheDocument();
    expect(onPatchPlace).not.toHaveBeenCalled();
  });

  it("이미 확인한 가게(checkedIds)는 처음부터 [확인했어요]", () => {
    renderPanel({ checkedIds: new Set(["seongsu"]) });
    expect(rowOf("성수부두").getByRole("status")).toHaveTextContent("확인했어요");
  });

  it("달라요: 사유 시트 → 탭이 곧 제출 → 닫히고 토스트", async () => {
    data.flagPlace.mockResolvedValueOnce(undefined);
    const { onNotice } = renderPanel();
    fireEvent.click(rowOf("수성2호왕새우소금구이").getByRole("button", { name: "달라요" }));
    const sheet = screen.getByRole("dialog", { name: "수성2호왕새우소금구이 정보가 달라요" });
    expect(within(sheet).getByText("어떤 정보가 달라요?")).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "문 닫았어요" }));
    expect(data.flagPlace).toHaveBeenCalledWith({ placeId: "suseong", reason: "closed" });
    await waitFor(() => {
      expect(onNotice).toHaveBeenCalledWith(FLAGGED_NOTICE);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("달라요 실패: 시트 안 오류 한 줄, 시트는 그대로, 다시 탭이 재시도", async () => {
    data.flagPlace.mockRejectedValueOnce(new Error("mock write failed")).mockResolvedValueOnce(undefined);
    const { onNotice } = renderPanel();
    fireEvent.click(rowOf("성수부두").getByRole("button", { name: "달라요" }));
    const sheet = screen.getByRole("dialog", { name: "성수부두 정보가 달라요" });
    fireEvent.click(within(sheet).getByRole("button", { name: "기타" }));
    expect(await within(sheet).findByRole("alert")).toHaveTextContent(FLAG_FAILED_MESSAGE);
    expect(onNotice).not.toHaveBeenCalled();
    fireEvent.click(within(sheet).getByRole("button", { name: "기타" }));
    await waitFor(() => {
      expect(onNotice).toHaveBeenCalledWith(FLAGGED_NOTICE);
    });
  });
});
