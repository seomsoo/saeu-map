import Image from "next/image";
import Link from "next/link";
import type { EventCard as EventCardData } from "@/lib/types";

interface EventCardProps {
  card: EventCardData;
  onDismiss: () => void;
}

/**
 * 5. 이벤트 배너 — 시트·패널 본문 맨 위. 레드 틴트 카드(라운드 16) + 오른쪽에 새우 아트가 기울어 걸친다.
 * 카드 전체가 링크(화살표 없음), 닫기 ✕는 우상단. 공지 행 문법이던 v1은 밋밋해서 뺐다 (decisions 2026-09-08).
 * 제목·부제·링크·기간은 설정값, 닫기는 메모리 상태(새로고침 시 재노출).
 */
export function EventCard({ card, onDismiss }: EventCardProps) {
  const body = (
    <>
      <span className="block text-body-l-semibold text-brand-fg">{card.title}</span>
      {card.description && (
        <span className="mt-1 block max-w-52 text-caption-l-regular text-fg-secondary">
          {card.description}
        </span>
      )}
    </>
  );
  const bodyClass = "relative z-1 block min-w-0";

  return (
    <div className="relative mx-5 mt-1 mb-2 overflow-hidden rounded-16 bg-brand-tint px-4 py-4" aria-label="이벤트">
      {card.href ? (
        /* 링크 대상은 설정값이고 **없을 수 있다** — 없으면 아래 안내 카드가 된다. 없는 곳을 가리키면
           카드를 누를 때 404로 떨어지기 때문이다(2026-09-08). 지금은 `/test`가 있어 링크다(2026-09-09). */
        <Link href={card.href} prefetch={false} className={bodyClass}>
          {body}
        </Link>
      ) : (
        <div className={bodyClass}>{body}</div>
      )}
      {/* 아트가 카드 밖으로 살짝 잘려 나간다 — 장면이 있어야 배너로 읽힌다.
          기본 새우가 아니라 **테스트 3번 문항에서 잘라낸 장면**(껍질을 쥔 새우)이다: 배너 문구가 "까주기"인데
          그냥 새우가 있으면 겉돈다. 4:3 원본을 그대로 쓰면 100px 모서리에서 뭉개서 새우만 잘라 세로로 세웠고,
          머리가 왼쪽 위에 오는 구도라 오른쪽 위 닫기 ✕와 겹치지 않는다. 기울이지 않는다 (2026-09-09). */}
      <Image
        src="/peel-test/banner.webp"
        alt=""
        width={375}
        height={400}
        draggable={false}
        aria-hidden="true"
        className="pointer-events-none absolute -right-2 -bottom-4 h-24 w-auto object-contain"
      />
      {/* hit-44는 unlayered CSS라 position:relative가 absolute 유틸을 이긴다 — 자리는 래퍼가 잡는다 */}
      <span className="absolute top-2.5 right-2.5 z-1">
        <button
          type="button"
          onClick={onDismiss}
          aria-label="이벤트 카드 닫기"
          className="flex size-6 items-center justify-center rounded-max bg-bg text-brand-fg hit-44"
        >
          <span className="icon-[ci--close-md] size-3.5" aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}
