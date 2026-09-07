import { LocateButton } from "@/components/map-screen/locate-button";

/**
 * 데스크탑 지도 우하단 컨트롤 (design 화면 6): 줌 [+][−] 한 묶음(흰 40×40 두 칸, 라운드 8, 헤어라인, shadow-fab) +
 * 그 아래 현위치(모바일 FAB과 같은 컴포넌트). 모바일에서는 렌더하지 않는다 — 핀치·FAB 줄이 그 역할이다.
 */
export function MapControls({
  onZoomIn,
  onZoomOut,
  onLocate,
  following,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
  following: boolean;
}) {
  return (
    <div className="absolute right-5 bottom-5 z-10 flex flex-col items-center gap-3">
      <div
        role="group"
        aria-label="지도 확대·축소"
        className="flex flex-col divide-y divide-line-hairline overflow-hidden rounded-8 border border-line bg-bg shadow-fab"
      >
        <button
          type="button"
          onClick={onZoomIn}
          aria-label="확대"
          className="flex size-10 items-center justify-center text-fg-secondary active:bg-bg-sunken"
        >
          <span className="icon-[ci--add-plus] size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          aria-label="축소"
          className="flex size-10 items-center justify-center text-fg-secondary active:bg-bg-sunken"
        >
          <span className="icon-[ci--remove-minus] size-5" aria-hidden="true" />
        </button>
      </div>
      <LocateButton onClick={onLocate} following={following} />
    </div>
  );
}
