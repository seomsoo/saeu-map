import { Fragment } from "react";

/**
 * 9. 맨 아래 한 줄 — 회색 텍스트 버튼 3개, 세로 헤어라인으로 구분.
 * 셋 다 실제로 동작한다(2026-09-08): [정보 수정 제안]·[신고]는 사유 시트, [사장님이신가요?]는 요청 폼.
 */
export function FooterLinks({
  onSuggest,
  onReport,
  onOwner,
}: {
  onSuggest: () => void;
  onReport: () => void;
  onOwner: () => void;
}) {
  const links = [
    { label: "정보 수정 제안", open: onSuggest },
    { label: "신고", open: onReport },
    { label: "사장님이신가요?", open: onOwner },
  ];
  return (
    <nav
      aria-label="가게 정보 관리"
      className="flex items-center justify-center px-5 pt-3 pb-safe-bottom-or-3"
    >
      {links.map(({ label, open }, i) => (
        <Fragment key={label}>
          {i > 0 && <span aria-hidden="true" className="mx-3 h-3 w-px bg-line" />}
          <button
            type="button"
            onClick={() => {
              open();
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
