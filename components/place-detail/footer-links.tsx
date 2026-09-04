import { Fragment } from "react";

const SUGGEST_LABEL = "정보 수정 제안";
const LINKS = [SUGGEST_LABEL, "신고", "사장님이신가요?"] as const;

/**
 * 9. 맨 아래 한 줄 — 회색 텍스트 버튼 3개, 세로 헤어라인으로 구분.
 * [정보 수정 제안]은 사유 시트를 연다(Phase 4). 신고·사장님은 Phase 6까지 준비 중 토스트.
 */
export function FooterLinks({
  onSuggest,
  onSelect,
}: {
  onSuggest: () => void;
  onSelect: (label: string) => void;
}) {
  return (
    <nav
      aria-label="가게 정보 관리"
      className="flex items-center justify-center px-5 pt-3 pb-safe-bottom-or-3"
    >
      {LINKS.map((label, i) => (
        <Fragment key={label}>
          {i > 0 && <span aria-hidden="true" className="mx-3 h-3 w-px bg-line" />}
          <button
            type="button"
            onClick={() => {
              if (label === SUGGEST_LABEL) onSuggest();
              else onSelect(label);
            }}
            className="text-caption-l-regular text-fg-tertiary hit-44"
          >
            {label}
          </button>
        </Fragment>
      ))}
    </nav>
  );
}
