import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  BottomSheet,
  neighborSnap,
  nextSnapOnTap,
  resolveRelease,
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

describe("상세 모드 스냅 계산 (design 화면 2: 요약 50% 최소 300, 전체 92%)", () => {
  it("sheetVisiblePx: 요약은 50%, 낮은 뷰포트에서도 300px 하한 (collapse 없음)", () => {
    expect(sheetVisiblePx("half", 844, "detail")).toBe(422);
    expect(sheetVisiblePx("half", 568, "detail")).toBe(300);
    expect(sheetVisiblePx("full", 844, "detail")).toBe(776);
  });

  it("탭·플링은 half ↔ full 두 단계", () => {
    expect(nextSnapOnTap("half", 844, "detail")).toBe("full");
    expect(nextSnapOnTap("full", 844, "detail")).toBe("half");
    expect(neighborSnap("half", "up", 844, "detail")).toBe("full");
    expect(neighborSnap("full", "down", 844, "detail")).toBe("half");
  });

  it("resolveRelease 목록 분기는 기존 규칙 그대로", () => {
    expect(
      resolveRelease({ mode: "list", snap: "half", visible: 300, velocity: 1.2, viewportHeight: 844 }),
    ).toEqual({ kind: "snap", snap: "collapsed" });
    expect(
      resolveRelease({ mode: "list", snap: "half", visible: 700, velocity: 0, viewportHeight: 844 }),
    ).toEqual({ kind: "snap", snap: "full" });
  });

  it("resolveRelease 상세: half에서 아래 플링 → 닫힘, 요약보다 100px 아래 놓아도 닫힘, 살짝은 요약 유지", () => {
    const halfPx = sheetVisiblePx("half", 844, "detail");
    expect(
      resolveRelease({ mode: "detail", snap: "half", visible: halfPx - 30, velocity: 1.2, viewportHeight: 844 }),
    ).toEqual({ kind: "dismiss" });
    expect(
      resolveRelease({ mode: "detail", snap: "full", visible: halfPx - 120, velocity: 0, viewportHeight: 844 }),
    ).toEqual({ kind: "dismiss" });
    expect(
      resolveRelease({ mode: "detail", snap: "full", visible: halfPx - 40, velocity: 0, viewportHeight: 844 }),
    ).toEqual({ kind: "snap", snap: "half" });
    expect(
      resolveRelease({ mode: "detail", snap: "full", visible: halfPx - 30, velocity: 1.2, viewportHeight: 844 }),
    ).toEqual({ kind: "snap", snap: "half" });
  });
});

