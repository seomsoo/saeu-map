import Link from "next/link";
import type { EventCard as EventCardData } from "@/lib/types";

interface EventCardProps {
  card: EventCardData;
  onDismiss: () => void;
}

/**
 * 5. 이벤트 행 — 시트 본문 맨 위. 공지/이벤트 리스트 행 문법: 아이콘 타일 + 제목·부제 + 닫기 ×.
 * 행 전체가 링크(화살표 없음). 제목·부제·링크·기간은 설정값, 닫기는 메모리 상태(새로고침 시 재노출).
 */
export function EventCard({ card, onDismiss }: EventCardProps) {
  const body = (
    <>
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-max bg-brand-tint text-brand-fg"
        aria-hidden="true"
      >
        <span className="icon-[ci--gift] size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-m-semibold text-fg">{card.title}</span>
        {card.description && (
          <span className="block truncate text-caption-l-regular text-fg-secondary">
            {card.description}
          </span>
        )}
      </span>
    </>
  );
  const bodyClass = "flex min-w-0 flex-1 items-center gap-3";

  return (
    <div
      className="flex items-center gap-1 border-b border-line-hairline py-3 pr-3 pl-5"
      aria-label="이벤트"
    >
      {card.href ? (
        // 링크 대상은 설정값(/test는 Phase 7까지 404) — 프리페치하면 매 로드마다 404 콘솔 에러가 남는다
        <Link href={card.href} prefetch={false} className={bodyClass}>
          {body}
        </Link>
      ) : (
        <div className={bodyClass}>{body}</div>
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
