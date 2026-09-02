import { StarIcon } from "@/components/ui/icons/star-icon";
import { clampRating } from "@/lib/reviews";
import { cx } from "@/lib/cx";

const STARS = [1, 2, 3, 4, 5] as const;

/** 별 5개 — 채운 별 잉크, 빈 별 헤어라인 색(gray-200). 채운 별은 인라인 SVG(에셋 목록). */
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
        <StarIcon
          key={n}
          className={cx(size === "sm" ? "size-3" : "size-4", n <= filled ? "text-fg" : "text-line")}
        />
      ))}
    </span>
  );
}
