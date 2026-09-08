import { formatPrice, unitChipLabel } from "@/lib/places";
import type { Menu, Place, PlaceEdit, Sides } from "@/lib/types";

const SIDE_LABELS: Record<keyof Sides, string> = {
  headButter: "머리버터구이",
  ramen: "라면",
  friedRice: "볶음밥",
};

function menuText(menu: Menu): string {
  const unit = unitChipLabel(menu);
  const price = menu.price === null ? "가격 미확인" : `${formatPrice(menu.price)}원`;
  return [menu.name, unit, price].filter(Boolean).join(" ");
}

/** 값 하나를 사람이 읽는 말로. 빈 값은 "없음"이라고 말해야 무엇이 채워졌는지 보인다. */
function valueText(value: string | null): string {
  return value === null || value.trim() === "" ? "없음" : value;
}

/**
 * "무엇이 무엇으로 바뀌었나"를 줄 단위로 (design 화면 10-3). **바뀐 것만** 쓴다 —
 * 운영자가 되돌릴지 말지를 한눈에 판단해야 하는 화면이라 안 바뀐 값이 섞이면 읽기가 느려진다.
 * 메뉴는 줄 단위로 여러 줄이 나올 수 있다.
 */
export function editSummary(edit: PlaceEdit, place: Place | undefined): string[] {
  const before = edit.before;
  switch (edit.field) {
    case "hours":
      return [`영업시간 ${valueText(before.hoursNote)} → ${valueText(place?.hoursNote ?? null)}`];
    case "address":
      return [`주소 ${valueText(before.addressRoad)} → ${valueText(place?.addressRoad ?? null)}`];
    case "sides": {
      const now = place?.sides;
      if (!now) return ["사이드가 바뀌었어요"];
      const lines = (Object.keys(SIDE_LABELS) as (keyof Sides)[])
        .filter((key) => before.sides[key] !== now[key])
        .map((key) => `${SIDE_LABELS[key]} ${now[key] ? "없음 → 있음" : "있음 → 없음"}`);
      return lines.length > 0 ? lines : ["사이드가 그대로예요"];
    }
    case "menus": {
      const now = place?.menus ?? [];
      const lines: string[] = [];
      for (const old of before.menus) {
        const same = now.find((m) => m.name === old.name);
        if (!same) {
          lines.push(`${menuText(old)} → 삭제됨`);
        } else if (same.price !== old.price) {
          const from = old.price === null ? "가격 미확인" : formatPrice(old.price);
          const to = same.price === null ? "가격 미확인" : formatPrice(same.price);
          lines.push(`${old.name} ${from} → ${to}`);
        }
      }
      for (const menu of now) {
        if (!before.menus.some((m) => m.name === menu.name)) lines.push(`+ ${menuText(menu)}`);
      }
      return lines.length > 0 ? lines : ["메뉴가 그대로예요"];
    }
  }
}

/** 누가 고쳤나 — 익명 id는 그대로 보여줄 값이 아니다(운영자에게도 식별자는 필요 없다). */
export function actorText(edit: PlaceEdit): string {
  if (edit.actor === undefined) return "탈퇴한 사용자";
  return edit.actor.startsWith("anon-") ? "익명" : "카카오";
}

export const FIELD_LABEL: Record<PlaceEdit["field"], string> = {
  hours: "영업시간",
  address: "주소",
  menus: "메뉴",
  sides: "사이드",
};
