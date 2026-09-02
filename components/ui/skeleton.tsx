import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/cx";

/** 로딩 스켈레톤 조각(shimmer). 크기는 className으로. */
export function Skeleton({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cx("skeleton rounded-8", className)}
      {...props}
    />
  );
}
