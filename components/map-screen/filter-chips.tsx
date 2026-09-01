import { ChipButton } from "@/components/ui/chip";
import type { ChipKey } from "@/lib/types";

/** 칩 자리는 최대 5개 (spec 4.1). 지금은 2개. */
const CHIPS: readonly { key: ChipKey; label: string }[] = [
  { key: "new", label: "새로 들어온 집" },
  { key: "bookmarked", label: "찜한 곳" },
];

/** 6. 칩 — 아웃라인 기본, 켜면 채움. 가로 스크롤. */
export function FilterChips({
  chips,
  onToggle,
}: {
  chips: readonly ChipKey[];
  onToggle: (chip: ChipKey) => void;
}) {
  return (
    <div
      role="group"
      aria-label="필터"
      className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3"
    >
      {CHIPS.map(({ key, label }) => (
        <ChipButton
          key={key}
          size="sm"
          pressed={chips.includes(key)}
          onClick={() => {
            onToggle(key);
          }}
          className="h-8 shadow-[0_1px_2px_var(--color-shadow)]"
        >
          {label}
        </ChipButton>
      ))}
    </div>
  );
}
