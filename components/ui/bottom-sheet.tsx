"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { cx } from "@/lib/cx";

export type SheetSnap = "collapsed" | "half" | "full";
/** list = 화면 1 목록(3단, 항상 열림) / detail = 화면 2 상세(요약·전체 2단 + 아래로 스와이프하면 닫힘) */
export type SheetMode = "list" | "detail";
export type SheetRelease = { kind: "snap"; snap: SheetSnap } | { kind: "dismiss" };

/*
 * 스냅 위치 상수 — app/globals.css의 .saeu-sheet 변수와 반드시 같아야 한다.
 * CSS가 초기 렌더(SSR)와 전환을 담당하고, JS는 드래그 놓을 때의 스냅 판정에만 쓴다.
 */
export const SHEET_COLLAPSED_PX = 88;
export const SHEET_HALF_RATIO = 0.4;
export const SHEET_FULL_RATIO = 0.92;
/** 이 높이 이하(예: 320×568)에서는 목록 half = collapsed (상단 스택이 지도를 다 가리는 것 방지) */
export const SHEET_SHORT_VIEWPORT_MAX = 639;
/** 상세 요약 = 50%, 최소 300px (낮은 뷰포트에서도 접지 않는다) */
export const SHEET_DETAIL_HALF_RATIO = 0.5;
export const SHEET_DETAIL_HALF_MIN_PX = 300;
/** 상세 헤더 = 핸들만 */
export const SHEET_DETAIL_HEADER_PX = 26;
/** 상세: 요약 위치보다 이만큼 더 내린 채 놓으면 닫힘 */
export const SHEET_DISMISS_PX = 100;

const DRAG_THRESHOLD_PX = 4;
const FLING_VELOCITY = 0.6; // px/ms
/** 포인터 탭·드래그 직후 따라오는 click(캡처로 리타겟될 수 있음)을 무시하는 창 */
const CLICK_SUPPRESS_MS = 250;

export function sheetSnaps(mode: SheetMode): readonly SheetSnap[] {
  return mode === "detail" ? ["half", "full"] : ["collapsed", "half", "full"];
}

/** 스냅별 보이는 높이(px). 카드 탭 시 지도 오프셋 계산에도 쓴다. */
export function sheetVisiblePx(
  snap: SheetSnap,
  viewportHeight: number,
  mode: SheetMode = "list",
): number {
  if (mode === "detail") {
    switch (snap) {
      case "collapsed":
      case "half":
        return Math.max(
          Math.round(viewportHeight * SHEET_DETAIL_HALF_RATIO),
          SHEET_DETAIL_HALF_MIN_PX,
        );
      case "full":
        return Math.round(viewportHeight * SHEET_FULL_RATIO);
    }
  }
  switch (snap) {
    case "collapsed":
      return SHEET_COLLAPSED_PX;
    case "half":
      return viewportHeight <= SHEET_SHORT_VIEWPORT_MAX
        ? SHEET_COLLAPSED_PX
        : Math.round(viewportHeight * SHEET_HALF_RATIO);
    case "full":
      return Math.round(viewportHeight * SHEET_FULL_RATIO);
  }
}

/** (목록만) 낮은 뷰포트에서는 half가 collapsed와 같은 높이라 단계에서 뺀다 (탭·플링이 무반응으로 보이지 않게). */
function halfIsCollapsed(viewportHeight: number): boolean {
  return sheetVisiblePx("half", viewportHeight) === SHEET_COLLAPSED_PX;
}

/** 핸들 탭: 목록 collapsed → half → full → collapsed / 상세 half ↔ full */
export function nextSnapOnTap(
  current: SheetSnap,
  viewportHeight: number,
  mode: SheetMode = "list",
): SheetSnap {
  if (mode === "detail") return current === "full" ? "half" : "full";
  switch (current) {
    case "collapsed":
      return halfIsCollapsed(viewportHeight) ? "full" : "half";
    case "half":
      return "full";
    case "full":
      return "collapsed";
  }
}

