import { CrosshairIcon } from "@/components/ui/icons/crosshair-icon";

/** 3. 시트 가장자리 위 FAB 줄 — 왼쪽 현위치(흰 원), 오른쪽 [＋ 제보](화면의 유일한 채운 레드). 시트와 함께 움직인다. */
export function FabRow({
  onLocate,
  onReport,
}: {
  onLocate: () => void;
  onReport: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onLocate}
        aria-label="내 위치"
        className="press flex size-10 items-center justify-center rounded-max bg-bg text-fg-secondary shadow-fab"
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
