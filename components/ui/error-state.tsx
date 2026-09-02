import { cx } from "@/lib/cx";
import { OutlineButton } from "./outline-button";

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
        "flex flex-col items-center justify-center gap-1 px-6 py-10 text-center",
        className,
      )}
    >
      <span
        className="icon-[ci--triangle-warning] mb-1 size-6 text-fg-tertiary"
        aria-hidden="true"
      />
      <p className="text-body-l-semibold text-fg">{title}</p>
      <p className="text-body-m-regular text-fg-secondary">{description}</p>
      {onRetry && (
        <OutlineButton className="mt-3" onClick={onRetry}>
          {retryLabel}
        </OutlineButton>
      )}
    </div>
  );
}
