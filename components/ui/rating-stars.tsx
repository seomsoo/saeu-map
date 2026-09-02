import { clampRating } from "@/lib/reviews";
import { cx } from "@/lib/cx";

const STARS = [1, 2, 3, 4, 5] as const;

/** 별 5개 — 채운 별 잉크, 빈 별 헤어라인 색. coolicons엔 라인 별만 있어 색 대비로 채움을 표현한다(decisions 2026-09-02). */
export function RatingStars({
  rating,
  size = "sm",
  className,
}: {
  rating: number;
  size?: "sm" | "md";
  className?: string | undefined;
}) {
  const filled = clampRating(rating);
  return (
    <span
      role="img"
      aria-label={`별점 ${String(filled)}점`}
      className={cx("inline-flex items-center gap-0.5", className)}
    >
      {STARS.map((n) => (
        <span
          key={n}
          aria-hidden="true"
          className={cx(
            "icon-[ci--star]",
            size === "sm" ? "size-3" : "size-4",
            n <= filled ? "text-fg" : "text-line",
          )}
        />
      ))}
    </span>
  );
}
