/**
 * 우리가 pushState로 만든 히스토리 엔트리 표식 — Next가 자기 상태(__NA·tree)를 이 객체에 덧붙여 보존한다.
 *
 * 두 겹이다: 상세는 URL(/place/[id])까지 바꾸고, 그 위에 겹치는 사진 뷰어는 **URL을 그대로 두고**
 * 엔트리만 하나 더 쌓는다. 뷰어에서 pathname을 바꾸면 use-map-screen의 popstate 재동기화가 깨지고,
 * 사진 인덱스는 아직 공유 자원이 아니다(decisions 2026-09-03).
 */
export interface SaeuDetailHistoryState {
  saeuDetail: true;
  saeuPhoto?: true;
}

/**
 * 제보 플로우(화면 3)는 URL을 그대로 두고 엔트리 하나만 쌓는다. 뒤로가기는 한 단계씩 —
 * popstate에서 이전 단계로 내리고 같은 표식을 다시 push한다(재장전). 1단계·완료에서 뒤로가면 닫힌다.
 */
export interface SaeuReportHistoryState {
  saeuReport: true;
}

/**
 * 내 활동 패널(화면 5)은 제보처럼 URL을 그대로 두고 엔트리 하나를 쌓는다. 그 위에 상세(`/place/[id]`)가
 * 열릴 수 있고, 상세에서 뒤로가면 이 표식이 남아 있어 패널로 돌아온다.
 */
export interface SaeuMeHistoryState {
  saeuMe: true;
}

/**
 * 오버레이(로그인 시트·리뷰 폼 — `<dialog>` top layer)는 사진 뷰어처럼 URL을 그대로 두고 엔트리 하나를 더 쌓는다.
 * 밑에 있던 표식(saeuDetail·saeuMe)을 그대로 안고 가서, 뒤로가기로 오버레이가 닫힌 뒤에도 그 화면이 남는다.
 */
export interface SaeuOverlayHistoryState {
  saeuOverlay: true;
  saeuDetail?: true;
  saeuMe?: true;
}

export type SaeuHistoryState =
  | SaeuDetailHistoryState
  | SaeuReportHistoryState
  | SaeuMeHistoryState
  | SaeuOverlayHistoryState;

export function isMeHistoryState(state: unknown): state is SaeuMeHistoryState {
  return typeof state === "object" && state !== null && "saeuMe" in state;
}

export function isOverlayHistoryState(state: unknown): state is SaeuOverlayHistoryState {
  return typeof state === "object" && state !== null && "saeuOverlay" in state;
}

/**
 * 오버레이 엔트리 하나를 쌓는다 — **이벤트 핸들러 안에서만** 부른다(StrictMode의 이중 effect가 두 번 쌓는 것을 막고,
 * Next의 History 패치가 상태를 덧붙이게 한다). 밑 화면의 표식은 유지한다.
 */
export function pushOverlayHistoryEntry(): void {
  const current: unknown = window.history.state;
  const next: SaeuOverlayHistoryState = {
    saeuOverlay: true,
    ...(isDetailHistoryState(current) && { saeuDetail: true }),
    ...(isMeHistoryState(current) && { saeuMe: true }),
  };
  window.history.pushState(next, "", window.location.pathname);
}

export function isDetailHistoryState(state: unknown): state is SaeuDetailHistoryState {
  return typeof state === "object" && state !== null && "saeuDetail" in state;
}

export function isPhotoHistoryState(state: unknown): state is SaeuDetailHistoryState {
  return typeof state === "object" && state !== null && "saeuPhoto" in state;
}

export function isReportHistoryState(state: unknown): state is SaeuReportHistoryState {
  return typeof state === "object" && state !== null && "saeuReport" in state;
}
