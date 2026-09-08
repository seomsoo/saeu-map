import { ChipButton } from "@/components/ui/chip";
import { SIDE_KEYS, SIDE_LABELS } from "@/lib/places";
import type { ChipKey } from "@/lib/types";

/**
 * 상시 칩 4개 — 사이드 3종 + 찜한 곳. 전부 "목록을 좁히는 필터"라 성격이 같다.
 * [새로 들어온 집]은 필터가 아니라 시트를 다른 화면으로 바꾸는 입구였어서 뺐다(2026-09-05).
 * 2026-09-09에 **필터로** 돌아왔지만 자리는 시즌 카운터다 — 여기엔 **켜져 있는 동안만** 붙는다(아래).
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
      {/* 적용된 필터 토큰 — 입구는 시즌 카운터고, 상태·해제는 필터가 사는 이 자리에 둔다.
          **맨 앞**이라야 한다: 칩 행은 가로 스크롤이라 뒤에 붙이면 화면 밖으로 나가 "왜 3곳이지?"의
          답이 안 보인다(2026-09-09 실측). 켜져 있는 동안만 붙으므로 spec 4.1의 "칩 최대 5개"를
          상시로는 넘지 않는다. */}
      {chips.includes("new") && (
        <ChipButton
          pressed
          aria-label="새로 들어온 집 필터 해제"
          onClick={() => {
            onToggle("new");
          }}
          className="shadow-float lg:shadow-none"
        >
          새로 들어온 집
          <span className="icon-[ci--close-sm] size-3.5" aria-hidden="true" />
        </ChipButton>
      )}
      {CHIPS.map(({ key, label }) => (
        <ChipButton
          key={key}
          pressed={chips.includes(key)}
          onClick={() => {
            onToggle(key);
          }}
          className="shadow-float lg:shadow-none"
        >
          {label}
        </ChipButton>
      ))}
    </div>
  );
}
