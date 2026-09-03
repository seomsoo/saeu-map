import { cx } from "@/lib/cx";

interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string | undefined;
}

/** 스위치 행 — 라벨(16 medium) 왼쪽, 오른쪽 44×24 트랙(line → brand) + 흰 썸. 행 전체가 표적(44px). */
export function Switch({ label, checked, onChange, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        onChange(!checked);
      }}
      className={cx("press flex min-h-11 w-full items-center justify-between gap-3 text-left", className)}
    >
      <span className="text-body-l-medium text-fg">{label}</span>
      <span
        aria-hidden="true"
        className={cx(
          "relative h-6 w-11 shrink-0 rounded-max transition-colors",
          checked ? "bg-brand" : "bg-line",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 left-0.5 size-5 rounded-max bg-bg shadow-float transition-transform",
            checked && "translate-x-5",
          )}
        />
      </span>
    </button>
  );
}
