import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BottomSheet, sheetVisiblePx } from "../bottom-sheet";

describe("sheetVisiblePx — CSS 변수와 같은 규칙", () => {
  it("844px: collapsed 88 / half 40% / full 92%", () => {
    expect(sheetVisiblePx("collapsed", 844)).toBe(88);
    expect(sheetVisiblePx("half", 844)).toBe(338);
    expect(sheetVisiblePx("full", 844)).toBe(776);
  });
  it("낮은 뷰포트(≤639)에서는 half = collapsed", () => {
    expect(sheetVisiblePx("half", 568)).toBe(88);
  });
});

describe("BottomSheet", () => {
  it("스냅을 data 속성으로 노출하고 핸들 클릭(키보드 경로)이 다음 단계로", () => {
    const onSnapChange = vi.fn();
    render(
      <BottomSheet snap="half" onSnapChange={onSnapChange} header={<span>헤더</span>} label="가게 목록">
        <p>내용</p>
      </BottomSheet>,
    );
    const sheet = screen.getByRole("region", { name: "가게 목록" });
    expect(sheet).toHaveAttribute("data-snap", "half");
    fireEvent.click(screen.getByRole("button", { name: "목록 크기 조절" }), { timeStamp: 5000 });
    expect(onSnapChange).toHaveBeenCalledWith("full");
  });

  it("핸들을 포인터로 탭(이동 없음)하면 한 번만 순환하고, 따라오는 click은 무시", () => {
    const onSnapChange = vi.fn();
    render(
      <BottomSheet snap="half" onSnapChange={onSnapChange} header={<span>헤더</span>} label="가게 목록">
        <p>내용</p>
      </BottomSheet>,
    );
    const handle = screen.getByRole("button", { name: "목록 크기 조절" });
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 500, timeStamp: 1000 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 501, timeStamp: 1080 });
    fireEvent.click(handle, { timeStamp: 1085 });
    expect(onSnapChange).toHaveBeenCalledTimes(1);
    expect(onSnapChange).toHaveBeenCalledWith("full");
  });

  it("헤더를 아래로 튕기면 collapsed, 위로 튕기면 full", () => {
    const onSnapChange = vi.fn();
    render(
      <BottomSheet snap="half" onSnapChange={onSnapChange} header={<span>헤더</span>} label="가게 목록">
        <p>내용</p>
      </BottomSheet>,
    );
    const dragArea = screen.getByText("헤더").parentElement?.parentElement;
    if (!dragArea) throw new Error("drag area expected");

    fireEvent.pointerDown(dragArea, { pointerId: 1, button: 0, clientY: 500, timeStamp: 0 });
    fireEvent.pointerMove(dragArea, { pointerId: 1, clientY: 560, timeStamp: 40 });
    fireEvent.pointerUp(dragArea, { pointerId: 1, clientY: 560, timeStamp: 40 });
    expect(onSnapChange).toHaveBeenLastCalledWith("collapsed");

    fireEvent.pointerDown(dragArea, { pointerId: 2, button: 0, clientY: 500, timeStamp: 100 });
    fireEvent.pointerMove(dragArea, { pointerId: 2, clientY: 440, timeStamp: 140 });
    fireEvent.pointerUp(dragArea, { pointerId: 2, clientY: 440, timeStamp: 140 });
    expect(onSnapChange).toHaveBeenLastCalledWith("full");
  });
});
