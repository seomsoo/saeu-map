import { cx } from "@/lib/cx";
import type { PeelType, PeelSlug } from "@/lib/types";
import { TypeArt } from "./type-art";

/**
 * 유형 2×2 매트릭스 (결과 화면). 축이 둘뿐이라 **네 유형이 격자로 정확히 떨어진다** — 내 자리를 보여주면
 * "왜 이 결과가 나왔는지"가 한눈에 읽히고, 나머지 셋이 보여 다시 하거나 친구에게 보낼 이유가 생긴다.
 * 축 라벨은 화면 용어 그대로("새우구이"·"생새우회", spec 7).
 *
 * 격자는 flex 두 줄이다 — `grid-cols-[auto_1fr_1fr]`은 임의값이라 쓰지 않는다.
 */
const ROWS = [
  { role: "peel" as const, label: "까주는 쪽" },
  { role: "served" as const, label: "받는 쪽" },
];
const COLUMNS = [
  { taste: "grill" as const, label: "새우구이" },
  { taste: "raw" as const, label: "생새우회" },
];

/** 행 라벨 열 폭 — 헤더와 본문이 같은 값을 써야 칸이 맞는다 */
const LABEL_COLUMN = "w-16 shrink-0";

export function TypeMatrix({ types, mine }: { types: PeelType[]; mine: PeelSlug }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-body-l-semibold text-fg">네 유형 중 내 자리</h2>

      <div className="flex items-center gap-1.5">
        <span className={LABEL_COLUMN} />
        {COLUMNS.map((column) => (
          <p
            key={column.taste}
            className="flex-1 text-center text-caption-l-medium text-fg-tertiary"
          >
            {column.label}
          </p>
        ))}
      </div>

      {ROWS.map((row) => (
        <div key={row.role} className="flex items-stretch gap-1.5">
          <p
            className={cx(
              LABEL_COLUMN,
              "flex items-center pr-1 text-caption-l-medium text-fg-tertiary",
            )}
          >
            {row.label}
          </p>
          {COLUMNS.map((column) => {
            const type = types.find((t) => t.role === row.role && t.taste === column.taste);
            if (!type) return <span key={column.taste} className="flex-1" />;
            const current = type.slug === mine;
            return (
              <div
                key={column.taste}
                aria-current={current ? "true" : undefined}
                className={cx(
                  "flex flex-1 flex-col items-center gap-1 rounded-16 border px-2 py-3",
                  current ? "border-brand-fg bg-brand-tint" : "border-line-hairline bg-bg-dim",
                )}
              >
                <TypeArt slug={type.slug} size="sm" className={cx(!current && "opacity-40")} />
                <p
                  className={cx(
                    "text-caption-l-semibold",
                    current ? "text-brand-fg" : "text-fg-tertiary",
                  )}
                >
                  {type.shortName}
                </p>
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
