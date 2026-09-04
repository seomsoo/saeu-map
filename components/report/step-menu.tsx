"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChipButton } from "@/components/ui/chip";
import { Switch } from "@/components/ui/switch";
import { TextField } from "@/components/ui/text-field";
import { cx } from "@/lib/cx";
import {
  UNIT_CHIPS,
  formatPriceInput,
  priceDigits,
  validateMenuDraft,
  type MenuDraft,
  type MenuDraftErrors,
  MENU_NAME_MAX,
} from "./menu-draft";
import { StepFrame } from "./step-frame";

interface MenuLineProps {
  raw: boolean;
  value: MenuDraft;
  errors: MenuDraftErrors;
  onChange: (changes: Partial<MenuDraft>) => void;
  className?: string | undefined;
}

/** 메뉴명 / 가격(원, 숫자 키패드) / 단위 칩 6개(줄바꿈) + 마리면 칩 행 아래 "몇 마리" 입력 — 구이 줄과 회 줄이 같은 3필드 */
function MenuLine({ raw, value, errors, onChange, className }: MenuLineProps) {
  const groupLabel = raw ? "새우회 단위" : "단위";
  const countRef = useRef<HTMLInputElement | null>(null);
  // [마리]를 고르면 바로 수를 묻는다 — 입력이 칩 아래에 나타나며 키보드가 열린다
  useEffect(() => {
    if (value.unit === "count") countRef.current?.focus();
  }, [value.unit]);
  return (
    <div className={cx("flex flex-col gap-3", className)}>
      <TextField
        label={raw ? "새우회 메뉴명" : "메뉴명"}
        placeholder={raw ? "예: 생새우회" : "예: 왕새우 소금구이"}
        maxLength={MENU_NAME_MAX}
        value={value.name}
        onChange={(e) => {
          onChange({ name: e.target.value });
        }}
        error={errors.name}
        autoComplete="off"
      />
      <TextField
        label="가격"
        inputMode="numeric"
        pattern="[0-9,]*"
        placeholder="예: 35,000"
        suffix="원"
        value={formatPriceInput(value.price)}
        onChange={(e) => {
          onChange({ price: priceDigits(e.target.value) });
        }}
        error={errors.price}
        autoComplete="off"
      />
      <div>
        <p className="text-caption-l-regular text-fg-secondary">{groupLabel}</p>
        {/* 가로 스크롤이 아니라 줄바꿈 — 마지막 칩이 잘려 숨는 일이 없다 (decisions 2026-09-04 보완) */}
        <div role="group" aria-label={groupLabel} className="mt-1.5 flex flex-wrap gap-1.5 py-1">
          {UNIT_CHIPS.map((chip) => (
            <ChipButton
              key={chip.key}
              size="sm"
              pressed={value.unit === chip.key}
              onClick={() => {
                onChange({ unit: chip.key });
              }}
            >
              {chip.label}
            </ChipButton>
          ))}
        </div>
        {errors.unit && (
          <p role="alert" className="mt-1 text-caption-l-regular text-brand-fg">
            {errors.unit}
          </p>
        )}
        {value.unit === "count" && (
          <TextField
            ref={countRef}
            className="mt-3 w-32"
            label={raw ? "새우회 몇 마리" : "몇 마리"}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="10"
            suffix="마리"
            maxLength={3}
            value={value.count}
            onChange={(e) => {
              onChange({ count: priceDigits(e.target.value) });
            }}
            error={errors.count}
            autoComplete="off"
          />
        )}
      </div>
    </div>
  );
}

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
    setErrors((prev) => {
      const cleared = { ...prev[line] };
      if ("name" in changes) delete cleared.name;
      if ("price" in changes) delete cleared.price;
      if ("unit" in changes) {
        delete cleared.unit;
        delete cleared.count;
      }
      if ("count" in changes) delete cleared.count;
      return { ...prev, [line]: cleared };
    });
  };

  return (
    <StepFrame
      step={3}
      title="메뉴와 가격을 알려주세요"
      caption="대표 메뉴 한 줄이면 돼요"
      onBack={onBack}
      footer={
        <Button variant="brand" size="xl" className="w-full" onClick={next}>
          다음
        </Button>
      }
    >
      <MenuLine
        raw={false}
        value={grill}
        errors={errors.grill}
        onChange={(changes) => {
          clear("grill", changes);
          onChangeGrill(changes);
        }}
      />
      <Switch className="mt-7" label="새우회도 팔아요" checked={rawToo} onChange={onRawTooChange} />
      {rawToo && (
        <MenuLine
          raw
          className="mt-3"
          value={raw}
          errors={errors.raw}
          onChange={(changes) => {
            clear("raw", changes);
            onChangeRaw(changes);
          }}
        />
      )}
    </StepFrame>
  );
}
