import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SessionProvider } from "@/components/auth/session-provider";
import { makePlace } from "@/lib/__tests__/fixtures";
import type { MyReview, Place, Review, Session } from "@/lib/types";
import { ActivityPanel } from "../activity-panel";
import { DELETE_ACCOUNT_FAILED_MESSAGE } from "../delete-account-sheet";
import { NICKNAME_RANGE_MESSAGE, NICKNAME_SAVED_NOTICE } from "../profile-row";

type ReviewPatch = Parameters<typeof import("@/lib/data").updateReview>[1];

const KAKAO: Session = { userId: "u-kakao-1", provider: "kakao", nickname: "새우헌터" };
const ANON: Session = { userId: "anon-local-9", provider: "anonymous", nickname: null };

const data = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<Session>>(),
  signOut: vi.fn<() => Promise<Session>>(),
  deleteAccount: vi.fn<() => Promise<Session>>(),
  updateNickname: vi.fn<(nickname: string) => Promise<Session>>(),
  getMyReviews: vi.fn<(now: string) => Promise<MyReview[]>>(),
  getMyReports: vi.fn<(now: string) => Promise<Place[]>>(),
  updateReview: vi.fn<(id: string, patch: ReviewPatch, now: string) => Promise<Review>>(),
  deleteReview: vi.fn<(id: string) => Promise<void>>(),
}));
vi.mock("@/lib/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data")>()),
  ...data,
}));

const NOW = "2026-09-01T12:00:00+09:00";
const day = (d: number) => new Date(Date.parse(NOW) - d * 86_400_000).toISOString();

const nara = makePlace({ id: "nara", name: "나라수산", gu: "마포구", lastCheckedAt: day(1) });
const changwoo = makePlace({ id: "changwoo", name: "365활새우 창우수산", gu: "영등포구" });
const myReview = (): MyReview => ({
  id: "rv001",
  placeId: "nara",
  placeName: "나라수산",
  authorId: "u-kakao-1",
  rating: 5,
  text: "대하 크기가 실했어요",
  nickname: "새우헌터",
  at: day(3),
});

function renderPanel(overrides: Partial<Parameters<typeof ActivityPanel>[0]> = {}) {
  const props = {
    now: NOW,
    tab: "bookmarks" as const,
    onTabChange: vi.fn(),
    bookmarkedPlaces: [nara, changwoo],
    bookmarksStatus: "ready" as const,
    onRetryBookmarks: vi.fn(),
    origin: null,
    onOpenPlace: vi.fn(),
    onToggleBookmark: vi.fn(),
    onPlaceIdsChange: vi.fn(),
    onSignedOut: vi.fn(),
    onAccountDeleted: vi.fn(),
    onNotice: vi.fn(),
    ...overrides,
  };
  const view = render(
    <SessionProvider>
      <ActivityPanel {...props} />
    </SessionProvider>,
  );
  return { ...view, props };
}

