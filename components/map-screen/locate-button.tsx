import { CrosshairIcon } from "@/components/ui/icons/crosshair-icon";
import { cx } from "@/lib/cx";

/**
 * 현위치 버튼(흰 원 40). 모바일 FAB 줄과 데스크탑 지도 컨트롤이 같은 컴포넌트를 쓴다.
 * 활성(지도가 내 위치에 맞춰진 동안)이면 틴트 — 채운 레드는 [＋ 제보] 하나뿐이라 칩 활성과 같은 문법.
 */
export function LocateButton({ onClick, following }: { onClick: () => void; following: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="내 위치"
      aria-pressed={following}
      className={cx(
        "press flex size-10 items-center justify-center rounded-max shadow-fab",
        following ? "bg-brand-tint text-brand-fg" : "bg-bg text-fg-secondary",
      )}
    >
      <CrosshairIcon className="size-5" />
    </button>
  );
}
