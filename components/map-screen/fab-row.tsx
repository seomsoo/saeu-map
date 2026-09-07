import { LocateButton } from "./locate-button";

/** 3. 시트 가장자리 위 FAB 줄(모바일) — 왼쪽 현위치(흰 원), 오른쪽 [＋ 제보](화면의 유일한 채운 레드). 시트와 함께 움직인다. */
export function FabRow({
  onLocate,
  onReport,
  following,
}: {
  onLocate: () => void;
  onReport: () => void;
  /** 지도가 내 위치에 맞춰져 있나 — 현위치 버튼 활성 표시 */
  following: boolean;
}) {
  return (
    <>
      <LocateButton onClick={onLocate} following={following} />
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