/** 플링: 한 단계만 이동. 상세에서 half 아래는 닫힘이라 resolveRelease가 따로 판단한다. */
export function neighborSnap(
  current: SheetSnap,
  direction: "up" | "down",
  viewportHeight: number,
  mode: SheetMode = "list",
): SheetSnap {
  if (mode === "detail") return direction === "up" ? "full" : "half";
  const skipHalf = halfIsCollapsed(viewportHeight);
  if (direction === "up") {
    if (current === "collapsed") return skipHalf ? "full" : "half";
    return "full";
  }
  if (current === "full") return skipHalf ? "collapsed" : "half";
  return "collapsed";
}

function nearestSnap(
  visible: number,
  viewportHeight: number,
  mode: SheetMode = "list",
): SheetSnap {
  let best: SheetSnap = "half";
  let bestDist = Number.POSITIVE_INFINITY;
  for (const s of sheetSnaps(mode)) {
    const d = Math.abs(sheetVisiblePx(s, viewportHeight, mode) - visible);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

/**
 * 드래그를 놓았을 때의 판정. 목록은 플링이면 한 단계, 아니면 가장 가까운 스냅.
 * 상세는 그에 더해 half에서 아래로 튕기거나 요약보다 SHEET_DISMISS_PX 아래에 놓으면 닫힘.
 */
export function resolveRelease({
  mode,
  snap,
  visible,
  velocity,
  viewportHeight,
}: {
  mode: SheetMode;
  snap: SheetSnap;
  visible: number;
  velocity: number;
  viewportHeight: number;
}): SheetRelease {
  const fling = Math.abs(velocity) > FLING_VELOCITY;
  if (mode === "detail") {
    if (snap === "half" && fling && velocity > 0) return { kind: "dismiss" };
    if (visible < sheetVisiblePx("half", viewportHeight, "detail") - SHEET_DISMISS_PX) {
      return { kind: "dismiss" };
    }
  }
  const next = fling
    ? neighborSnap(snap, velocity < 0 ? "up" : "down", viewportHeight, mode)
    : nearestSnap(visible, viewportHeight, mode);
  return { kind: "snap", snap: next };
}

interface DragState {
  pointerId: number;
  startY: number;
  startVisible: number;
  lastY: number;
  lastT: number;
  velocity: number;
  moved: boolean;
  /** 핸들 버튼에서 시작한 포인터 — 움직임 없이 떼면 탭으로 간주해 스냅을 순환 */
  fromHandle: boolean;
  /** body = 상세 본문에서 시작한 드래그 (full에서 맨 위일 때만 시작된다) */
  source: "header" | "body";
}

interface BottomSheetProps {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  /** 핸들 아래 헤더(목록 모드). 이 영역이 드래그 영역이다. 높이는 --sheet-header-h(88px)로 고정. 상세 모드에선 렌더하지 않는다. */
  header?: ReactNode;
  /** 시트 가장자리 위에 얹히는 요소(FAB 줄). 시트와 함께 움직이고 full에서는 숨긴다. */
  aside?: ReactNode;
  /** 스크롤 영역 */
  children: ReactNode;
  label: string;
  className?: string | undefined;
  /** 기본 list. detail은 핸들만 남기고 본문 드래그·아래로 스와이프 닫기를 켠다. */
  mode?: SheetMode;
  handleLabel?: string;
  /** 상세 모드에서 아래로 스와이프해 닫을 때 */
  onDismiss?: (() => void) | undefined;
}

/**
 * 하단 시트 — 항상 열려 있는 비모달. 목록 3단(collapsed/half/full), 상세 2단(half/full) + 닫힘.
 * 목록: 드래그는 핸들·헤더에서만 받아 리스트 스크롤과 충돌하지 않는다. 지도는 시트 위 영역에서 계속 조작 가능.
 * 상세: 요약(half)에선 본문 스크롤을 잠그고 어디를 끌어도 시트가 움직인다. 전체(full)에선 본문이 스크롤되고
 *       맨 위에서 아래로 끄는 것만 시트 드래그로 가로챈다(non-passive touchmove로 브라우저 스크롤 선점 차단).
 */
export function BottomSheet({
  snap,
  onSnapChange,
  header,
  aside,
  children,
  label,
  className,
  mode = "list",
  handleLabel = "목록 크기 조절",
  onDismiss,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const lastPointerCycleAt = useRef(0);
  const lastBodyDragEndAt = useRef(0);
  const detail = mode === "detail";

  const cycleSnap = useCallback(() => {
    onSnapChange(nextSnapOnTap(snap, window.innerHeight, mode));
  }, [snap, mode, onSnapChange]);

  const setDragOffset = (px: number, dragging: boolean) => {
    const el = sheetRef.current;
    if (!el) return;
    el.style.setProperty("--sheet-drag", `${px}px`);
    el.dataset["dragging"] = dragging ? "true" : "false";
  };

  const beginDrag = (
    e: ReactPointerEvent<HTMLDivElement>,
    source: DragState["source"],
    fromHandle: boolean,
  ) => {
    const el = sheetRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // 헤더는 바로 캡처(핸들 탭 순환을 finishDrag가 처리). 본문은 움직인 뒤에만 캡처 — pointerdown에서 잡으면
    // 탭의 click이 버튼이 아니라 본문으로 리타겟돼 상세의 모든 버튼이 죽는다 (Playwright에서 확인, 2026-09-02).
    if (source === "header") e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startVisible: window.innerHeight - rect.top,
      lastY: e.clientY,
      lastT: e.timeStamp,
      velocity: 0,
      moved: false,
      fromHandle,
      source,
    };
  };

  const onHeaderPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || dragRef.current) return;
    const target = e.target as Element;
    // 헤더 안의 컨트롤(정렬 메뉴 등)을 누른 건 드래그가 아니다. 핸들 버튼만 예외.
    const fromHandle = target.closest("[data-sheet-handle]") !== null;
    if (
      !fromHandle &&
      target.closest("button, a, input, select, textarea, [role='listbox']")
    ) {
      return;
    }
    beginDrag(e, "header", fromHandle);
  };

  /** 상세 본문: 요약에선 항상, 전체에선 스크롤이 맨 위일 때만 드래그 후보. 버튼 위에서 시작해도 된다(탭이면 click이 그대로 간다). */
  const onBodyPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || dragRef.current || !detail) return;
    if (snap === "full" && e.currentTarget.scrollTop > 0) return;
    beginDrag(e, "body", false);
  };

  const releaseCapture = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dy = e.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.abs(dy) < DRAG_THRESHOLD_PX) return;
      // 전체 상태의 본문에서 위로 끄는 건 본문 스크롤 — 브라우저에 양보하고 이 제스처는 끝까지 무시
      if (drag.source === "body" && snap === "full" && dy < 0) {
        dragRef.current = null;
        return;
      }
      drag.moved = true;
      if (drag.source === "body") e.currentTarget.setPointerCapture(e.pointerId);
    }
    const dt = e.timeStamp - drag.lastT;
    if (dt > 0) drag.velocity = (e.clientY - drag.lastY) / dt;
    drag.lastY = e.clientY;
    drag.lastT = e.timeStamp;

    const vh = window.innerHeight;
    const min = detail ? 0 : SHEET_COLLAPSED_PX;
    const max = sheetVisiblePx("full", vh, mode);
    const visible = Math.min(max, Math.max(min, drag.startVisible - dy));
    setDragOffset(drag.startVisible - visible, true);
  };

  const finishDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    releaseCapture(e);
    setDragOffset(0, false);
    if (!drag.moved) {
      // 포인터 캡처 중엔 click이 핸들 버튼이 아니라 래퍼로 갈 수 있어 탭을 여기서 처리한다
      if (drag.fromHandle && e.type === "pointerup") {
        lastPointerCycleAt.current = e.timeStamp;
        cycleSnap();
      }
      return;
    }
    if (drag.source === "body") lastBodyDragEndAt.current = e.timeStamp;

    const release = resolveRelease({
      mode,
      snap,
      visible: drag.startVisible - (e.clientY - drag.startY),
      velocity: drag.velocity,
      viewportHeight: window.innerHeight,
    });
    if (release.kind === "dismiss") {
      onDismiss?.();
      return;
    }
    if (release.snap !== snap) onSnapChange(release.snap);
  };

  // 키보드(Enter/Space) 경로. 포인터 탭은 finishDrag가 이미 처리했으므로 직후 click은 무시.
  const onHandleClick = (e: { timeStamp: number }) => {
    if (e.timeStamp - lastPointerCycleAt.current < CLICK_SUPPRESS_MS) return;
    cycleSnap();
  };

  // 본문을 끌다가 버튼 위에서 놓으면 click이 따라온다 — 드래그였으면 삼킨다
  const onBodyClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.timeStamp - lastBodyDragEndAt.current < CLICK_SUPPRESS_MS) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  // 전체 상태에서 맨 위를 아래로 끌 때 브라우저의 스크롤(오버스크롤) 선점을 막는다.
  // React의 onTouchMove는 passive라 preventDefault가 안 먹어 네이티브로 단다.
  useEffect(() => {
    if (!detail) return;
    const body = bodyRef.current;
    if (!body) return;
    const onTouchMove = (e: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.source !== "body" || !e.cancelable) return;
      const touch = e.touches[0];
      if (!touch) return;
      if (drag.moved || touch.clientY - drag.startY >= 0) e.preventDefault();
    };
    body.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      body.removeEventListener("touchmove", onTouchMove);
    };
  }, [detail]);

  // 요약으로 돌아오면 본문을 맨 위로 (전체에서 스크롤한 채 요약이 되면 위가 잘린다)
  useEffect(() => {
    if (detail && snap === "half" && bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [detail, snap]);

  // 목록 스크롤 위치는 상세가 열리는 동안 기억했다가 돌아올 때 복원 (목록 본문은 hidden으로 유지된다)
  const listScrollTop = useRef(0);
  const onBodyScroll = (e: { currentTarget: HTMLDivElement }) => {
    if (!detail) listScrollTop.current = e.currentTarget.scrollTop;
  };
  useEffect(() => {
    if (!detail && bodyRef.current) bodyRef.current.scrollTop = listScrollTop.current;
  }, [detail]);

  return (
    <section
      ref={sheetRef}
      aria-label={label}
      data-snap={snap}
      data-mode={mode}
      data-dragging="false"
      className={cx(
        "saeu-sheet z-20 flex flex-col rounded-t-20 bg-bg shadow-upper",
        className,
      )}
    >
      {aside && (
        <div
          className={cx(
            "absolute inset-x-5 -top-13 flex items-center justify-between",
            snap === "full" && "hidden",
          )}
        >
          {aside}
        </div>
      )}
      <div
        className={cx(
          "saeu-sheet__header flex shrink-0 flex-col touch-none select-none",
          !detail && "border-b border-line-hairline",
        )}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <button
          type="button"
          data-sheet-handle
          aria-label={handleLabel}
          onClick={onHandleClick}
          className="flex h-6.5 w-full shrink-0 items-center justify-center"
        >
          <span
            aria-hidden="true"
            className="block h-1.5 w-12.5 rounded-max bg-line-hairline"
          />
        </button>
        {!detail && (
          <div className="flex min-h-0 flex-1 items-center px-5 pb-4">{header}</div>
        )}
      </div>
      {/* 높이는 CSS(.saeu-sheet__body)가 스냅별로 정한다 — flex-1을 주면 92dvh 전체로 늘어나 스크롤 영역이 화면 밖까지 이어진다 */}
      <div
        ref={bodyRef}
        className="saeu-sheet__body min-h-0 shrink-0"
        onScroll={onBodyScroll}
        {...(detail && {
          onPointerDown: onBodyPointerDown,
          onPointerMove,
          onPointerUp: finishDrag,
          onPointerCancel: finishDrag,
          onClickCapture: onBodyClickCapture,
        })}
      >
        {children}
      </div>
    </section>
  );
}
