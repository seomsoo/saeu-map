"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MenuFields } from "./menu-fields";
import { clearMenuErrors, validateMenuDraft, type MenuDraft, type MenuDraftErrors } from "./menu-draft";
import { StepFrame } from "./step-frame";

interface StepMenuProps {
  grill: MenuDraft;
  rawToo: boolean;
  raw: MenuDraft;
  onChangeGrill: (changes: Partial<MenuDraft>) => void;
  onChangeRaw: (changes: Partial<MenuDraft>) => void;
  onRawTooChange: (rawToo: boolean) => void;
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
  onChangeGrill,
  onChangeRaw,
  onRawTooChange,
  onBack,
  onNext,
}: StepMenuProps) {
  const [errors, setErrors] = useState<{ grill: MenuDraftErrors; raw: MenuDraftErrors }>({
    grill: {},
    raw: {},
  });
  const next = () => {
    const grillResult = validateMenuDraft(grill, false);
    const rawResult = rawToo ? validateMenuDraft(raw, true) : null;
    const nextErrors = { grill: grillResult.errors ?? {}, raw: rawResult?.errors ?? {} };
    setErrors(nextErrors);
    if (grillResult.errors || rawResult?.errors) return;
    onNext();
  };

  const clear = (line: "grill" | "raw", changes: Partial<MenuDraft>) => {
    setErrors((prev) => ({ ...prev, [line]: clearMenuErrors(prev[line], changes) }));
  };

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
        errors={errors}
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
    </StepFrame>
  );
}
