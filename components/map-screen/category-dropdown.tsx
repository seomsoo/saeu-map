import { DropdownChip } from "@/components/ui/dropdown-chip";
import { TAG_LABELS } from "@/lib/places";
import type { TabKey } from "@/lib/types";

const OPTIONS: readonly { key: TabKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "grill", label: TAG_LABELS.grill },
  { key: "raw", label: TAG_LABELS.raw },
];

/** 2a. 카테고리 — 드롭다운 칩 [전체 ▾] → 전체 / 소금구이 / 생새우회 (다중 태그 매칭). 선택하면 칩이 틴트. */
export function CategoryDropdown({
  tab,
  onChange,
}: {
  tab: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  return <DropdownChip label="카테고리" value={tab} options={OPTIONS} onChange={onChange} />;
}
