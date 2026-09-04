import { cx } from "@/lib/cx";

export interface SegmentOption<K extends string> {
  key: K;
  label: string;
}

interface SegmentedProps<K extends string> {
  /** 접근성 이름 — 탭 목록 */
  label: string;
  value: K;
  options: readonly SegmentOption<K>[];
  onChange: (key: K) => void;
  className?: string | undefined;
}

/**
 * 세그먼트 컨트롤 — 가라앉은 트랙(bg-sunken, 라운드 8, 안 여백 2) + 흰 활성 세그먼트(라운드 6, 옅은 그림자).
 * 공통 블록 "정렬·탭 전환은 세그먼트". 호출자: 내 활동 탭(찜/내 리뷰/내 제보).
 */
export function Segmented<K extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SegmentedProps<K>) {
  return (
    <div role="tablist" aria-label={label} className={cx("flex h-9 rounded-8 bg-bg-sunken p-0.5", className)}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => {
              onChange(option.key);
            }}
            className={cx(
              "press flex-1 rounded-6 text-body-m-medium transition-colors",
              selected ? "bg-bg text-fg shadow-float" : "text-fg-secondary",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
