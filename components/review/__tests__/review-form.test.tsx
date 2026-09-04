import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { makePlace } from "@/lib/__tests__/fixtures";
import type { Place, Review } from "@/lib/types";
import { ReviewForm } from "../review-form";
import { RATING_REQUIRED_MESSAGE, REVIEW_SAVE_FAILED_MESSAGE, REVIEW_TEXT_MAX } from "../use-review-form";

type ReviewInput = Parameters<typeof import("@/lib/data").submitReview>[0];
type ReviewPatch = Parameters<typeof import("@/lib/data").updateReview>[1];

const data = vi.hoisted(() => ({
  submitReview: vi.fn<(input: ReviewInput, now: string) => Promise<{ review: Review; place: Place }>>(),
  updateReview: vi.fn<(id: string, patch: ReviewPatch, now: string) => Promise<Review>>(),
}));
vi.mock("@/lib/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data")>()),
  submitReview: data.submitReview,
  updateReview: data.updateReview,
}));

const NOW = "2026-09-01T12:00:00+09:00";
const mine: Review = {
  id: "rv-local-1",
  placeId: "nara",
  authorId: "u-kakao-1",
  rating: 4,
  text: "새우가 실했어요",
  nickname: "새우헌터",
  at: NOW,
};

function renderForm(initial?: Review) {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(
    <ReviewForm
      placeId="nara"
      placeName="나라수산"
      now={NOW}
      initial={initial}
      onSaved={onSaved}
      onClose={onClose}
    />,
  );
  return { onSaved, onClose };
}

describe("ReviewForm — 별점 필수·후기 선택·사진 1장, 등록/수정, 닫는 길 하나", () => {
  let back: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    back = vi.spyOn(window.history, "back").mockImplementation(() => {
      window.history.replaceState(null, "", window.location.pathname);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("별점 없이 등록하면 별 아래 오류, 별을 고르면 'N점' 캡션", () => {
    renderForm();
    expect(screen.getByRole("dialog", { name: "리뷰 남기기" })).toBeInTheDocument();
    expect(screen.getByText("나라수산")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "등록하기" }));
    expect(screen.getByRole("alert")).toHaveTextContent(RATING_REQUIRED_MESSAGE);
    expect(data.submitReview).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("radio", { name: "4점" }));
    expect(screen.getByRole("radio", { name: "4점" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("4점")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it(`후기는 ${String(REVIEW_TEXT_MAX)}자 상한 + 카운터, 등록 성공 → onSaved 뒤 닫힘(onClose)`, async () => {
    const place = makePlace({ id: "nara", name: "나라수산", checkCount: 5, lastCheckedAt: NOW });
    data.submitReview.mockResolvedValue({ review: mine, place });
    const { onSaved, onClose } = renderForm();
    const textarea = screen.getByRole("textbox", { name: "후기 (선택)" });
    expect(textarea).toHaveAttribute("maxlength", String(REVIEW_TEXT_MAX));
    fireEvent.change(textarea, { target: { value: "새우가 실했어요" } });
    expect(screen.getByText(`8/${String(REVIEW_TEXT_MAX)}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "4점" }));
    fireEvent.click(screen.getByRole("button", { name: "등록하기" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith({ review: mine, place });
    });
    expect(data.submitReview).toHaveBeenCalledWith(
      { placeId: "nara", rating: 4, text: "새우가 실했어요", photo: null },
      NOW,
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("등록 실패는 폼 안 오류 한 줄, 입력은 그대로", async () => {
    data.submitReview.mockRejectedValue(new Error("mock write failed"));
    const { onSaved, onClose } = renderForm();
    fireEvent.click(screen.getByRole("radio", { name: "5점" }));
    fireEvent.click(screen.getByRole("button", { name: "등록하기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(REVIEW_SAVE_FAILED_MESSAGE);
    expect(screen.getByRole("radio", { name: "5점" })).toHaveAttribute("aria-checked", "true");
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("수정 모드: 프리필, 사진 자리 없음, [저장하기] → updateReview", async () => {
    const updated = { ...mine, rating: 5, text: "고쳤어요", editedAt: NOW };
    data.updateReview.mockResolvedValue(updated);
    const { onSaved } = renderForm(mine);
    expect(screen.getByRole("dialog", { name: "리뷰 수정" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "4점" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("textbox", { name: "후기 (선택)" })).toHaveValue("새우가 실했어요");
    expect(screen.queryByRole("button", { name: "사진 추가" })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "5점" }));
    fireEvent.change(screen.getByRole("textbox", { name: "후기 (선택)" }), { target: { value: "고쳤어요" } });
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith({ review: updated, place: null });
    });
    expect(data.updateReview).toHaveBeenCalledWith("rv-local-1", { rating: 5, text: "고쳤어요" }, NOW);
  });

  it("✕ → 엔트리를 빼고(back) popstate로 onClose, 저장 없음", () => {
    const { onSaved, onClose } = renderForm();
    window.history.replaceState({ saeuOverlay: true }, "", "/");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(back).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
  });
});
