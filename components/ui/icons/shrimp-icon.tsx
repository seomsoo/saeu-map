import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/cx";

/**
 * 별점 한 칸 — 새우 실루엣. 색이 `currentColor`라 채움(잉크)·빔(gray-200)이 **별과 똑같은 문법**으로 갈린다.
 * `shrimp.webp`의 알파가 곧 실루엣이라 마스크로 쓴다(제보 핀과 같은 방식) — 컬러 아트를 그대로 쓰면
 * 채움과 빔이 구분되지 않는다(2026-09-07 실측). 스크린리더는 "별점 N점" 그대로다: 바뀐 건 UI뿐이다.
 */
export function ShrimpIcon({ className, ...props }: ComponentPropsWithoutRef<"span">) {
  return <span aria-hidden="true" className={cx("shrimp-mask", className)} {...props} />;
}
