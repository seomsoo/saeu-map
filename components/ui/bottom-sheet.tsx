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
import { useKeyboardInset } from "./use-keyboard-inset";

export type SheetSnap = "collapsed" | "half" | "full";
/**
 * list = 화면 1 목록(3단, 항상 열림) / detail = 화면 2 상세(요약·전체 2단 + 아래로 스와이프하면 닫힘)
 * report = 화면 3 제보(요약·전체 2단, 닫기는 헤더 ✕뿐 — 입력 중인 값이 스와이프 한 번에 사라지면 안 된다)
 * me = 화면 5 내 활동(제보와 같은 기하·헤더·no-dismiss. 전체로 열리고 닫기는 ✕·뒤로가기)
 */
export type SheetMode = "list" | "detail" | "report" | "me";
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
/**
 * 상세 요약 = 30%, 최소 270px. 하한은 임의값이 아니라 내용에서 나온 값이다 —
 * 헤더 44 + 사진 144 + 상호 블록(상호·카테고리·확인 캡션) = 257px에 바닥 여백 13.
 * 뷰포트가 어떻든 "○일 전 확인"까지는 보이고, 그 아래(정보·버튼 줄)는 스크롤이나 펼침으로 본다.
 */
export const SHEET_DETAIL_HALF_RATIO = 0.3;
export const SHEET_DETAIL_HALF_MIN_PX = 270;
/**
 * 제보 요약(2단계, 지도에서 핀을 맞추는 동안) = 40%, 최소 330px — 상세의 270에는 안 들어간다:
 * 헤더 44 + 진행바 6 + ‹ 줄 44 + 제목 34 + 4 + 캡션 20 + 20 + 주소 입력 48 + CTA 줄(12+48+12) = 292에
 * 오류 한 줄(20) 여유. 그래도 390×844에서 지도가 500px 남는다(decisions 2026-09-04).
 */
export const SHEET_REPORT_HALF_RATIO = 0.4;
export const SHEET_REPORT_HALF_MIN_PX = 330;
/** 상세·제보 헤더 = 핸들 + 오른쪽 닫기 ✕ (44px 히트) */
export const SHEET_DETAIL_HEADER_PX = 44;
/** 상세: 요약 위치보다 이만큼 더 내린 채 놓으면 닫힘 */
export const SHEET_DISMISS_PX = 100;

const DRAG_THRESHOLD_PX = 4;
const FLING_VELOCITY = 0.6; // px/ms
/** 포인터 탭·드래그 직후 따라오는 click(캡처로 리타겟될 수 있음)을 무시하는 창 */
const CLICK_SUPPRESS_MS = 250;

/**
 * 시트 계산의 기준 높이. **키보드가 뜨면 보이는 창이 기준**이라 CSS의 `--sheet-vh`와 같은 값이다.
 * `window.innerHeight`를 쓰면 키보드 높이만큼 과대평가해 드래그가 엉뚱한 스냅으로 간다 (Codex PR #7 #2).
 */
export function sheetViewportHeight(): number {
  return Math.round(window.visualViewport?.height ?? window.innerHeight);
}

/** 시트 바닥의 화면 y. `fixed` + `bottom: var(--kb)`라 보이는 창의 바닥과 같다. */
export function sheetBottomY(): number {
  const vv = window.visualViewport;
  return vv ? Math.round(vv.offsetTop + vv.height) : window.innerHeight;
}

export function sheetSnaps(mode: SheetMode): readonly SheetSnap[] {
  return mode === "list" ? ["collapsed", "half", "full"] : ["half", "full"];
}

