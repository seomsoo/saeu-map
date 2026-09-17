import { describe, expect, it } from "vitest";
import { applyMenuEdits } from "../menu-edits";
import { makeMenu } from "./fixtures";

const ID = "3f2a9c1e-1111-4a1a-9b1b-000000000001";

describe("applyMenuEdits — 가격 교체·삭제는 원래 인덱스로 한 번에, 추가 줄은 뒤에", () => {
  it("삭제한 줄 앞뒤의 인덱스가 밀리지 않는다", () => {
    const menus = [makeMenu({ name: "A", price: 100 }), makeMenu({ name: "B", price: 200 }), makeMenu({ name: "C", price: 300 })];
    const next = applyMenuEdits(menus, {
      field: "menus",
      placeId: ID,
      edits: [
        { index: 0, name: "A", removed: true },
        { index: 2, name: "C", price: 350, removed: false },
      ],
      added: [{ name: "D", price: 400, unit: "none", unitRaw: null, raw: false }],
    });
    expect(next.map((m) => [m.name, m.price])).toEqual([
      ["B", 200],
      ["C", 350],
      ["D", 400],
    ]);
    expect(next[2]?.raw).toBe("D");
  });
});
