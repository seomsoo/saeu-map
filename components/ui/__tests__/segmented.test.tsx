import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Segmented } from "../segmented";

const OPTIONS = [
  { key: "bookmarks", label: "찜" },
  { key: "reviews", label: "내 리뷰" },
  { key: "reports", label: "내 제보" },
] as const;

describe("Segmented — 탭 목록, 활성 하나, 누르면 onChange", () => {
  it("role=tablist 안 tab 3개, 현재값만 aria-selected", () => {
    render(<Segmented label="내 활동" value="reviews" options={OPTIONS} onChange={() => {}} />);
    const tabs = screen.getAllByRole("tab");
    expect(screen.getByRole("tablist", { name: "내 활동" })).toBeInTheDocument();
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "true", "false"]);
  });

  it("다른 탭을 누르면 그 키로 onChange", () => {
    const onChange = vi.fn();
    render(<Segmented label="내 활동" value="bookmarks" options={OPTIONS} onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "내 제보" }));
    expect(onChange).toHaveBeenCalledWith("reports");
  });
});
