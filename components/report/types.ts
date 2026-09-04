/** 제보 플로우 단계 (design 화면 3): 가게 찾기 → 위치 → 메뉴와 가격 → 선택 항목 → 완료 */
export type ReportStep = 1 | 2 | 3 | 4 | "done";

export const REPORT_STEP_COUNT = 4;

/** 뒤로가기 한 단계. 1단계·완료에서는 없다(플로우가 닫힌다). */
export function previousReportStep(step: ReportStep): ReportStep | null {
  switch (step) {
    case 2:
      return 1;
    case 3:
      return 2;
    case 4:
      return 3;
    case 1:
    case "done":
      return null;
  }
}
