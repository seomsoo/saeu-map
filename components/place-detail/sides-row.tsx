import { Chip } from "@/components/ui/chip";
import { sideChips } from "@/lib/places";
import type { Sides } from "@/lib/types";

/** 8. 사이드 — 고정 순서 3개. 있음 = 아웃라인 + 체크, 없음 = 가라앉은 배경 회색(필터가 아니라 사실 표시라 틴트 없음). */
export function SidesRow({ sides }: { sides: Sides }) {
  return (
    <section aria-labelledby="place-sides-heading" className="border-t border-line-hairline px-5 pt-3 pb-4">
      <h3 id="place-sides-heading" className="text-body-l-semibold text-fg">
        사이드
      </h3>
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
