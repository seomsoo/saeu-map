import { formatPrice, unitChipLabel } from "@/lib/places";
import type { Menu, Place, PlaceEdit, Sides } from "@/lib/types";

const SIDE_LABELS: Record<keyof Sides, string> = {
  headButter: "머리버터구이",
  ramen: "라면",
  friedRice: "볶음밥",
};

/**
 * 한 줄짜리 변경 — 화면이 **이전 값과 새 값을 다르게 그린다**(이전은 회색 취소선, 새 값은 진하게).
 * 문자열 하나로 합쳐 넘기면 그 대비를 만들 수 없어 표가 그냥 글줄이 된다(design 화면 10-3).
 */
export interface EditDiff {
  /** 무엇에 대한 줄인가 — 메뉴명·"영업시간" 등. 없으면 값만 그린다 */
  label?: string;
  from: string;
  to: string;
}

function menuText(menu: Menu): string {
  const unit = unitChipLabel(menu);
  const price = menu.price === null ? "가격 미확인" : `${formatPrice(menu.price)}원`;
  return [menu.name, unit, price].filter(Boolean).join(" ");
}

/** 빈 값은 "없음"이라고 말해야 무엇이 채워졌는지 보인다. */
function valueText(value: string | null): string {
  return value === null || value.trim() === "" ? "없음" : value;
}

/**
 * "무엇이 무엇으로 바뀌었나"를 줄 단위로 (design 화면 10-3). **바뀐 것만** 낸다 —
 * 운영자가 되돌릴지 한눈에 판단해야 하는 화면이라 안 바뀐 값이 섞이면 읽기가 느려진다.
 */
export function editDiffs(edit: PlaceEdit, place: Place | undefined): EditDiff[] {
  const before = edit.before;
  switch (edit.field) {
    case "hours":
      return [{ from: valueText(before.hoursNote), to: valueText(place?.hoursNote ?? null) }];
    case "address":
      return [{ from: valueText(before.addressRoad), to: valueText(place?.addressRoad ?? null) }];
    case "sides": {
      const now = place?.sides;
      if (!now) return [{ from: "사이드", to: "바뀜" }];
      return (Object.keys(SIDE_LABELS) as (keyof Sides)[])
        .filter((key) => before.sides[key] !== now[key])
        .map((key) => ({
          label: SIDE_LABELS[key],
          from: now[key] ? "없음" : "있음",
          to: now[key] ? "있음" : "없음",
        }));
    }
    case "menus": {
      const now = place?.menus ?? [];
      const diffs: EditDiff[] = [];
      for (const old of before.menus) {
        const same = now.find((m) => m.name === old.name);
        if (!same) {
          diffs.push({ label: old.name, from: menuText(old), to: "삭제됨" });
        } else if (same.price !== old.price) {
          diffs.push({
            label: old.name,
            from: old.price === null ? "가격 미확인" : `${formatPrice(old.price)}원`,
            to: same.price === null ? "가격 미확인" : `${formatPrice(same.price)}원`,
          });
        }
      }
      for (const menu of now) {
        if (!before.menus.some((m) => m.name === menu.name)) {
          diffs.push({ label: "추가", from: "없음", to: menuText(menu) });
        }
      }
      return diffs;
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
