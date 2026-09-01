/** 1. 상단 바 — 로고 텍스트(커스텀 로고 전까지) + [+ 제보]. 이 버튼이 화면의 유일한 액센트 레드. */
export function TopBar({ onReport }: { onReport: () => void }) {
  return (
    <header className="flex h-9 items-center justify-between">
      <h1 className="text-lg font-bold tracking-tight text-ink">새우맵</h1>
      <button
        type="button"
        onClick={onReport}
        className="inline-flex h-9 items-center gap-0.5 rounded-control bg-accent pl-2.5 pr-3.5 text-sm font-semibold text-on-accent shadow-[0_1px_2px_var(--color-shadow)] hit-44"
      >
        <span className="icon-[ci--add-plus] size-4" aria-hidden="true" />
        제보
      </button>
    </header>
  );
}
