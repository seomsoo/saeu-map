import { describe, expect, it } from "vitest";
import {
  EMPTY_MENU_DRAFT,
  MENU_ERRORS,
  formatPriceInput,
  priceDigits,
  validateMenuDraft,
} from "../menu-draft";

describe("priceDigits / formatPriceInput", () => {
  it("숫자만 남기고 표시는 천 단위 구분", () => {
    expect(priceDigits("3만원")).toBe("3");
    expect(priceDigits("35,000")).toBe("35000");
    expect(priceDigits("1234567890123")).toBe("123456789"); // 9자리 상한
    expect(formatPriceInput("35000")).toBe("35,000");
    expect(formatPriceInput("")).toBe("");
  });
});

describe("validateMenuDraft — 단위 칩 → Menu.unit/unit_raw (unitChipLabel이 읽는 형태)", () => {
  const base = { ...EMPTY_MENU_DRAFT, name: "왕새우 소금구이", price: "35000" };

  it.each([
    ["kg1", "", { unit: "kg", unitRaw: "1" }],
    ["g500", "", { unit: "g", unitRaw: "500" }],
    ["pan", "", { unit: "pan", unitRaw: "한판" }],
    ["halfPan", "", { unit: "pan", unitRaw: "반판" }],
    ["count", "10", { unit: "count", unitRaw: "10마리" }],
    ["none", "", { unit: "none", unitRaw: null }],
  ] as const)("%s", (unit, count, expected) => {
    const result = validateMenuDraft({ ...base, unit, count }, false);
    expect(result.errors).toBeNull();
    expect(result.menu).toEqual({ name: "왕새우 소금구이", price: 35000, raw: false, ...expected });
  });

  it("빈 줄은 이름·가격·단위 세 오류", () => {
    const result = validateMenuDraft(EMPTY_MENU_DRAFT, false);
    expect(result.menu).toBeNull();
    expect(result.errors).toEqual({ name: MENU_ERRORS.name, price: MENU_ERRORS.price, unit: MENU_ERRORS.unit });
  });

  it("가격 100원 미만·마리인데 수가 없으면 오류, 이름은 앞뒤 공백을 뗀다", () => {
    expect(validateMenuDraft({ ...base, price: "50", unit: "kg1" }, false).errors).toEqual({
      price: MENU_ERRORS.price,
    });
    expect(validateMenuDraft({ ...base, unit: "count", count: "" }, false).errors).toEqual({
      count: MENU_ERRORS.count,
    });
    expect(validateMenuDraft({ ...base, unit: "count", count: "0" }, false).errors).toEqual({
      count: MENU_ERRORS.count,
    });
    const trimmed = validateMenuDraft({ ...base, name: "  생새우회 ", unit: "g500" }, true);
    expect(trimmed.menu?.name).toBe("생새우회");
    expect(trimmed.menu?.raw).toBe(true);
  });
});