describe("ActivityPanel — 화면 5: 프로필·3탭·로그아웃·탈퇴", () => {
  beforeEach(() => {
    data.getSession.mockResolvedValue(KAKAO);
    data.signOut.mockResolvedValue(ANON);
    data.deleteAccount.mockResolvedValue(ANON);
    data.updateNickname.mockImplementation((n) => Promise.resolve({ ...KAKAO, nickname: n }));
    data.getMyReviews.mockResolvedValue([myReview()]);
    data.getMyReports.mockResolvedValue([]);
    data.updateReview.mockReset();
    data.deleteReview.mockReset();
    vi.spyOn(window.history, "pushState").mockImplementation(() => {});
    vi.spyOn(window.history, "back").mockImplementation(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("프로필 행·세그먼트 3탭·찜 카드(하트 해제)·마커 id 보고", async () => {
    const { props } = renderPanel();
    expect(await screen.findByText("새우헌터")).toBeInTheDocument();
    expect(screen.getByText("카카오로 로그인됨")).toBeInTheDocument();
    const tabs = within(screen.getByRole("tablist", { name: "내 활동" })).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["찜", "내 리뷰", "내 제보"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    const list = screen.getByRole("list", { name: "찜한 곳" });
    expect(within(list).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "나라수산",
      "365활새우 창우수산",
    ]);
    fireEvent.click(within(list).getByRole("button", { name: "나라수산 찜 해제" }));
    expect(props.onToggleBookmark).toHaveBeenCalledWith("nara");
    fireEvent.click(within(list).getByRole("button", { name: "365활새우 창우수산, 영등포구" }));
    expect(props.onOpenPlace).toHaveBeenCalledWith("changwoo");
    expect(props.onPlaceIdsChange).toHaveBeenLastCalledWith(["nara", "changwoo"]);
    fireEvent.click(screen.getByRole("tab", { name: "내 리뷰" }));
    expect(props.onTabChange).toHaveBeenCalledWith("reviews");
  });

  it("찜 0곳이면 빈 상태 한 줄", async () => {
    renderPanel({ bookmarkedPlaces: [] });
    expect(await screen.findByText("아직 찜한 곳이 없어요")).toBeInTheDocument();
  });

  it("내 리뷰: 가게명(누르면 상세)·수정됨·[수정]→폼→저장, [삭제]→인라인 확인→낙관 제거, 실패면 원복", async () => {
    data.getMyReviews.mockResolvedValue([{ ...myReview(), editedAt: day(1) }]);
    data.updateReview.mockResolvedValue({ ...myReview(), rating: 4, text: "고쳤어요", editedAt: NOW });
    data.deleteReview.mockRejectedValue(new Error("mock write failed"));
    const { props } = renderPanel({ tab: "reviews" });
    const list = await screen.findByRole("list", { name: "내 리뷰" });
    expect(within(list).getByText("수정됨")).toBeInTheDocument();
    fireEvent.click(within(list).getByRole("button", { name: "나라수산" }));
    expect(props.onOpenPlace).toHaveBeenCalledWith("nara");
    expect(props.onPlaceIdsChange).toHaveBeenLastCalledWith(["nara"]);

    fireEvent.click(within(list).getByRole("button", { name: "리뷰 수정" }));
    const form = await screen.findByRole("dialog", { name: "리뷰 수정" });
    expect(within(form).getByText("나라수산")).toBeInTheDocument();
    fireEvent.change(within(form).getByRole("textbox", { name: "후기 (선택)" }), { target: { value: "고쳤어요" } });
    fireEvent.click(within(form).getByRole("button", { name: "저장하기" }));
    await waitFor(() => {
      expect(props.onNotice).toHaveBeenCalledWith("리뷰를 고쳤어요");
    });
    expect(within(list).getByText("고쳤어요")).toBeInTheDocument();

    fireEvent.click(within(list).getByRole("button", { name: "리뷰 삭제" }));
    fireEvent.click(within(list).getByRole("button", { name: "삭제" }));
    expect(screen.queryByText("고쳤어요")).toBeNull();
    await waitFor(() => {
      expect(props.onNotice).toHaveBeenCalledWith("리뷰를 삭제하지 못했어요");
    });
    expect(screen.getByText("고쳤어요")).toBeInTheDocument();
  });

  it("내 리뷰·내 제보: 로딩 → 빈 상태 / 에러 → 다시 시도", async () => {
    let resolveReviews: (list: MyReview[]) => void = () => {};
    data.getMyReviews.mockImplementation(
      () =>
        new Promise<MyReview[]>((r) => {
          resolveReviews = r;
        }),
    );
    data.getMyReports.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce([nara]);
    const reviews = renderPanel({ tab: "reviews" });
    expect(await screen.findByLabelText("불러오는 중")).toBeInTheDocument();
    await act(async () => {
      resolveReviews([]);
      await Promise.resolve();
    });
    expect(await screen.findByText("아직 남긴 리뷰가 없어요")).toBeInTheDocument();
    reviews.unmount();

    renderPanel({ tab: "reports" });
    expect(await screen.findByRole("alert")).toHaveTextContent("불러오지 못했어요");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    const list = await screen.findByRole("list", { name: "내 제보" });
    expect(within(list).getByRole("heading", { level: 3, name: "나라수산" })).toBeInTheDocument();
  });

  it("닉네임 수정: 범위 밖이면 오류 한 줄, 저장하면 updateNickname + 토스트", async () => {
    const { props } = renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "닉네임 수정" }));
    const input = screen.getByRole("textbox", { name: "닉네임" });
    expect(input).toHaveValue("새우헌터");
    fireEvent.change(input, { target: { value: "새" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.getByRole("alert")).toHaveTextContent(NICKNAME_RANGE_MESSAGE);
    expect(data.updateNickname).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: " 새우왕 " } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => {
      expect(props.onNotice).toHaveBeenCalledWith(NICKNAME_SAVED_NOTICE);
    });
    expect(data.updateNickname).toHaveBeenCalledWith("새우왕");
    expect(screen.getByText("새우왕")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "닉네임" })).toBeNull();
  });

  it("로그아웃 → signOut → onSignedOut", async () => {
    const { props } = renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "로그아웃" }));
    await waitFor(() => {
      expect(props.onSignedOut).toHaveBeenCalledTimes(1);
    });
    expect(data.signOut).toHaveBeenCalledTimes(1);
  });

  it("탈퇴: 확인 시트 → [취소]는 닫힘, [탈퇴하기] 실패면 오류 한 줄, 성공이면 onAccountDeleted", async () => {
    data.deleteAccount.mockRejectedValueOnce(new Error("mock write failed")).mockResolvedValueOnce(ANON);
    const { props } = renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "탈퇴" }));
    let sheet = screen.getByRole("dialog", { name: "탈퇴 확인" });
    expect(sheet).toHaveTextContent("정말 탈퇴할까요?");
    fireEvent.click(within(sheet).getByRole("button", { name: "취소" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "탈퇴 확인" })).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "탈퇴" }));
    sheet = screen.getByRole("dialog", { name: "탈퇴 확인" });
    fireEvent.click(within(sheet).getByRole("button", { name: "탈퇴하기" }));
    expect(await within(sheet).findByRole("alert")).toHaveTextContent(DELETE_ACCOUNT_FAILED_MESSAGE);
    expect(props.onAccountDeleted).not.toHaveBeenCalled();
    fireEvent.click(within(sheet).getByRole("button", { name: "탈퇴하기" }));
    await waitFor(() => {
      expect(props.onAccountDeleted).toHaveBeenCalledTimes(1);
    });
  });
});
