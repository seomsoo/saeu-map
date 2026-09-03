import { Chip } from "@/components/ui/chip";
import { sideChips } from "@/lib/places";
import type { Sides } from "@/lib/types";
import { EditButton } from "./edit-button";

/**
 * 8. 사이드 — 고정 순서 3개. 있음 = 아웃라인 + 체크, 없음 = 가라앉은 배경 회색(필터가 아니라 사실 표시라 틴트 없음).
 * 칩 자체가 내용이라 제목은 캡션 급 라벨로 낮춘다 — 섹션 제목이 전부 같은 굵기면 위계가 사라진다.
 * 메뉴와 한 카드 안이라 경계선도 두지 않는다(8px 띠가 이미 카드를 나눈다).
 */
export function SidesRow({ sides, onSuggest }: { sides: Sides; onSuggest: () => void }) {
  return (
    <section aria-labelledby="place-sides-label" className="px-5 pt-1 pb-4">
      <div className="flex items-center justify-between gap-3">
        <p id="place-sides-label" className="text-caption-l-medium text-fg-tertiary">
          사이드
        </p>
        <EditButton label="사이드 수정" onClick={onSuggest} />
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="사이드 목록">
        {sideChips(sides).map((s) => (
          <li key={s.key}>
            <Chip size="sm" tone={s.active ? "outline" : "disabled"}>
              {s.active && <span className="icon-[ci--check] size-3.5" aria-hidden="true" />}
              {s.label}
              <span className="sr-only">{s.active ? " 있음" : " 없음"}</span>
            </Chip>
          </li>
        ))}
      </ul>
    </section>
  );
}
