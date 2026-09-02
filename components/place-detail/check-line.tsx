import { Button, buttonVariants } from "@/components/ui/button";
import { relativeCheckLabel } from "@/lib/time";
import type { Place } from "@/lib/types";

interface CheckLineProps {
  place: Place;
  now: string;
  /** 이 세션에서 이미 확인함(핀당 하루 1회) 또는 낙관적 반영 중 */
  done: boolean;
  onCheckIn: () => void;
}

/**
 * 3. 확인 줄 — "어제 확인" / "확인 4회" + [✓ 다녀왔다면] 레드 pill(화면의 유일한 채운 레드).
 * 누르면 즉시 +1·오늘 확인으로 바뀌고 pill은 틴트 "확인했어요"(더 못 누름). 실패는 부모가 원복 + 토스트.
 */
export function CheckLine({ place, now, done, onCheckIn }: CheckLineProps) {
  return (
    <div className="flex items-center gap-3 border-y border-line-hairline px-5 py-3">
      <span className="icon-[ci--check] size-5 shrink-0 text-fg-tertiary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-body-m-medium text-fg">{relativeCheckLabel(place.lastCheckedAt, now)}</p>
        <p className="text-caption-l-regular text-fg-tertiary tabular-nums">
          확인 {place.checkCount}회
        </p>
      </div>
      {done ? (
        <span role="status" className={buttonVariants({ variant: "tint", size: "pill" })}>
          <span className="icon-[ci--check] size-4" aria-hidden="true" />
          확인했어요
        </span>
      ) : (
        <Button variant="brand" size="pill" onClick={onCheckIn}>
          <span className="icon-[ci--check] size-4" aria-hidden="true" />
          다녀왔다면
        </Button>
      )}
    </div>
  );
}
