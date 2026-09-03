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

export type SaeuHistoryState = SaeuDetailHistoryState | SaeuReportHistoryState;

export function isDetailHistoryState(state: unknown): state is SaeuDetailHistoryState {
  return typeof state === "object" && state !== null && "saeuDetail" in state;
}

export function isPhotoHistoryState(state: unknown): state is SaeuDetailHistoryState {
  return typeof state === "object" && state !== null && "saeuPhoto" in state;
}

export function isReportHistoryState(state: unknown): state is SaeuReportHistoryState {
  return typeof state === "object" && state !== null && "saeuReport" in state;
}
