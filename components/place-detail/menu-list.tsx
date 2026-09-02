import { Button } from "@/components/ui/button";
import { formatPrice, unitChipLabel } from "@/lib/places";
import type { Menu } from "@/lib/types";

/** 7. 대표 메뉴 — 메뉴명 + 단위(회색 텍스트) / 가격 오른쪽(tabular). 끝에 "가격이 달라졌나요? 수정 제안". 없으면 "메뉴 알려주기" 입구. */
export function MenuList({ menus, onSuggest }: { menus: Menu[]; onSuggest: () => void }) {
  return (
    <section aria-labelledby="place-menu-heading" className="px-5 pt-4 pb-3">
      <h3 id="place-menu-heading" className="text-body-l-semibold text-fg">
        대표 메뉴
      </h3>
      {menus.length === 0 ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-body-m-regular text-fg-secondary">메뉴 정보가 없어요</p>
          <Button size="sm" onClick={onSuggest}>
            메뉴 알려주기
          </Button>
        </div>
      ) : (
        <>
          <ul className="mt-1 divide-y divide-line-hairline">
            {menus.map((menu, i) => {
              const unit = unitChipLabel(menu);
              return (
                <li key={`${String(i)}-${menu.name}`} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                    <span className="truncate text-body-m-regular text-fg">{menu.name}</span>
                    {unit && (
                      <span className="shrink-0 text-caption-l-regular text-fg-tertiary tabular-nums">
                        {unit}
                      </span>
                    )}
                  </span>
                  {menu.price === null ? (
                    <span className="shrink-0 text-caption-l-regular text-fg-tertiary">가격 미확인</span>
                  ) : (
                    <span className="shrink-0 text-body-m-semibold text-fg tabular-nums">
                      {formatPrice(menu.price)}원
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 flex items-center justify-end gap-1.5 text-caption-l-regular text-fg-tertiary">
            가격이 달라졌나요?
            <button
              type="button"
              onClick={onSuggest}
              className="text-caption-l-medium text-fg hit-44"
            >
              수정 제안
            </button>
          </p>
        </>
      )}
    </section>
  );
}
