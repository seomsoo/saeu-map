import { cx } from "@/lib/cx";

/**
 * 토스트 — 짧은 안내 한 줄(bg-toast). 표시·타이머는 부모(showNotice)가 관리한다.
 * 자리와 크기는 그릇이 정한다: 모바일은 지도 위 스택의 마지막 층(전폭 가운데),
 * 데스크탑은 패널 오른쪽 아래에 뜨는 카드 (design 화면 6 v3, 2026-09-08).
 */
export function Toast({ message, className }: { message: string | null; className?: string }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className={cx(
        "mx-auto rounded-12 bg-toast px-4 py-3 text-body-m-regular text-fg-on-brand",
        className,
      )}
    >
      {message}
    </p>
  );
}