/** 스냅별 보이는 높이(px). 카드 탭 시 지도 오프셋 계산에도 쓴다. */
export function sheetVisiblePx(
  snap: SheetSnap,
  viewportHeight: number,
  mode: SheetMode = "list",
  /** `@media (max-height)`는 레이아웃 뷰포트를 본다 — 키보드로 줄어든 값이 아니다 */
  layoutHeight: number = viewportHeight,
): number {
  const full = Math.round(viewportHeight * SHEET_FULL_RATIO);
  /** CSS의 `min(..., --sheet-full)`과 같은 clamp. px 하한이 시트 높이를 넘으면 시트가 앵커 위로 솟는다 */
  const fit = (px: number) => Math.min(px, full);
  if (mode === "detail") {
    switch (snap) {
      case "collapsed":
      case "half":
        return fit(
          Math.max(
            Math.round(viewportHeight * SHEET_DETAIL_HALF_RATIO),
            SHEET_DETAIL_HALF_MIN_PX,
          ),
        );
      case "full":
        return full;
    }
  }
  if (mode === "report") {
    switch (snap) {
      case "collapsed":
      case "half":
        return fit(
          Math.max(
            Math.round(viewportHeight * SHEET_REPORT_HALF_RATIO),
            SHEET_REPORT_HALF_MIN_PX,
          ),
        );
      case "full":
        return full;
    }
  }
  switch (snap) {
    case "collapsed":
      return fit(SHEET_COLLAPSED_PX);
    case "half":
      return layoutHeight <= SHEET_SHORT_VIEWPORT_MAX
        ? fit(SHEET_COLLAPSED_PX)
        : fit(Math.round(viewportHeight * SHEET_HALF_RATIO));
    case "full":
      return full;
  }
}

/** (목록만) 낮은 뷰포트에서는 half가 collapsed와 같은 높이라 단계에서 뺀다 (탭·플링이 무반응으로 보이지 않게). */
function halfIsCollapsed(viewportHeight: number): boolean {
  return sheetVisiblePx("half", viewportHeight) === SHEET_COLLAPSED_PX;
}

/** 핸들 탭: 목록 collapsed → half → full → collapsed / 상세·제보 half ↔ full */
export function nextSnapOnTap(
  current: SheetSnap,
  viewportHeight: number,
  mode: SheetMode = "list",
): SheetSnap {
  if (mode !== "list") return current === "full" ? "half" : "full";
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
  if (mode !== "list") return direction === "up" ? "full" : "half";
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
 * 제보는 닫힘이 없다 — 아래로 튕겨도 요약에 머문다(닫기는 헤더 ✕뿐).
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
  startX: number;
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
  /** 가로 스크롤 영역(사진 스트립)에서 시작 — 가로가 우세하면 그쪽에 양보한다 */
  panX: boolean;
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
  /** 기본 list. detail은 핸들만 남기고 본문 드래그·아래로 스와이프 닫기를 켠다. report는 헤더만 상세와 같고 본문 드래그·스와이프 닫기가 없다. */
  mode?: SheetMode;
  handleLabel?: string;
  /** 상세 모드에서 아래로 스와이프해 닫을 때. 헤더 오른쪽 ✕ 버튼도 이걸 부른다(상세·제보). */
  onDismiss?: (() => void) | undefined;
  /** 헤더 ✕의 접근 가능한 이름 (상세·제보 모드) */
  dismissLabel?: string;
}

