"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { chipVariants } from "./chip";
import { cx } from "@/lib/cx";

export interface DropdownOption<K extends string> {
  key: K;
  label: string;
}

interface DropdownChipProps<K extends string> {
  /** 접근성 이름 — 트리거는 "{label}: {현재값}", 목록은 label */
  label: string;
  value: K;
  options: readonly DropdownOption<K>[];
  onChange: (key: K) => void;
  /** 틴트(활성) 여부. 기본은 첫 옵션(기본값)이 아닐 때 */
  active?: boolean | undefined;
  className?: string | undefined;
}

/** 목록 폭(px) — w-40과 같아야 한다 */
const LIST_WIDTH = 160;
const LIST_GAP = 6;
const VIEWPORT_MARGIN = 12;

/**
 * 드롭다운 칩 — 현재값 + 캐럿, 누르면 아래에 목록 (버틸까 "기간 ▾" Filter Chip + Dropdown_M).
 * 목록은 body 포털 + fixed 좌표라 가로 스크롤 컨테이너 안에 있어도 잘리지 않는다.
 * 열린 채 스크롤·리사이즈되면 트리거를 따라 다시 자리 잡는다.
 */
export function DropdownChip<K extends string>({
  label,
  value,
  options,
  onChange,
  active,
  className,
}: DropdownChipProps<K>) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const listId = useId();
  const current = options.find((o) => o.key === value) ?? options[0];
  const isActive = active ?? value !== options[0]?.key;

  // 트리거 아래 좌표 (뷰포트 밖으로 나가지 않게 클램프)
  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - LIST_WIDTH - VIEWPORT_MARGIN);
    setPos({
      top: rect.bottom + LIST_GAP,
      left: Math.min(Math.max(rect.left, VIEWPORT_MARGIN), maxLeft),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    // 칩 행 가로 스크롤을 포함해 어떤 스크롤·리사이즈에도 트리거를 따라간다 (capture)
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const list = open && (
    <ul
      ref={listRef}
      id={listId}
      role="listbox"
      aria-label={label}
      style={pos ? { top: pos.top, left: pos.left } : undefined}
      className={cx(
        "fixed z-30 w-40 overflow-hidden rounded-12 bg-bg py-1 shadow-card",
        !pos && "invisible",
      )}
    >
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <li key={option.key} role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => {
                onChange(option.key);
                setOpen(false);
              }}
              className={cx(
                "flex h-11 w-full items-center justify-between gap-3 px-4 text-left text-body-m-medium active:bg-bg-sunken",
                selected ? "text-fg" : "text-fg-secondary",
              )}
            >
              {option.label}
              {selected && (
                <span className="icon-[ci--check] size-4 text-brand-fg" aria-hidden="true" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className={cx("shrink-0", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${current?.label ?? ""}`}
        onClick={() => {
          setOpen((v) => !v);
        }}
        className={cx(
          chipVariants({ size: "md", tone: isActive ? "active" : "outline" }),
          "press hit-44 pr-2 shadow-float",
        )}
      >
        {current?.label}
        <span
          className={cx(
            "icon-[ci--chevron-down] size-5 transition-transform",
            isActive ? "text-brand-fg" : "text-fg-placeholder",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {list && createPortal(list, document.body)}
    </div>
  );
}
