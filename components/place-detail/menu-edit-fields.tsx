"use client";

import { MenuLine } from "@/components/report/menu-fields";
import {
  EMPTY_MENU_DRAFT,
  formatPriceInput,
  priceDigits,
  type MenuDraft,
  type MenuDraftErrors,
} from "@/components/report/menu-draft";
import { cx } from "@/lib/cx";
import { unitChipLabel } from "@/lib/places";
import type { Menu } from "@/lib/types";

/** 시트가 들고 있는 편집 상태 — 줄마다 가격 문자열(숫자만)과 "없어졌어요" 표시, 그리고 추가 줄 하나. */
export interface MenuEditDraft {
  prices: string[];
  removed: boolean[];
  /** 추가 줄을 펼쳤나 — 메뉴가 하나도 없는 가게는 처음부터 펼쳐 연다 */
  adding: boolean;
  added: MenuDraft;
}

export function initialMenuEditDraft(menus: readonly Menu[]): MenuEditDraft {
  return {
    prices: menus.map((menu) => (menu.price === null ? "" : String(menu.price))),
    removed: menus.map(() => false),
    adding: menus.length === 0,
    added: EMPTY_MENU_DRAFT,
  };
}

interface MenuEditFieldsProps {
  menus: readonly Menu[];
  draft: MenuEditDraft;
  addedErrors: MenuDraftErrors;
  onChange: (next: MenuEditDraft) => void;
  onChangeAdded: (changes: Partial<MenuDraft>) => void;
}

/**
 * 메뉴 수정 본문 (design 화면 2 "상세의 쓰기 표면" — 대표 메뉴). **지금 있는 줄을 그대로** 보여주고
 * 가격만 고친다: 크롤 가게는 메뉴가 중앙값 3줄·최대 5줄이라 제보의 구이/회 2줄 폼으로는 나머지가
 * 사라지는 것처럼 읽혔다(decisions 2026-09-08).
 * **메뉴명·단위는 받지 않는다** — 깨진 이름은 우리 파싱 잔재이고(Phase 6 임포트에서 정제), 익명 사용자가
 * 즉시 반영이라 익명이 남의 가게 메뉴명을 갈아엎을 수 있게 두지 않는다.
 */
export function MenuEditFields({
  menus,
  draft,
  addedErrors,
  onChange,
  onChangeAdded,
}: MenuEditFieldsProps) {
  return (
    <div>
      {menus.length > 0 && (
        <ul aria-label="지금 메뉴">
          {menus.map((menu, i) => {
            const gone = draft.removed[i] ?? false;
            const unit = unitChipLabel(menu);
            return (
              <li
                key={`${String(i)}-${menu.name}`}
                className="flex items-center gap-2 border-t border-line-hairline py-2 first:border-t-0"
              >
                <span className={cx("min-w-0 flex-1", gone && "text-fg-tertiary")}>
                  {/* 취소선은 이 안쪽에 준다 — `truncate`(overflow:hidden)가 독립 서식 문맥을 만들어
                      바깥에서 준 text-decoration이 안으로 전파되지 않는다(390×702 실측) */}
                  <span className={cx("block truncate text-body-m-regular", gone && "line-through")}>
                    {menu.name}
                  </span>
                  {unit && (
                    <span className="text-caption-l-regular text-fg-tertiary tabular-nums">{unit}</span>
                  )}
                </span>
                {/* 인라인이라 라벨을 위에 못 둔다 — TextField와 같은 토큰(h-11·라운드 8·가라앉은 배경)만 쓴다 */}
                <span className="flex h-11 w-28 shrink-0 items-center gap-1 rounded-8 bg-bg-sunken px-3">
                  <input
                    aria-label={`${menu.name} 가격`}
                    inputMode="numeric"
                    pattern="[0-9,]*"
                    placeholder="가격"
                    autoComplete="off"
                    disabled={gone}
                    value={formatPriceInput(draft.prices[i] ?? "")}
                    onChange={(e) => {
                      const prices = [...draft.prices];
                      prices[i] = priceDigits(e.target.value);
                      onChange({ ...draft, prices });
                    }}
                    className="h-full min-w-0 flex-1 bg-transparent text-right text-body-m-medium text-fg tabular-nums outline-none placeholder:font-normal placeholder:text-fg-placeholder disabled:text-fg-placeholder"
                  />
                  <span className="shrink-0 text-caption-l-regular text-fg-tertiary">원</span>
                </span>
                <button
                  type="button"
                  aria-pressed={gone}
                  aria-label={`${menu.name} 없어졌어요`}
                  onClick={() => {
                    const removed = [...draft.removed];
                    removed[i] = !gone;
                    onChange({ ...draft, removed });
                  }}
                  className="press flex size-11 shrink-0 items-center justify-center"
                >
                  <span
                    className={cx(
                      "icon-[ci--close-md] size-5",
                      gone ? "text-brand-fg" : "text-fg-tertiary",
                    )}
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {draft.adding ? (
        <div className="mt-3 border-t border-line-hairline pt-3">
          <MenuLine raw={false} value={draft.added} errors={addedErrors} onChange={onChangeAdded} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            onChange({ ...draft, adding: true });
          }}
          className="press mt-2 text-caption-l-medium text-fg-tertiary hit-44"
        >
          ＋ 메뉴 추가
        </button>
      )}
    </div>
  );
}
