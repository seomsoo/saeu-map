import type { ComponentPropsWithoutRef } from "react";

/**
 * 현위치 표적(크로스헤어) 아이콘 — coolicons에 없어 임시 인라인 SVG (decisions "커스텀 에셋 필요").
 * currentColor를 따르므로 부모 텍스트 색으로 칠한다.
 */
export function CrosshairIcon(props: ComponentPropsWithoutRef<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}
