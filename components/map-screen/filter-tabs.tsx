import { ChipButton } from "@/components/ui/chip";
import type { TabKey } from "@/lib/types";

const TABS: readonly { key: TabKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "grill", label: "구이" },
  { key: "raw", label: "회" },
];

/** 2a. 카테고리 — 전체/구이/회 (다중 태그 매칭). 단일 선택 pill, 활성만 틴트. */
export function FilterTabs({
  tab,
  onChange,
}: {
  tab: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  return (
    <div role="group" aria-label="카테고리" className="flex shrink-0 gap-1.5">
      {TABS.map(({ key, label }) => (
        <ChipButton
          key={key}
          pressed={tab === key}
          onClick={() => {
            onChange(key);
          }}
          className="shadow-float"
        >
          {label}
        </ChipButton>
      ))}
    </div>
  );
}
