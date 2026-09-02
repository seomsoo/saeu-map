import type { ComponentPropsWithoutRef } from "react";

/**
 * 채운 별 — coolicons에는 라인 별(ci--star)만 있어 채움/빔이 색으로 구분되지 않는다.
 * 크로스헤어처럼 인라인 SVG로 임시 대체 (docs/decisions.md 커스텀 에셋 필요 목록). 색은 currentColor.
 */
export function StarIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2.5l2.94 6.26 6.87.86-5.05 4.74 1.3 6.8L12 17.77l-6.06 3.39 1.3-6.8L2.19 9.62l6.87-.86z" />
    </svg>
  );
}
