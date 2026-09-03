"use client";

import { useCallback, useRef, useState } from "react";
import { submitReport, type ReportMenuInput } from "@/lib/data";
import type { LatLng, Place, Sides } from "@/lib/types";
import { EMPTY_MENU_DRAFT, validateMenuDraft, type MenuDraft } from "./menu-draft";

/** 패널이 갖는 입력값. 단계를 오가도 남고, 플로우를 닫으면(언마운트) 사라진다 */
export interface ReportDraft {
  name: string;
  /** 2단계 중복 의심에 "다른 가게예요"로 답한 후보 — 등록 시 duplicateSuspectOf */
  duplicateOf: string | null;
  /** 3단계 구이 줄(필수) */
  grill: MenuDraft;
  /** "새우회도 팔아요" */
  rawToo: boolean;
  /** 3단계 회 줄 (rawToo일 때만 검증·저장) */
  raw: MenuDraft;
  /** 4단계 — 전부 선택 사항 */
  photos: File[];
  sides: Sides;
  hoursNote: string;
}

const EMPTY_DRAFT: ReportDraft = {
  name: "",
  duplicateOf: null,
  grill: EMPTY_MENU_DRAFT,
  rawToo: false,
  raw: EMPTY_MENU_DRAFT,
  photos: [],
  sides: { headButter: false, ramen: false, friedRice: false },
  hoursNote: "",
};

/** 3단계 값에서 스키마 입력 — 검증이 안 되면 null(그 단계로 돌려보낸다) */
function menusOf(draft: ReportDraft): ReportMenuInput[] | null {
  const grill = validateMenuDraft(draft.grill, false);
  if (!grill.menu) return null;
  if (!draft.rawToo) return [grill.menu];
  const raw = validateMenuDraft(draft.raw, true);
  return raw.menu ? [grill.menu, raw.menu] : null;
}

export function useReportFlow() {
  const [draft, setDraft] = useState<ReportDraft>(EMPTY_DRAFT);
  /** 이미 "다른 가게예요"라고 답한 후보 — 핀을 옮겨 다시 확정해도 같은 후보는 다시 묻지 않는다 */
  const dismissedDuplicateIds = useRef(new Set<string>());

  const patch = useCallback((changes: Partial<ReportDraft>) => {
    setDraft((prev) => ({ ...prev, ...changes }));
  }, []);

  const [submitting, setSubmitting] = useState(false);
  /** 등록 성공으로 만들어진 가게 — 완료 화면이 보여준다 */
  const [created, setCreated] = useState<Place | null>(null);

  /**
   * 등록. 성공하면 Place, 실패(목 10%·서울 밖)면 null — 호출자가 토스트를 띄우고 4단계에 머문다.
   * 3단계 값이 검증을 통과하지 못하면(뒤로 가서 지운 경우) "invalid"로 돌려보낸다.
   */
  const submit = useCallback(
    async (pin: LatLng, now: string): Promise<Place | null | "invalid"> => {
      const menus = menusOf(draft);
      if (!menus) return "invalid";
      setSubmitting(true);
      try {
        const place = await submitReport(
          {
            name: draft.name,
            lat: pin.lat,
            lng: pin.lng,
            menus,
            sides: draft.sides,
            hoursNote: draft.hoursNote,
            photos: draft.photos,
            duplicateOf: draft.duplicateOf,
          },
          now,
        );
        setCreated(place);
        return place;
      } catch {
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [draft],
  );

  const patchMenu = useCallback((line: "grill" | "raw", changes: Partial<MenuDraft>) => {
    setDraft((prev) => ({ ...prev, [line]: { ...prev[line], ...changes } }));
  }, []);

  const dismissDuplicate = useCallback((id: string) => {
    dismissedDuplicateIds.current.add(id);
  }, []);
  /** 확정 핸들러 안에서만 읽는다 (렌더 중 ref 접근 금지) */
  const isDuplicateDismissed = useCallback((id: string) => dismissedDuplicateIds.current.has(id), []);

  return {
    draft,
    patch,
    patchMenu,
    isDuplicateDismissed,
    dismissDuplicate,
    submitting,
    created,
    submit,
  };
}
