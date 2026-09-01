import Link from "next/link";
import type { EventCard as EventCardData } from "@/lib/types";

interface EventCardProps {
  card: EventCardData;
  onDismiss: () => void;
}

/** 4. 이벤트 카드 슬롯 — 제목·링크·기간은 설정값. 닫기는 메모리 상태(새로고침 시 재노출). */
export function EventCard({ card, onDismiss }: EventCardProps) {
  const body = (
    <>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
        {card.title}
      </span>
      {card.href && (
        <span
          className="icon-[ci--chevron-right] size-4 shrink-0 text-ink-tertiary"
          aria-hidden="true"
        />
      )}
    </>
  );

  return (
    <div
      className="flex h-9 items-center gap-1 rounded-card border border-border bg-surface pl-3 pr-1 shadow-[0_1px_2px_var(--color-shadow)]"
      aria-label="이벤트"
    >
      {card.href ? (
        // 링크 대상은 설정값(/test는 Phase 7까지 404) — 프리페치하면 매 로드마다 404 콘솔 에러가 남는다
        <Link
          href={card.href}
          prefetch={false}
          className="flex min-w-0 flex-1 items-center gap-1"
        >
          {body}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-1">{body}</div>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="이벤트 카드 닫기"
        className="flex size-9 shrink-0 items-center justify-center text-ink-tertiary hit-44"
      >
        <span className="icon-[ci--close-md] size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
