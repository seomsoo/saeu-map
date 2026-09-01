import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/cx";

/** 칩: 아웃라인 기본, 활성만 채움 (design 공통 블록). */
export const chipVariants = cva(
  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-chip border font-medium leading-none transition-colors",
  {
    variants: {
      size: {
        md: "h-9 px-3.5 text-[13px]",
        sm: "h-7 px-2.5 text-xs",
        xs: "h-5 px-1.5 text-[11px]",
      },
      tone: {
        outline: "border-border bg-surface text-ink",
        active: "border-chip-active bg-chip-active text-on-chip-active",
        muted: "border-border bg-surface text-ink-tertiary",
        subtle: "border-transparent bg-surface-sunken text-ink-secondary",
      },
    },
    defaultVariants: { size: "md", tone: "outline" },
  },
);

type ChipVariants = VariantProps<typeof chipVariants>;

export function Chip({
  className,
  size,
  tone,
  ...props
}: ComponentPropsWithoutRef<"span"> & ChipVariants) {
  return (
    <span className={cx(chipVariants({ size, tone }), className)} {...props} />
  );
}

/** 토글 칩. pressed면 채움. 터치 타겟 44px은 .hit-44로 확보. */
export function ChipButton({
  className,
  size,
  pressed,
  ...props
}: Omit<ComponentPropsWithoutRef<"button">, "type"> &
  Pick<ChipVariants, "size"> & { pressed: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cx(
        chipVariants({ size, tone: pressed ? "active" : "outline" }),
        "hit-44",
        className,
      )}
      {...props}
    />
  );
}
