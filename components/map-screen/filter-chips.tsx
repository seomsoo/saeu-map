import { ChipButton } from "@/components/ui/chip";
import { SIDE_KEYS, SIDE_LABELS } from "@/lib/places";
import type { ChipKey } from "@/lib/types";

/**
 * 칩 4개 — 사이드 3종 + 찜한 곳. 전부 "목록을 좁히는 필터"라 성격이 같다.
 * [새로 들어온 집]은 필터가 아니라 시트를 다른 화면으로 바꾸는 입구였어서 뺐다(2026-09-05).
 */
const CHIPS: readonly { key: ChipKey; label: string }[] = [
  ...SIDE_KEYS.map((key) => ({ key, label: SIDE_LABELS[key] })),
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
