"use client";

import {
  useCallback,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { cx } from "@/lib/cx";

export type SheetSnap = "collapsed" | "half" | "full";

/*
 * 스냅 위치 상수 — app/globals.css의 .saeu-sheet 변수와 반드시 같아야 한다.
 * CSS가 초기 렌더(SSR)와 전환을 담당하고, JS는 드래그 놓을 때의 스냅 판정에만 쓴다.
 */
export const SHEET_COLLAPSED_PX = 88;
export const SHEET_HALF_RATIO = 0.4;
export const SHEET_FULL_RATIO = 0.92;
/** 이 높이 이하(예: 320×568)에서는 half = collapsed (상단 스택이 지도를 다 가리는 것 방지) */
export const SHEET_SHORT_VIEWPORT_MAX = 639;

const DRAG_THRESHOLD_PX = 4;
const FLING_VELOCITY = 0.6; // px/ms
/** 포인터 탭으로 스냅을 바꾼 직후 따라오는 click(캡처로 리타겟될 수 있음)을 무시하는 창 */
const CLICK_SUPPRESS_MS = 250;

/** 스냅별 보이는 높이(px). 카드 탭 시 지도 오프셋 계산에도 쓴다. */
export function sheetVisiblePx(snap: SheetSnap, viewportHeight: number): number {
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

/** 낮은 뷰포트에서는 half가 collapsed와 같은 높이라 단계에서 뺀다 (탭·플링이 무반응으로 보이지 않게). */
function halfIsCollapsed(viewportHeight: number): boolean {
  return sheetVisiblePx("half", viewportHeight) === SHEET_COLLAPSED_PX;
}

/** 핸들 탭: collapsed → half → full → collapsed */
export function nextSnapOnTap(current: SheetSnap, viewportHeight: number): SheetSnap {
  switch (current) {
    case "collapsed":
      return halfIsCollapsed(viewportHeight) ? "full" : "half";
    case "half":
      return "full";
    case "full":
      return "collapsed";
  }
}

/** 플링: 한 단계만 이동 */
export function neighborSnap(
  current: SheetSnap,
  direction: "up" | "down",
  viewportHeight: number,
): SheetSnap {
  const skipHalf = halfIsCollapsed(viewportHeight);
  if (direction === "up") {
    if (current === "collapsed") return skipHalf ? "full" : "half";
    return "full";
  }
  if (current === "full") return skipHalf ? "collapsed" : "half";
  return "collapsed";
}

function nearestSnap(visible: number, viewportHeight: number): SheetSnap {
  const snaps: SheetSnap[] = ["collapsed", "half", "full"];
  let best: SheetSnap = "half";
  let bestDist = Number.POSITIVE_INFINITY;
  for (const s of snaps) {
    const d = Math.abs(sheetVisiblePx(s, viewportHeight) - visible);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
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
}

interface BottomSheetProps {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  /** 핸들 아래 헤더. 이 영역이 드래그 영역이다. 높이는 --sheet-header-h(88px)로 고정. */
  header: ReactNode;
  /** 시트 가장자리 위에 얹히는 요소(FAB 줄). 시트와 함께 움직이고 full에서는 숨긴다. */
  aside?: ReactNode;
  /** 스크롤 영역 */
  children: ReactNode;
  label: string;
  className?: string | undefined;
}

/**
 * 하단 시트 — 항상 열려 있는 비모달. 스냅 3단(collapsed/half/full).
 * 드래그는 핸들·헤더에서만 받아 리스트 스크롤과 충돌하지 않는다. 지도는 시트 위 영역에서 계속 조작 가능.
 */
export function BottomSheet({
  snap,
  onSnapChange,
  header,
  aside,
  children,
  label,
  className,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const lastPointerCycleAt = useRef(0);

  const cycleSnap = useCallback(() => {
    onSnapChange(nextSnapOnTap(snap, window.innerHeight));
  }, [snap, onSnapChange]);

  const setDragOffset = (px: number, dragging: boolean) => {
    const el = sheetRef.current;
    if (!el) return;
    el.style.setProperty("--sheet-drag", `${px}px`);
    el.dataset["dragging"] = dragging ? "true" : "false";
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || dragRef.current) return;
    const target = e.target as Element;
    // 헤더 안의 컨트롤(정렬 메뉴 등)을 누른 건 드래그가 아니다. 핸들 버튼만 예외.
    if (
      target.closest("button, a, input, select, textarea, [role='listbox']") &&
      !target.closest("[data-sheet-handle]")
    ) {
      return;
    }
    const el = sheetRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startVisible: window.innerHeight - rect.top,
      lastY: e.clientY,
      lastT: e.timeStamp,
      velocity: 0,
      moved: false,
      fromHandle: target.closest("[data-sheet-handle]") !== null,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
    drag.moved = true;
    const dt = e.timeStamp - drag.lastT;
    if (dt > 0) drag.velocity = (e.clientY - drag.lastY) / dt;
    drag.lastY = e.clientY;
    drag.lastT = e.timeStamp;

    const vh = window.innerHeight;
    const min = SHEET_COLLAPSED_PX;
    const max = sheetVisiblePx("full", vh);
    const visible = Math.min(max, Math.max(min, drag.startVisible - dy));
    setDragOffset(drag.startVisible - visible, true);
  };

  const finishDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragOffset(0, false);
    if (!drag.moved) {
      // 포인터 캡처 중엔 click이 핸들 버튼이 아니라 래퍼로 갈 수 있어 탭을 여기서 처리한다
      if (drag.fromHandle && e.type === "pointerup") {
        lastPointerCycleAt.current = e.timeStamp;
        cycleSnap();
      }
      return;
    }

    const vh = window.innerHeight;
    const visible = drag.startVisible - (e.clientY - drag.startY);
    const next =
      Math.abs(drag.velocity) > FLING_VELOCITY
        ? neighborSnap(snap, drag.velocity < 0 ? "up" : "down", vh)
        : nearestSnap(visible, vh);
    if (next !== snap) onSnapChange(next);
  };

  // 키보드(Enter/Space) 경로. 포인터 탭은 finishDrag가 이미 처리했으므로 직후 click은 무시.
  const onHandleClick = (e: { timeStamp: number }) => {
    if (e.timeStamp - lastPointerCycleAt.current < CLICK_SUPPRESS_MS) return;
    cycleSnap();
  };

  return (
    <section
      ref={sheetRef}
      aria-label={label}
      data-snap={snap}
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
        className="saeu-sheet__header flex shrink-0 flex-col border-b border-line-hairline touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <button
          type="button"
          data-sheet-handle
          aria-label="목록 크기 조절"
          onClick={onHandleClick}
          className="flex h-6.5 w-full shrink-0 items-center justify-center"
        >
          <span
            aria-hidden="true"
            className="block h-1.5 w-12.5 rounded-max bg-line-hairline"
          />
        </button>
        <div className="flex min-h-0 flex-1 items-center px-5 pb-4">{header}</div>
      </div>
      {/* 높이는 CSS(.saeu-sheet__body)가 스냅별로 정한다 — flex-1을 주면 92dvh 전체로 늘어나 스크롤 영역이 화면 밖까지 이어진다 */}
      <div className="saeu-sheet__body min-h-0 shrink-0">{children}</div>
    </section>
  );
}
