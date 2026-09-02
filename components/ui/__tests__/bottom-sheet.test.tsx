import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  BottomSheet,
  neighborSnap,
  nextSnapOnTap,
  sheetVisiblePx,
} from "../bottom-sheet";

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

describe("스냅 단계 계산", () => {
  it("탭 순환: collapsed → half → full → collapsed", () => {
    expect(nextSnapOnTap("collapsed", 844)).toBe("half");
    expect(nextSnapOnTap("half", 844)).toBe("full");
    expect(nextSnapOnTap("full", 844)).toBe("collapsed");
  });
  it("낮은 뷰포트에서는 half를 건너뛴다 (탭·플링이 무반응으로 보이지 않게)", () => {
    expect(nextSnapOnTap("collapsed", 568)).toBe("full");
    expect(neighborSnap("collapsed", "up", 568)).toBe("full");
    expect(neighborSnap("full", "down", 568)).toBe("collapsed");
  });
  it("플링은 한 단계만", () => {
    expect(neighborSnap("collapsed", "up", 844)).toBe("half");
    expect(neighborSnap("half", "up", 844)).toBe("full");
    expect(neighborSnap("full", "down", 844)).toBe("half");
    expect(neighborSnap("half", "down", 844)).toBe("collapsed");
  });
});

describe("BottomSheet", () => {
  // jsdom은 EventInit의 timeStamp를 무시하고 Date.now()를 쓴다 → Date만 가짜로 돌려 결정적으로 만든다
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function renderSheet(onSnapChange = vi.fn()) {
    render(
      <BottomSheet snap="half" onSnapChange={onSnapChange} header={<span>헤더</span>} label="가게 목록">
        <p>내용</p>
      </BottomSheet>,
    );
    const dragArea = screen.getByText("헤더").parentElement?.parentElement;
    if (!dragArea) throw new Error("drag area expected");
    return { onSnapChange, dragArea, handle: screen.getByRole("button", { name: "목록 크기 조절" }) };
  }

  it("스냅을 data 속성으로 노출하고 핸들 클릭(키보드 경로)이 다음 단계로", () => {
    const { onSnapChange, handle } = renderSheet();
    expect(screen.getByRole("region", { name: "가게 목록" })).toHaveAttribute("data-snap", "half");
    vi.advanceTimersByTime(1000);
    fireEvent.click(handle);
    expect(onSnapChange).toHaveBeenCalledWith("full");
  });

  it("핸들을 포인터로 탭(이동 없음)하면 한 번만 순환하고, 따라오는 click은 무시", () => {
    const { onSnapChange, handle } = renderSheet();
    vi.advanceTimersByTime(1000);
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 500 });
    vi.advanceTimersByTime(80);
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 501 });
    vi.advanceTimersByTime(5);
    fireEvent.click(handle);
    expect(onSnapChange).toHaveBeenCalledTimes(1);
    expect(onSnapChange).toHaveBeenCalledWith("full");
  });

  it("헤더를 아래로 튕기면 collapsed, 위로 튕기면 full", () => {
    const { onSnapChange, dragArea } = renderSheet();
    vi.advanceTimersByTime(1000);

    fireEvent.pointerDown(dragArea, { pointerId: 1, button: 0, clientY: 500 });
    vi.advanceTimersByTime(40);
    fireEvent.pointerMove(dragArea, { pointerId: 1, clientY: 560 });
    vi.advanceTimersByTime(1);
    fireEvent.pointerUp(dragArea, { pointerId: 1, clientY: 560 });
    expect(onSnapChange).toHaveBeenLastCalledWith("collapsed");

    vi.advanceTimersByTime(100);
    fireEvent.pointerDown(dragArea, { pointerId: 2, button: 0, clientY: 500 });
    vi.advanceTimersByTime(40);
    fireEvent.pointerMove(dragArea, { pointerId: 2, clientY: 440 });
    vi.advanceTimersByTime(1);
    fireEvent.pointerUp(dragArea, { pointerId: 2, clientY: 440 });
    expect(onSnapChange).toHaveBeenLastCalledWith("full");
  });

  it("헤더 안의 다른 버튼을 눌러도 드래그가 시작되지 않는다", () => {
    const onSnapChange = vi.fn();
    render(
      <BottomSheet
        snap="half"
        onSnapChange={onSnapChange}
        header={<button type="button">정렬</button>}
        label="가게 목록"
      >
        <p>내용</p>
      </BottomSheet>,
    );
    const sortButton = screen.getByRole("button", { name: "정렬" });
    vi.advanceTimersByTime(1000);
    fireEvent.pointerDown(sortButton, { pointerId: 3, button: 0, clientY: 500 });
    vi.advanceTimersByTime(40);
    fireEvent.pointerMove(sortButton, { pointerId: 3, clientY: 300 });
    fireEvent.pointerUp(sortButton, { pointerId: 3, clientY: 300 });
    expect(onSnapChange).not.toHaveBeenCalled();
  });
});
