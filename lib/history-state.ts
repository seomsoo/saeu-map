/**
 * 우리가 pushState로 만든 히스토리 엔트리 표식 — Next가 자기 상태(__NA·tree)를 이 객체에 덧붙여 보존한다.
 *
 * 두 겹이다: 상세는 URL(/place/[id])까지 바꾸고, 그 위에 겹치는 사진 뷰어는 **URL을 그대로 두고**
 * 엔트리만 하나 더 쌓는다. 뷰어에서 pathname을 바꾸면 use-map-screen의 popstate 재동기화가 깨지고,
 * 사진 인덱스는 아직 공유 자원이 아니다(decisions 2026-09-03).
 */
export interface SaeuHistoryState {
  saeuDetail: true;
  saeuPhoto?: true;
}

export function isDetailHistoryState(state: unknown): state is SaeuHistoryState {
  return typeof state === "object" && state !== null && "saeuDetail" in state;
}

export function isPhotoHistoryState(state: unknown): state is SaeuHistoryState {
  return typeof state === "object" && state !== null && "saeuPhoto" in state;
}
