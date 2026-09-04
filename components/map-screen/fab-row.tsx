import { CrosshairIcon } from "@/components/ui/icons/crosshair-icon";
import { cx } from "@/lib/cx";

/** 3. 시트 가장자리 위 FAB 줄 — 왼쪽 현위치(흰 원), 오른쪽 [＋ 제보](화면의 유일한 채운 레드). 시트와 함께 움직인다. */
export function FabRow({
  onLocate,
  onReport,
  following,
}: {
  onLocate: () => void;
  onReport: () => void;
  /** 지도가 내 위치에 맞춰져 있나 — 활성이면 틴트 (채운 레드는 [＋ 제보] 하나뿐이라 칩 활성과 같은 문법) */
  following: boolean;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onLocate}
        aria-label="내 위치"
        aria-pressed={following}
        className={cx(
          "press flex size-10 items-center justify-center rounded-max shadow-fab",
          following ? "bg-brand-tint text-brand-fg" : "bg-bg text-fg-secondary",
        )}
      >
        <CrosshairIcon className="size-5" />
      </button>
      <button
        type="button"
        onClick={onReport}
        className="press inline-flex h-10 items-center gap-0.5 rounded-max bg-brand pl-3 pr-4 text-body-m-semibold text-fg-on-brand shadow-fab"
      >
        <span className="icon-[ci--add-plus] size-4" aria-hidden="true" />
        제보
      </button>
    </>
  );
}
