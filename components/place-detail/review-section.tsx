import Image from "next/image";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { RatingStars } from "@/components/ui/rating-stars";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRating, ratingSummary } from "@/lib/reviews";
import { formatKstShortDate } from "@/lib/time";
import type { Review } from "@/lib/types";
import { NaverPhotoLink } from "./naver-photo-link";

export type ReviewsStatus = "loading" | "ready" | "error";

interface ReviewSectionProps {
  status: ReviewsStatus;
  reviews: Review[];
  /** 사진이 있는 가게는 네이버 링크가 여기(섹션 끝)로 온다 */
  naverUrl: string | null;
  onRetry: () => void;
  onWriteReview: () => void;
}

/**
 * 9. 리뷰 — 제목 + 개수, 리뷰 3개 이상일 때만 "★ 4.7"(spec 4.2-9). 행: 닉네임·날짜 / 별 5개 / 후기 / 사진.
 * 빈 상태 "아직 리뷰가 없어요 / 첫 방문자가 되어보세요" + [리뷰 남기기](Phase 4까지 준비 중 토스트).
 */
export function ReviewSection({ status, reviews, naverUrl, onRetry, onWriteReview }: ReviewSectionProps) {
  const summary = ratingSummary(reviews);
  return (
    <section aria-labelledby="place-reviews-heading" className="px-5 pt-4 pb-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id="place-reviews-heading" className="flex items-baseline gap-1.5 text-body-l-semibold text-fg">
          리뷰
          {status === "ready" && (
            <span className="text-body-l-regular text-fg-tertiary tabular-nums">{summary.count}</span>
          )}
        </h3>
        {status === "ready" && summary.average !== null && (
          <p
            className="flex items-center gap-1 text-body-m-semibold text-fg tabular-nums"
            aria-label={`평균 별점 ${formatRating(summary.average)}점`}
          >
            <span className="icon-[ci--star] size-4" aria-hidden="true" />
            {formatRating(summary.average)}
          </p>
        )}
      </div>

      {status === "loading" && (
        <div aria-busy="true" aria-label="리뷰 불러오는 중" className="mt-3 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      )}

      {status === "error" && (
        <ErrorState className="py-6" title="리뷰를 불러오지 못했어요" onRetry={onRetry} />
      )}

      {status === "ready" && reviews.length === 0 && (
        <EmptyState
          className="py-6"
          title="아직 리뷰가 없어요"
          description="첫 방문자가 되어보세요"
          action={
            <Button variant="outline" size="lg" onClick={onWriteReview}>
              리뷰 남기기
            </Button>
          }
        />
      )}

      {status === "ready" && reviews.length > 0 && (
        <>
          <ul className="mt-1 divide-y divide-line-hairline">
            {reviews.map((review) => (
              <li key={`${review.nickname}-${review.at}`} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-body-m-semibold text-fg">{review.nickname}</span>
                  <span className="shrink-0 text-caption-l-regular text-fg-tertiary tabular-nums">
                    {formatKstShortDate(review.at)}
                  </span>
                </div>
                <RatingStars rating={review.rating} className="mt-1" />
                <p className="mt-1.5 text-body-m-regular text-fg">{review.text}</p>
                {review.photoUrl && (
                  <Image
                    src={review.photoUrl}
                    alt={`${review.nickname}의 리뷰 사진`}
                    width={64}
                    height={64}
                    draggable={false}
                    className="mt-2 size-16 rounded-12 bg-bg-sunken object-cover"
                  />
                )}
              </li>
            ))}
          </ul>
          <Button variant="outline" size="lg" className="mt-2 w-full" onClick={onWriteReview}>
            리뷰 남기기
          </Button>
        </>
      )}

      {naverUrl && (
        <p className="mt-3">
          <NaverPhotoLink href={naverUrl} />
        </p>
      )}
    </section>
  );
}