describe("BottomSheet 상세 모드", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function renderDetail(snap: "half" | "full", scrollTop = 0) {
    const onSnapChange = vi.fn();
    const onDismiss = vi.fn();
    render(
      <BottomSheet
        mode="detail"
        snap={snap}
        onSnapChange={onSnapChange}
        onDismiss={onDismiss}
        header={<span>헤더</span>}
        handleLabel="상세 크기 조절"
        dismissLabel="상세 닫기"
        label="가게 상세"
      >
        <p>본문</p>
        <button type="button">길찾기</button>
      </BottomSheet>,
    );
    const body = screen.getByText("본문").parentElement;
    if (!body) throw new Error("body expected");
    Object.defineProperty(body, "scrollTop", { value: scrollTop, writable: true, configurable: true });
    vi.advanceTimersByTime(1000);
    return { onSnapChange, onDismiss, body };
  }

  it("헤더는 렌더하지 않고 핸들 라벨·data-mode만", () => {
    renderDetail("half");
    expect(screen.queryByText("헤더")).toBeNull();
    expect(screen.getByRole("button", { name: "상세 크기 조절" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "가게 상세" })).toHaveAttribute("data-mode", "detail");
  });

  it("헤더 오른쪽 ✕가 닫는다 — 드래그가 시작되지 않게 pointerdown은 헤더로 올라가지 않는다", () => {
    const { onSnapChange, onDismiss } = renderDetail("half");
    const close = screen.getByRole("button", { name: "상세 닫기" });
    // 헤더가 pointerdown에서 즉시 캡처하면 click이 헤더로 리타겟된다(2026-09-02 실측).
    // 전파 차단은 여기서 확인하고, 리타겟 자체는 jsdom이 못 잡아 Playwright로 본다.
    fireEvent.pointerDown(close, { pointerId: 1, button: 0, clientY: 100 });
    fireEvent.pointerUp(close, { pointerId: 1, clientY: 100 });
    fireEvent.click(close);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onSnapChange).not.toHaveBeenCalled();
  });

  it("요약에서 본문을 아래로 튕기면 닫힘(onDismiss 1회, onSnapChange 없음)", () => {
    const { onSnapChange, onDismiss, body } = renderDetail("half");
    fireEvent.pointerDown(body, { pointerId: 1, button: 0, clientY: 500 });
    vi.advanceTimersByTime(40);
    fireEvent.pointerMove(body, { pointerId: 1, clientY: 560 });
    vi.advanceTimersByTime(1);
    fireEvent.pointerUp(body, { pointerId: 1, clientY: 560 });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onSnapChange).not.toHaveBeenCalled();
  });

  it("요약에서 본문을 위로 끌면 전체로", () => {
    const { onSnapChange, onDismiss, body } = renderDetail("half");
    fireEvent.pointerDown(body, { pointerId: 2, button: 0, clientY: 500 });
    vi.advanceTimersByTime(40);
    fireEvent.pointerMove(body, { pointerId: 2, clientY: 440 });
    vi.advanceTimersByTime(1);
    fireEvent.pointerUp(body, { pointerId: 2, clientY: 440 });
    expect(onSnapChange).toHaveBeenLastCalledWith("full");
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("전체에서 맨 위(scrollTop 0)를 천천히 아래로 끌면 요약으로", () => {
    const { onSnapChange, onDismiss, body } = renderDetail("full", 0);
    fireEvent.pointerDown(body, { pointerId: 3, button: 0, clientY: 100 });
    vi.advanceTimersByTime(400);
    fireEvent.pointerMove(body, { pointerId: 3, clientY: 400 });
    vi.advanceTimersByTime(400);
    fireEvent.pointerUp(body, { pointerId: 3, clientY: 400 });
    expect(onSnapChange).toHaveBeenLastCalledWith("half");
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("전체에서 본문이 스크롤된 상태(scrollTop 50)면 드래그가 시작되지 않는다", () => {
    const { onSnapChange, onDismiss, body } = renderDetail("full", 50);
    fireEvent.pointerDown(body, { pointerId: 4, button: 0, clientY: 100 });
    vi.advanceTimersByTime(40);
    fireEvent.pointerMove(body, { pointerId: 4, clientY: 400 });
    fireEvent.pointerUp(body, { pointerId: 4, clientY: 400 });
    expect(onSnapChange).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("전체에서 맨 위를 위로 끄는 건 본문 스크롤 — 시트는 반응하지 않는다", () => {
    const { onSnapChange, body } = renderDetail("full", 0);
    fireEvent.pointerDown(body, { pointerId: 5, button: 0, clientY: 400 });
    vi.advanceTimersByTime(40);
    fireEvent.pointerMove(body, { pointerId: 5, clientY: 300 });
    fireEvent.pointerUp(body, { pointerId: 5, clientY: 300 });
    expect(onSnapChange).not.toHaveBeenCalled();
  });

  it("본문을 끌다가 버튼 위에서 놓으면 그 버튼의 click은 삼킨다 (탭은 통과)", () => {
    const { body } = renderDetail("half");
    const onClick = vi.fn();
    screen.getByRole("button", { name: "길찾기" }).addEventListener("click", onClick);
    const button = screen.getByRole("button", { name: "길찾기" });
    fireEvent.pointerDown(body, { pointerId: 6, button: 0, clientY: 500 });
    vi.advanceTimersByTime(40);
    fireEvent.pointerMove(body, { pointerId: 6, clientY: 470 });
    vi.advanceTimersByTime(1);
    fireEvent.pointerUp(body, { pointerId: 6, clientY: 470 });
    vi.advanceTimersByTime(5);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    fireEvent.pointerDown(button, { pointerId: 7, button: 0, clientY: 500 });
    fireEvent.pointerUp(button, { pointerId: 7, clientY: 500 });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
