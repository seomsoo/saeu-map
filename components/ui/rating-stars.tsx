import { ShrimpIcon } from "@/components/ui/icons/shrimp-icon";
import { clampRating } from "@/lib/reviews";
import { cx } from "@/lib/cx";

const STARS = [1, 2, 3, 4, 5] as const;

/** 별점 5칸 — 채움 브랜드 레드(red-600), 빔 헤어라인 색(gray-200). 모양은 새우다(2026-09-07).
 * 12·14px에선 형태가 뭉개서 16px(size-4)까지 올렸다 — 별보다 복잡한 실루엣의 값이다.
 * 접근 이름은 "별점 N점" 그대로(바뀐 건 UI뿐). */
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
        <ShrimpIcon
          key={n}
          className={cx(size === "sm" ? "size-4" : "size-5", n <= filled ? "text-brand-fg" : "text-line")}
        />
      ))}
    </span>
  );
}
