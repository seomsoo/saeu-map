/**
 * 뷰포트 판정 — 그릇(모바일 시트 / 데스크탑 패널)은 CSS(`lg:`·globals.css 데스크탑 블록)가 바꾸고,
 * 여기는 **JS가 알아야 하는 곳**만 쓴다: 데스크탑 전용 요소(브랜드 행 [＋ 제보]·줌 컨트롤·마커 툴팁) 렌더와
 * 지도 기하(중심 y·fitBounds 마진·시트 드래그 무시). 값은 Tailwind `--breakpoint-lg`(64rem = 1024px)와
 * 같아야 한다 — CSS와 JS가 다른 폭에서 갈리면 그릇과 기하가 어긋난다 (decisions 2026-09-07).
 */
export const DESKTOP_MIN_WIDTH_PX = 1024;
export const DESKTOP_MEDIA_QUERY = `(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`;

/**
 * 데스크탑 떠 있는 패널 (design 화면 6 v3) — CSS(`lg:left-4`·`lg:w-105`)와 **같은 값이어야 한다**.
 * 패널이 지도 위에 겹치므로 지도 이동(panTo·fitBounds)은 이만큼 오른쪽을 가시 영역으로 봐야 한다 —
 * 안 하면 선택한 마커가 패널 뒤로 숨는다 (decisions 2026-09-08).
 */
export const PANEL_INSET_PX = 16;
export const PANEL_WIDTH_PX = 420;
/** 패널이 가리는 가로 폭(왼쪽 여백 포함) */
export const PANEL_OCCLUSION_PX = PANEL_INSET_PX + PANEL_WIDTH_PX;

/** 핸들러·effect 안에서 즉시 판정. 서버·jsdom(matchMedia 스텁 false)에서는 false. */
export function isDesktopViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}
