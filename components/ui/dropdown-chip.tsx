"use client";

import { useEffect, useId, useRef, useState } from "react";
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

/**
 * 드롭다운 칩 — 현재값 + 캐럿, 누르면 아래에 목록 (버틸까 "기간 ▾" Filter Chip + Dropdown_M).
 * 목록은 absolute라 가로 스크롤 컨테이너 안에 두면 잘린다 — 스크롤 밖에 놓을 것.
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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const current = options.find((o) => o.key === value) ?? options[0];
  const isActive = active ?? value !== options[0]?.key;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cx("relative shrink-0", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
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
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute top-full left-0 z-10 mt-1.5 w-40 overflow-hidden rounded-12 bg-bg py-1 shadow-card"
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
      )}
    </div>
  );
}
