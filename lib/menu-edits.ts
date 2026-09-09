import type { Menu } from "./types";
import type { ReportMenuInput, SuggestionInput } from "./schemas";

/** 제보 입력 한 줄 → 저장되는 메뉴. 서버 액션(`submitReport`)과 메뉴 제안이 같은 모양을 쓴다. */
export function toMenu(line: ReportMenuInput): Menu {
  return { raw: line.name, name: line.name, price: line.price, unit: line.unit, unit_raw: line.unitRaw };
}

/** 메뉴 제안 적용 — 가격 교체·삭제를 **원래 인덱스 기준으로** 한 번에 하고, 추가 줄은 뒤에 붙인다. */
export function applyMenuEdits(menus: Menu[], input: Extract<SuggestionInput, { field: "menus" }>): Menu[] {
  const removed = new Set(input.edits.filter((e) => e.removed).map((e) => e.index));
  const prices = new Map(input.edits.filter((e) => e.price !== undefined).map((e) => [e.index, e.price]));
  const kept = menus
    .map((menu, i) => {
      const price = prices.get(i);
      return price === undefined ? menu : { ...menu, price };
    })
    .filter((_, i) => !removed.has(i));
  return [...kept, ...input.added.map(toMenu)];
}
