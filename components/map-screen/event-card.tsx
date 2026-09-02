import Link from "next/link";
import type { EventCard as EventCardData } from "@/lib/types";

interface EventCardProps {
  card: EventCardData;
  onDismiss: () => void;
}

/** 5. 이벤트 카드 슬롯 — 시트 본문 맨 위. 제목·링크·기간은 설정값, 닫기는 메모리 상태(새로고침 시 재노출). */
export function EventCard({ card, onDismiss }: EventCardProps) {
  const body = (
    <>
      <span className="min-w-0 flex-1 truncate text-body-m-medium text-fg">{card.title}</span>
      {card.href && (
        <span
          className="icon-[ci--chevron-right] size-4 shrink-0 text-fg-placeholder"
          aria-hidden="true"
        />
      )}
    </>
  );

  return (
    <div
      className="mx-5 mt-3 flex h-10 items-center gap-1 rounded-12 bg-bg-sunken pl-4 pr-1"
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
        className="flex size-8 shrink-0 items-center justify-center text-fg-placeholder hit-44"
      >
        <span className="icon-[ci--close-md] size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
