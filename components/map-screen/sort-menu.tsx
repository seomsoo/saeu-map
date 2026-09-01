"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SORT_KEYS, SORT_LABELS } from "@/lib/places";
import type { SortKey } from "@/lib/types";
import { cx } from "@/lib/cx";

/** 정렬 드롭다운 — 가까운순 / 최근 확인순 / 확인 많은 순. 랭킹 없음. */
export function SortMenu({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (sort: SortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
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
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="inline-flex h-8 items-center gap-0.5 rounded-control pl-2 pr-1 text-[13px] font-medium text-ink hit-44"
      >
        {SORT_LABELS[value]}
        <span
          className={cx(
            "icon-[ci--chevron-down] size-4 text-ink-secondary transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="정렬"
          className="absolute right-0 top-full z-10 mt-1 min-w-[140px] overflow-hidden rounded-card border border-border bg-surface py-1 shadow-[0_4px_16px_var(--color-shadow)]"
        >
          {SORT_KEYS.map((key) => {
            const selected = key === value;
            return (
              <li key={key} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  className={cx(
                    "flex h-10 w-full items-center justify-between gap-3 px-3 text-left text-sm",
                    selected ? "font-semibold text-ink" : "text-ink-secondary",
                  )}
                >
                  {SORT_LABELS[key]}
                  {selected && (
                    <span className="icon-[ci--check] size-4" aria-hidden="true" />
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
