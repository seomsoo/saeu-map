import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

interface EmptyStateProps {
  title: string;
  description?: string | undefined;
  action?: ReactNode;
  className?: string | undefined;
}

/** 빈 상태 공용. 카피는 담백하게, 장난은 여기서만 허용(spec 7). */
export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cx(
        "flex flex-col items-center justify-center gap-1.5 px-6 py-10 text-center",
        className,
      )}
    >
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description && <p className="text-sm text-ink-secondary">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
