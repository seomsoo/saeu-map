import { cx } from "@/lib/cx";

export interface SegmentedOption<K extends string> {
  key: K;
  label: string;
}

interface SegmentedProps<K extends string> {
  /** 접근성 이름 (role=group) */
  label: string;
  value: K;
  options: readonly SegmentedOption<K>[];
  onChange: (key: K) => void;
  className?: string | undefined;
}

/** 세그먼트 컨트롤 — 가라앉은 트랙 + 흰 활성 세그먼트 (버틸까 Tabs). */
export function Segmented<K extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SegmentedProps<K>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx("flex w-full items-center gap-1 rounded-12 bg-bg-sunken p-1.5", className)}
    >
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={active}
            onClick={() => {
              onChange(option.key);
            }}
            className={cx(
              "press flex min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-8 px-2.5 py-1.5 text-body-m-semibold transition-colors",
              active ? "bg-bg text-fg shadow-float" : "text-fg-tertiary",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
