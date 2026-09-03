"use client";

import { useCallback, useRef, useState } from "react";

/** 패널이 갖는 입력값. 단계를 오가도 남고, 플로우를 닫으면(언마운트) 사라진다 */
export interface ReportDraft {
  name: string;
  /** 2단계 중복 의심에 "다른 가게예요"로 답한 후보 — 등록 시 duplicateSuspectOf */
  duplicateOf: string | null;
}

const EMPTY_DRAFT: ReportDraft = { name: "", duplicateOf: null };

export function useReportFlow() {
  const [draft, setDraft] = useState<ReportDraft>(EMPTY_DRAFT);
  /** 이미 "다른 가게예요"라고 답한 후보 — 핀을 옮겨 다시 확정해도 같은 후보는 다시 묻지 않는다 */
  const dismissedDuplicateIds = useRef(new Set<string>());

  const patch = useCallback((changes: Partial<ReportDraft>) => {
    setDraft((prev) => ({ ...prev, ...changes }));
  }, []);

  const dismissDuplicate = useCallback((id: string) => {
    dismissedDuplicateIds.current.add(id);
  }, []);
  /** 확정 핸들러 안에서만 읽는다 (렌더 중 ref 접근 금지) */
  const isDuplicateDismissed = useCallback((id: string) => dismissedDuplicateIds.current.has(id), []);

  return { draft, patch, isDuplicateDismissed, dismissDuplicate };
}
