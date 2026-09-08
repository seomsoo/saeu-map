"use client";

import { useEffect, useRef, type Ref } from "react";
import { ChipButton } from "@/components/ui/chip";
import { Switch } from "@/components/ui/switch";
import { TextField } from "@/components/ui/text-field";
import { cx } from "@/lib/cx";
import type { Menu } from "@/lib/types";
import {
  EMPTY_MENU_DRAFT,
  MENU_NAME_MAX,
  UNIT_CHIPS,
  formatPriceInput,
  priceDigits,
  type MenuDraft,
  type MenuDraftErrors,
  type UnitChipKey,
} from "./menu-draft";

interface MenuLineProps {
  raw: boolean;
  value: MenuDraft;
  errors: MenuDraftErrors;
  onChange: (changes: Partial<MenuDraft>) => void;
  className?: string | undefined;
  /** 회 줄을 방금 켰을 때 포커스를 주기 위해 MenuFields가 넘긴다 */
  nameRef?: Ref<HTMLInputElement> | undefined;
}

/** 메뉴명 / 가격(원, 숫자 키패드) / 단위 칩 6개(줄바꿈) + 마리면 칩 행 아래 "몇 마리" 입력 — 구이 줄과 회 줄이 같은 3필드 */
export function MenuLine({ raw, value, errors, onChange, className, nameRef }: MenuLineProps) {
  const groupLabel = raw ? "새우회 단위" : "단위";
  const countRef = useRef<HTMLInputElement | null>(null);
  // [마리]를 고르면 바로 수를 묻는다 — 입력이 칩 아래에 나타나며 키보드가 열린다
  useEffect(() => {
    if (value.unit === "count") countRef.current?.focus();
  }, [value.unit]);
  return (
    <div className={cx("flex flex-col gap-3", className)}>
      <TextField
        ref={nameRef}
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

interface MenuFieldsProps {
  grill: MenuDraft;
  raw: MenuDraft;
  rawToo: boolean;
  errors: { grill: MenuDraftErrors; raw: MenuDraftErrors };
  onChangeGrill: (changes: Partial<MenuDraft>) => void;
  onChangeRaw: (changes: Partial<MenuDraft>) => void;
  onRawTooChange: (rawToo: boolean) => void;
  className?: string | undefined;
}

/**
 * 메뉴 한 줄 입력 묶음 — 구이 줄 + "새우회도 팔아요" 스위치 + (켜면) 회 줄.
 * 제보 3단계(화면 3-3)와 상세의 메뉴 제안 시트(화면 2-5)가 **같은 것을 쓴다** — 같은 값을 두 곳에서
 * 다르게 받지 않는다(decisions 2026-09-08). 오류는 부모가 만들어 내려보낸다(검증 시점이 서로 다르다:
 * 제보는 [다음], 시트는 [알려주기]).
 */
export function MenuFields({
  grill,
  raw,
  rawToo,
  errors,
  onChangeGrill,
  onChangeRaw,
  onRawTooChange,
  className,
}: MenuFieldsProps) {
  /*
   * 회 줄은 토글 아래에 생겨서 스크롤 밖이면 안 보인다 — 켠 직후 메뉴명에 포커스를 줘 따라 올라오게 한다
   * ([마리] 칩이 "몇 마리" 입력에 포커스하는 것과 같은 방식).
   * 마운트 이펙트로 하지 않는 이유: 부모가 이 묶음을 언마운트했다가 다시 붙일 수 있어(제보의 ‹ 뒤로)
   * rawToo가 켜진 채 돌아올 때마다 포커스를 뺏는다. "방금 켰다"는 신호를 따로 둔다.
   */
  const rawNameRef = useRef<HTMLInputElement | null>(null);
  /** state로 두면 이펙트에서 되돌리게 되고 그건 연쇄 렌더다(린트). 정리로 만지지 않으니 StrictMode 이중 effect에도 안전하다. */
  const rawJustEnabled = useRef(false);
  useEffect(() => {
    if (!rawToo || !rawJustEnabled.current) return;
    rawJustEnabled.current = false;
    rawNameRef.current?.focus();
  }, [rawToo]);

  return (
    <div className={className}>
      <MenuLine raw={false} value={grill} errors={errors.grill} onChange={onChangeGrill} />
      <Switch
        className="mt-7"
        label="새우회도 팔아요"
        checked={rawToo}
        onChange={(next) => {
          rawJustEnabled.current = next;
          onRawTooChange(next);
        }}
      />
      {rawToo && (
        <MenuLine
          raw
          nameRef={rawNameRef}
          className="mt-3"
          value={raw}
          errors={errors.raw}
          onChange={onChangeRaw}
        />
      )}
    </div>
  );
}

/** 단위 칩으로 되돌릴 수 있는 표기만 매칭한다 — 大中小·인분(크롤 표기)은 칩이 없어 비운 채 다시 고르게 한다. */
function unitChipOf(menu: Menu): UnitChipKey | null {
  switch (menu.unit) {
    case "kg":
      return menu.unit_raw === "1" ? "kg1" : null;
    case "g":
      return menu.unit_raw === "500" ? "g500" : null;
    case "pan":
      return menu.unit_raw === "반판" ? "halfPan" : menu.unit_raw === "한판" ? "pan" : null;
    case "count":
      return "count";
    case "none":
      return "none";
    default:
      return null;
  }
}

/** 이미 있는 메뉴를 수정용 초기값으로 — 값이 있으면 채워 두고 없으면 빈 채다(design 화면 2 값 폼 시트). */
export function menuToDraft(menu: Menu | undefined): MenuDraft {
  if (!menu) return EMPTY_MENU_DRAFT;
  const unit = unitChipOf(menu);
  return {
    name: menu.name,
    price: menu.price === null ? "" : String(menu.price),
    unit,
    count: unit === "count" ? priceDigits(menu.unit_raw ?? "") : "",
  };
}
