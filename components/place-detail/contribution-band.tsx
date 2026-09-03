import { Button, buttonVariants } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { relativeCheckAgo } from "@/lib/time";
import type { Place } from "@/lib/types";

interface ContributionBandProps {
  place: Place;
  now: string;
  /** 이 세션에서 이미 확인함(핀당 하루 1회) 또는 낙관적 반영 중 */
  done: boolean;
  onCheckIn: () => void;
  onWriteReview: () => void;
}

/**
 * 7. 기여 블록 — 사이드와 리뷰 사이. 확인 줄(정보 행 안에 액션 pill)을 해체해 액션만 여기로 모았다.
 * 신선도 자체는 상호 아래 캡션이 이미 말하므로 여기선 "그래서 뭘 하면 되나"만 남긴다.
 * 누르면 즉시 +1·오늘 확인으로 바뀌고 버튼은 틴트 "확인했어요"(더 못 누름). 실패는 부모가 원복 + 토스트.
 */
export function ContributionBand({
  place,
  now,
  done,
  onCheckIn,
  onWriteReview,
}: ContributionBandProps) {
  return (
    <section aria-labelledby="place-contribution-heading" className="px-5 pt-4 pb-4">
      <h3 id="place-contribution-heading" className="text-body-l-semibold text-fg">
        여기 다녀오셨나요?
      </h3>
      <p className="mt-0.5 text-caption-l-regular text-fg-tertiary">
        {relativeCheckAgo(place.lastCheckedAt, now)} 확인됐어요
      </p>
      <div className="mt-3 flex gap-2">
        {done ? (
          <span
            role="status"
            className={cx(buttonVariants({ variant: "tint", size: "lg" }), "flex-1")}
          >
            <span className="icon-[ci--check] size-4" aria-hidden="true" />
            확인했어요
          </span>
        ) : (
          <Button variant="outline" size="lg" className="flex-1" onClick={onCheckIn}>
            <span className="icon-[ci--check] size-4" aria-hidden="true" />
            다녀왔어요
          </Button>
        )}
        <Button variant="outline" size="lg" className="flex-1" onClick={onWriteReview}>
          리뷰 남기기
        </Button>
      </div>
    </section>
  );
}
