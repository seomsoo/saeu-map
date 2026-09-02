import { ChipButton } from "@/components/ui/chip";
import type { ChipKey } from "@/lib/types";

/** 칩 자리는 최대 5개 (spec 4.1). 지금은 2개. */
const CHIPS: readonly { key: ChipKey; label: string }[] = [
  { key: "new", label: "새로 들어온 집" },
  { key: "bookmarked", label: "찜한 곳" },
];

/** 2b. 필터 칩 — 토글 pill, 켜면 틴트. 카테고리와 같은 줄에서 가로 스크롤. */
export function FilterChips({
  chips,
  onToggle,
}: {
  chips: readonly ChipKey[];
  onToggle: (chip: ChipKey) => void;
}) {
  return (
    <div role="group" aria-label="필터" className="flex shrink-0 gap-1.5">
      {CHIPS.map(({ key, label }) => (
        <ChipButton
          key={key}
          pressed={chips.includes(key)}
          onClick={() => {
            onToggle(key);
          }}
          className="shadow-float"
        >
          {label}
        </ChipButton>
      ))}
    </div>
  );
}
