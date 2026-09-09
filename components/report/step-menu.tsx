"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { REPORT_MENU_MAX } from "@/lib/data";
import { MenuFields, MenuLine } from "./menu-fields";
import { clearMenuErrors, validateMenuDraft, type MenuDraft, type MenuDraftErrors } from "./menu-draft";
import { StepFrame } from "./step-frame";

interface StepMenuProps {
  grill: MenuDraft;
  rawToo: boolean;
  raw: MenuDraft;
  /** 기타 줄 — 이름·가격·단위만 받는다(카테고리 선택 없음, 2026-09-09) */
  extras: MenuDraft[];
  onChangeGrill: (changes: Partial<MenuDraft>) => void;
  onChangeRaw: (changes: Partial<MenuDraft>) => void;
  onRawTooChange: (rawToo: boolean) => void;
  onAddExtra: () => void;
  onChangeExtra: (index: number, changes: Partial<MenuDraft>) => void;
  onRemoveExtra: (index: number) => void;
  onBack: () => void;
  onNext: () => void;
}

/**
 * 3단계 — 메뉴와 가격 (design 화면 3-3). 구이 줄 한 줄이 필수, "새우회도 팔아요"를 켜면 같은 3필드의 회 줄.
 * 오류는 [다음]을 누를 때 필드별로, 고치면 그 필드의 오류만 사라진다.
 */
export function StepMenu({
  grill,
  rawToo,
  raw,
  extras,
  onChangeGrill,
  onChangeRaw,
  onRawTooChange,
  onAddExtra,
  onChangeExtra,
  onRemoveExtra,
  onBack,
  onNext,
}: StepMenuProps) {
  const [errors, setErrors] = useState<{
    grill: MenuDraftErrors;
    raw: MenuDraftErrors;
    extras: MenuDraftErrors[];
  }>({ grill: {}, raw: {}, extras: [] });
  const next = () => {
    const grillResult = validateMenuDraft(grill, false);
    const rawResult = rawToo ? validateMenuDraft(raw, true) : null;
    // 기타 줄도 채웠으면 끝까지 채워야 한다 — 반쯤 쓴 줄이 조용히 버려지면 낸 사람이 낸 줄 모른다
    const extraResults = extras.map((line) => validateMenuDraft(line, false));
    setErrors({
      grill: grillResult.errors ?? {},
      raw: rawResult?.errors ?? {},
      extras: extraResults.map((r) => r.errors ?? {}),
    });
    if (grillResult.errors || rawResult?.errors || extraResults.some((r) => r.errors)) return;
    onNext();
  };

  const clear = (line: "grill" | "raw", changes: Partial<MenuDraft>) => {
    setErrors((prev) => ({ ...prev, [line]: clearMenuErrors(prev[line], changes) }));
  };

  const clearExtra = (index: number, changes: Partial<MenuDraft>) => {
    setErrors((prev) => ({
      ...prev,
      extras: prev.extras.map((e, i) => (i === index ? clearMenuErrors(e, changes) : e)),
    }));
  };

  const lineCount = (rawToo ? 2 : 1) + extras.length;

  return (
    <StepFrame
      step={3}
      title="메뉴와 가격을 알려주세요"
      caption="대표 메뉴 한 줄이면 돼요. 이름·가격·단위를 모두 채워주세요"
      onBack={onBack}
      footer={
        <Button variant="brand" size="xl" className="w-full" onClick={next}>
          다음
        </Button>
      }
    >
      <MenuFields
        grill={grill}
        raw={raw}
        rawToo={rawToo}
        errors={{ grill: errors.grill, raw: errors.raw }}
        onChangeGrill={(changes) => {
          clear("grill", changes);
          onChangeGrill(changes);
        }}
        onChangeRaw={(changes) => {
          clear("raw", changes);
          onChangeRaw(changes);
        }}
        onRawTooChange={onRawTooChange}
      />

      {/* 기타 줄 — 상세의 `＋ 메뉴 추가`와 같은 문법(이름·가격·단위만). 카테고리는 묻지 않는다:
          `Place.menus`에 줄별 카테고리를 담는 자리가 없고 회 여부는 위 토글이 담당한다 (2026-09-09) */}
      {extras.map((line, i) => (
        <div key={i} className="mt-7 border-t border-line-hairline pt-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-body-m-semibold text-fg">메뉴 {i + 3 - (rawToo ? 0 : 1)}</p>
            <button
              type="button"
              onClick={() => {
                onRemoveExtra(i);
              }}
              className="press hit-44 text-caption-l-medium text-fg-tertiary"
            >
              삭제
            </button>
          </div>
          <MenuLine
            raw={false}
            value={line}
            errors={errors.extras[i] ?? {}}
            onChange={(changes) => {
              clearExtra(i, changes);
              onChangeExtra(i, changes);
            }}
          />
        </div>
      ))}

      {lineCount < REPORT_MENU_MAX && (
        <button type="button" onClick={onAddExtra} className="press mt-5 text-caption-l-medium text-fg-tertiary hit-44">
          ＋ 메뉴 추가
        </button>
      )}
    </StepFrame>
  );
}