/**
 * 하단 시트 — 항상 열려 있는 비모달. 목록 3단(collapsed/half/full), 상세 2단(half/full) + 닫힘.
 * 목록: 드래그는 핸들·헤더에서만 받아 리스트 스크롤과 충돌하지 않는다. 지도는 시트 위 영역에서 계속 조작 가능.
 * 상세: 요약(half)에서 본문을 끌면 시트가 움직이고, 위로 끌면 전체로 펼쳐진다(스크롤 체이닝 — Material 3
 *       BottomSheetBehavior·iOS 시트의 기본이자 국내 지도 앱들의 동작). 전체(full)에선 본문이 스크롤되고
 *       맨 위에서 아래로 끄는 것만 시트 드래그로 가로챈다(non-passive touchmove로 브라우저 스크롤 선점 차단).
 *       요약에서도 본문은 스크롤 컨테이너로 남는다 — 잠그면 휠·키보드로는 본문에 닿을 길이 없다.
 *       닫기 ✕는 본문이 아니라 헤더(시트 크롬)에 있다 — 사진 유무·스크롤 위치와 무관하게 늘 같은 자리.
 * 제보: 헤더(핸들 + ✕)와 2단(half/full)은 상세와 같지만 본문 드래그가 없고(입력 폼이라 스크롤·선택이 우선)
 *       아래로 끌어도 요약 아래로는 안 내려간다 — 닫기는 ✕뿐(design 화면 3).
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
  dismissLabel = "닫기",
}: BottomSheetProps) {
  // 키보드가 뜨면 시트가 그 위에 앉는다 (--kb → .saeu-sheet의 bottom·--sheet-full)
  useKeyboardInset();
  const sheetRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const lastPointerCycleAt = useRef(0);
  const lastBodyDragEndAt = useRef(0);
  const detail = mode === "detail";
  /** 상세·제보 공통: 헤더는 핸들 44 + ✕, 목록 헤더 없음 */
  const panel = mode !== "list";

  const cycleSnap = useCallback(() => {
    onSnapChange(nextSnapOnTap(snap, sheetViewportHeight(), mode));
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
      startX: e.clientX,
      startY: e.clientY,
      // 시트 바닥은 보이는 창의 바닥이다 — innerHeight를 쓰면 키보드 높이만큼 부풀려진다
      startVisible: sheetBottomY() - rect.top,
      lastY: e.clientY,
      lastT: e.timeStamp,
      velocity: 0,
      moved: false,
      fromHandle,
      source,
      panX: (e.target as Element).closest("[data-pan-x]") !== null,
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

    const vh = sheetViewportHeight();
    // 상세는 0까지(닫힘 판정), 제보는 요약이 바닥(닫힘 없음), 목록은 collapsed
    const min =
      mode === "report"
        ? sheetVisiblePx("half", vh, "report")
        : detail
          ? 0
          : SHEET_COLLAPSED_PX;
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
      viewportHeight: sheetViewportHeight(),
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

  // 본문 터치를 시트 드래그로 쓸 때 브라우저의 스크롤(오버스크롤) 선점을 막는다.
  // 요약에선 어느 방향이든 시트가 먼저 반응하고(체이닝: 위로 끌면 전체로 펼쳐진다),
  // 전체에선 맨 위에서 아래로 끄는 것만 가로챈다 — 나머지는 본문 스크롤이다.
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
      const dy = touch.clientY - drag.startY;
      // 사진 스트립처럼 가로로 스크롤되는 영역에서 시작했고 가로가 우세하면 이 제스처는 시트 것이 아니다.
      // 양보하지 않으면 요약에선 항상, 전체에선 dy가 0이라 아래로 끄는 것으로 읽혀 스트립이 영영 안 넘어간다.
      if (drag.panX && !drag.moved && Math.abs(touch.clientX - drag.startX) > Math.abs(dy)) {
        dragRef.current = null;
        return;
      }
      if (snap === "half" || drag.moved || dy >= 0) {
        e.preventDefault();
      }
    };
    body.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      body.removeEventListener("touchmove", onTouchMove);
    };
  }, [detail, snap]);

  // 요약으로 돌아오면 본문을 맨 위로 (전체에서 스크롤한 채 요약이 되면 위가 잘린다)
  useEffect(() => {
    if (panel && snap === "half" && bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [panel, snap]);

  // 목록 스크롤 위치는 상세·제보가 열리는 동안 기억했다가 돌아올 때 복원 (목록 본문은 hidden으로 유지된다)
  const listScrollTop = useRef(0);
  const onBodyScroll = (e: { currentTarget: HTMLDivElement }) => {
    if (!panel) listScrollTop.current = e.currentTarget.scrollTop;
  };
  useEffect(() => {
    if (!panel && bodyRef.current) bodyRef.current.scrollTop = listScrollTop.current;
  }, [panel]);

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
            "absolute inset-x-0 -top-13 flex items-center justify-between pl-safe-left-or-5 pr-safe-right-or-5",
            snap === "full" && "hidden",
          )}
        >
          {aside}
        </div>
      )}
      <div
        className={cx(
          "saeu-sheet__header relative flex shrink-0 flex-col touch-none select-none",
          !panel && "border-b border-line-hairline",
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
          className={cx(
            "flex w-full shrink-0 items-center justify-center",
            panel ? "h-11" : "h-6.5",
          )}
        >
          <span
            aria-hidden="true"
            className="block h-1.5 w-12.5 rounded-max bg-line-hairline"
          />
        </button>
        {panel && onDismiss && (
          /* 헤더는 pointerdown에서 즉시 캡처하므로, 막지 않으면 이 버튼의 click이 헤더로 리타겟된다 */
          <button
            type="button"
            aria-label={dismissLabel}
            /* 인자 없이 부른다 — 닫기 함수들은 (source)를 받는데 MouseEvent가 들어가면 "ui" 판정이 깨져
               히스토리 엔트리가 남는다 (gap-sweeper 2026-09-04) */
            onClick={() => {
              onDismiss();
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            className="absolute top-0 right-safe-right-or-2 flex size-11 items-center justify-center text-fg-tertiary"
          >
            <span className="icon-[ci--close-md] size-5" aria-hidden="true" />
          </button>
        )}
        {!panel && (
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
