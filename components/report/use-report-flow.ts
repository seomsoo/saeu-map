"use client";

import { useCallback, useRef, useState } from "react";
import { REPORT_MENU_MAX, submitReport, type ReportMenuInput } from "@/lib/data";
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
  /**
   * 3단계 기타 줄 — 이름·가격·단위만 받는다(2026-09-09). 카테고리를 고르게 하지 않는 이유는
   * `Place.menus`에 줄별 카테고리를 저장하는 자리가 없고, 회 여부는 위 토글이 담당하기 때문이다.
   */
  extras: MenuDraft[];
  /** 4단계 — 전부 선택 사항 */
  photos: File[];
  sides: Sides;
  hoursNote: string;
  /** 사용자가 붙여넣은 네이버 지도 링크(선택, 4단계) — 상세의 "네이버에서 사진 보기"가 쓴다 */
  naverPlaceUrl: string;
}

const EMPTY_DRAFT: ReportDraft = {
  name: "",
  duplicateOf: null,
  grill: EMPTY_MENU_DRAFT,
  rawToo: false,
  raw: EMPTY_MENU_DRAFT,
  extras: [],
  photos: [],
  sides: { headButter: false, ramen: false, friedRice: false },
  hoursNote: "",
  naverPlaceUrl: "",
};

/** 3단계 값에서 스키마 입력 — 검증이 안 되면 null(그 단계로 돌려보낸다) */
function menusOf(draft: ReportDraft): ReportMenuInput[] | null {
  const grill = validateMenuDraft(draft.grill, false);
  if (!grill.menu) return null;
  const menus: ReportMenuInput[] = [grill.menu];
  if (draft.rawToo) {
    const raw = validateMenuDraft(draft.raw, true);
    if (!raw.menu) return null;
    menus.push(raw.menu);
  }
  // 기타 줄은 구이·회가 아니라 그냥 한 줄이다 — raw=false로 검증하고 태그에는 영향을 주지 않는다
  for (const extra of draft.extras) {
    const line = validateMenuDraft(extra, false);
    if (!line.menu) return null;
    menus.push(line.menu);
  }
  return menus;
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
            naverPlaceUrl: draft.naverPlaceUrl,
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

  /** 기타 줄 — 상한(구이·회를 포함해 REPORT_MENU_MAX)을 넘기면 아무 일도 하지 않는다 */
  const addExtraMenu = useCallback(() => {
    setDraft((prev) =>
      (prev.rawToo ? 2 : 1) + prev.extras.length >= REPORT_MENU_MAX
        ? prev
        : { ...prev, extras: [...prev.extras, EMPTY_MENU_DRAFT] },
    );
  }, []);

  const patchExtraMenu = useCallback((index: number, changes: Partial<MenuDraft>) => {
    setDraft((prev) => ({
      ...prev,
      extras: prev.extras.map((line, i) => (i === index ? { ...line, ...changes } : line)),
    }));
  }, []);

  const removeExtraMenu = useCallback((index: number) => {
    setDraft((prev) => ({ ...prev, extras: prev.extras.filter((_, i) => i !== index) }));
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
    addExtraMenu,
    patchExtraMenu,
    removeExtraMenu,
    isDuplicateDismissed,
    dismissDuplicate,
    submitting,
    created,
    submit,
  };
}
