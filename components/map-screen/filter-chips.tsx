import { ChipButton } from "@/components/ui/chip";
import { SIDE_KEYS, SIDE_LABELS } from "@/lib/places";
import type { ChipKey } from "@/lib/types";

/** 칩 5개 = spec 4.1 상한. 사이드가 앞(로그인 없이 바로 쓰는 필터), 6개째부터는 사이드를 드롭다운으로 접는다(decisions 2026-09-02). */
const CHIPS: readonly { key: ChipKey; label: string }[] = [
  ...SIDE_KEYS.map((key) => ({ key, label: SIDE_LABELS[key] })),
  { key: "new", label: "새로 들어온 집" },
  { key: "bookmarked", label: "찜한 곳" },
];

/** 2b. 필터 칩 — 토글 pill, 켜면 틴트(AND). 카테고리 드롭다운 오른쪽에서 가로 스크롤. */
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
