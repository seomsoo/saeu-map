import { cx } from "@/lib/cx";

interface ErrorStateProps {
  title?: string | undefined;
  description?: string | undefined;
  onRetry?: (() => void) | undefined;
  retryLabel?: string | undefined;
  className?: string | undefined;
}

/** 에러 상태 공용. 내부 정보(스택·메시지 원문)는 노출하지 않는다. */
export function ErrorState({
  title = "불러오지 못했어요",
  description = "잠시 후 다시 시도해주세요.",
  onRetry,
  retryLabel = "다시 시도",
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cx(
        "flex flex-col items-center justify-center gap-1.5 px-6 py-10 text-center",
        className,
      )}
    >
      <span
        className="icon-[ci--triangle-warning] size-6 text-ink-tertiary"
        aria-hidden="true"
      />
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      <p className="text-sm text-ink-secondary">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 h-10 rounded-control border border-border-strong bg-surface px-4 text-sm font-medium text-ink"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
