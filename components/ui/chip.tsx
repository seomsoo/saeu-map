import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/cx";

/** 칩: pill 아웃라인 기본, 활성은 브랜드 틴트 (docs/design.md 공통 블록). */
export const chipVariants = cva(
  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap border transition-colors",
  {
    variants: {
      size: {
        md: "h-9 px-3.5 text-body-m-medium",
        sm: "h-8 px-3 text-body-m-medium",
        xs: "h-5 px-2 text-caption-l-medium",
      },
      tone: {
        outline: "rounded-max border-line bg-bg text-fg",
        active: "rounded-max border-brand-fg bg-brand-tint text-brand-fg",
        muted: "rounded-max border-line bg-bg text-fg-tertiary",
        /* 단위·사이드 미니칩: 보더 없이 가라앉은 배경 */
        subtle: "rounded-6 border-transparent bg-bg-sunken text-fg-secondary",
        /* 상세 사이드 "없음": pill, 가라앉은 배경, 회색 글자 (버틸까 Disabled 칩) */
        disabled: "rounded-max border-transparent bg-bg-sunken text-fg-placeholder",
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

/** 토글 칩. pressed면 틴트. 터치 타겟 44px은 .hit-44로 확보. */
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
        "press hit-44",
        className,
      )}
      {...props}
    />
  );
}
