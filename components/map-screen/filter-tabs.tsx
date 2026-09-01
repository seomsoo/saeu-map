import type { TabKey } from "@/lib/types";
import { cx } from "@/lib/cx";

const TABS: readonly { key: TabKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "grill", label: "구이" },
  { key: "raw", label: "회" },
];

/** 5. 탭 — 전체/구이/회 (다중 태그 매칭). 활성만 채움. */
export function FilterTabs({
  tab,
  onChange,
}: {
  tab: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  return (
    <div
      role="group"
      aria-label="카테고리"
      className="inline-flex h-9 items-center gap-0.5 self-start rounded-control border border-border bg-surface p-0.5 shadow-[0_1px_2px_var(--color-shadow)]"
    >
      {TABS.map(({ key, label }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => {
              onChange(key);
            }}
            className={cx(
              "h-full min-w-[52px] rounded-[8px] px-3 text-[13px] font-medium transition-colors hit-44",
              active ? "bg-chip-active text-on-chip-active" : "text-ink-secondary",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
