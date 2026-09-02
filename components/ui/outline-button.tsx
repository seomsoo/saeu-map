import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/cx";

/** 보조 액션 버튼 — 헤어라인 아웃라인 (버틸까 OutlineButton). */
export function OutlineButton({
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<"button">, "type">) {
  return (
    <button
      type="button"
      className={cx(
        "press inline-flex h-10 items-center justify-center gap-0.5 rounded-8 border border-line bg-bg px-4 text-body-m-semibold text-fg-secondary transition-colors active:bg-bg-sunken disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
