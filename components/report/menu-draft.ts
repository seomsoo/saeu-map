import { reportMenuSchema, type ReportMenuInput } from "@/lib/data";

/**
 * 3단계 메뉴 줄 입력값과 검증 (design 화면 3-3). 단위 칩 → Menu.unit/unit_raw 변환은 `unitChipLabel`이
 * 읽는 형태를 따른다: kg·g는 숫자만("1"·"500"), 한판·반판·N마리는 표기 자체, 단위 없음은 null.
 */
export type UnitChipKey = "kg1" | "g500" | "pan" | "halfPan" | "count" | "none";

export const UNIT_CHIPS: readonly { key: UnitChipKey; label: string }[] = [
  { key: "kg1", label: "1kg" },
  { key: "g500", label: "500g" },
  { key: "pan", label: "한판" },
  { key: "halfPan", label: "반판" },
  { key: "count", label: "마리" },
  { key: "none", label: "단위 없음" },
];

export interface MenuDraft {
  name: string;
  /** 숫자만 담는다 — 표시는 formatPriceInput */
  price: string;
  unit: UnitChipKey | null;
  /** 단위가 마리일 때 몇 마리 */
  count: string;
}

export const EMPTY_MENU_DRAFT: MenuDraft = { name: "", price: "", unit: null, count: "" };

export interface MenuDraftErrors {
  name?: string;
  price?: string;
  unit?: string;
  count?: string;
}

export const MENU_NAME_MAX = 30;
export const MENU_ERRORS = {
  name: "메뉴 이름을 알려주세요",
  price: "가격을 숫자로 알려주세요",
  unit: "단위를 골라주세요",
  count: "몇 마리인지 알려주세요",
} as const;

/** 입력에서 숫자만 남긴다 ("3만원" → "3", "35,000" → "35000") */
export function priceDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 9);
}

/** 표시용 천 단위 구분 — 값은 숫자만 갖는다 */
export function formatPriceInput(digits: string): string {
  return digits ? Number(digits).toLocaleString("ko-KR") : "";
}

function unitOf(draft: MenuDraft): Pick<ReportMenuInput, "unit" | "unitRaw"> | null {
  switch (draft.unit) {
    case "kg1":
      return { unit: "kg", unitRaw: "1" };
    case "g500":
      return { unit: "g", unitRaw: "500" };
    case "pan":
      return { unit: "pan", unitRaw: "한판" };
    case "halfPan":
      return { unit: "pan", unitRaw: "반판" };
    case "count": {
      const n = Number(priceDigits(draft.count));
      return n > 0 ? { unit: "count", unitRaw: `${n}마리` } : null;
    }
    case "none":
      return { unit: "none", unitRaw: null };
    case null:
      return null;
  }
}

/** 한 줄 검증 — 오류가 없으면 menu, 있으면 필드별 오류. 최종 문은 lib/data의 스키마다. */
export function validateMenuDraft(
  draft: MenuDraft,
  raw: boolean,
): { menu: ReportMenuInput; errors: null } | { menu: null; errors: MenuDraftErrors } {
  const errors: MenuDraftErrors = {};
  const name = draft.name.trim();
  if (name.length === 0 || name.length > MENU_NAME_MAX) errors.name = MENU_ERRORS.name;
  const price = Number(priceDigits(draft.price));
  if (!Number.isInteger(price) || price < 100) errors.price = MENU_ERRORS.price;
  if (draft.unit === null) errors.unit = MENU_ERRORS.unit;
  const unit = unitOf(draft);
  if (draft.unit === "count" && unit === null) errors.count = MENU_ERRORS.count;
  if (Object.keys(errors).length > 0 || unit === null) return { menu: null, errors };

  const parsed = reportMenuSchema.safeParse({ name, price, raw, ...unit });
  if (!parsed.success) return { menu: null, errors: { name: MENU_ERRORS.name } };
  return { menu: parsed.data, errors: null };
}
