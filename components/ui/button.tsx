import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/cx";

/**
 * 버튼 (docs/design.md 공통 블록·화면 2).
 * variant — ink: 잉크 채움 주 버튼(길찾기) / brand: 채운 레드(화면당 한 곳) / outline: 헤어라인 아웃라인 / tint: 레드 틴트(완료·활성)
 * size — sm 28(라운드 8, [복사]) / md 40(라운드 8) / lg 44(라운드 12, [리뷰 남기기]) / xl 48(라운드 12, 버튼 줄) / pill 36(pill)
 */
export const buttonVariants = cva(
  "press inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap border transition-colors disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        ink: "border-transparent bg-fg text-fg-on-brand",
        brand: "border-transparent bg-brand text-fg-on-brand",
        outline: "border-line bg-bg text-fg active:bg-bg-sunken",
        tint: "border-brand bg-brand-tint text-brand-fg",
      },
      size: {
        sm: "h-7 rounded-8 px-3 text-body-m-semibold text-fg-secondary",
        md: "h-10 rounded-8 px-4 text-body-m-semibold",
        lg: "h-11 rounded-12 px-4 text-body-m-semibold",
        xl: "h-12 rounded-12 px-4 text-body-m-semibold",
        pill: "h-9 rounded-max pl-3 pr-3.5 text-body-m-semibold",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

type ButtonVariants = VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ComponentPropsWithoutRef<"button"> & ButtonVariants) {
  return (
    <button
      type={type}
      className={cx(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
