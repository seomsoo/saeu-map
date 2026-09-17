import type { ReportKind } from "./types";

/** 신고·요청 종류 → 사람이 읽는 말 — 관리자 표(reports-tab)와 디스코드 알림(lib/server/notify)이 같은 말을 쓴다 */
export const REPORT_KIND_LABEL: Record<ReportKind, string> = {
  place_report: "가게 신고",
  photo_report: "사진 신고",
  place_flag: "정보 수정 제안",
  owner_request: "사장님 요청",
};

/** 사유 코드 → 사람이 읽는 말. 사용자 화면의 시트 문구와 같은 말을 쓴다. */
export const REPORT_REASON_LABEL: Record<string, string> = {
  location: "위치가 달라요",
  menu: "메뉴·가격이 달라요",
  closed: "문 닫았어요",
  not_shrimp: "새우집이 아니에요",
  fake: "허위·광고성 등록",
  duplicate: "중복 등록이에요",
  inappropriate: "부적절한 사진",
  wrong_place: "다른 가게 사진",
  spam: "광고·도배",
  other: "기타",
};
