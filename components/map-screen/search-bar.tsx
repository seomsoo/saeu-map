"use client";

import { useRef, type KeyboardEvent } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  /** Enter/돋보기 — 결과가 다 보이게 지도 이동 */
  onSubmit: () => void;
}

/** 2. 검색바 — 우리 데이터 내 가게명·동네. 입력 즉시 필터, 확정 시 지도 이동. */
export function SearchBar({ value, onChange, onClear, onSubmit }: SearchBarProps) {
  const composing = useRef(false);

  const handleSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (composing.current) return; // 한글 조합 중 Enter는 확정이 아니다
    onSubmit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && e.nativeEvent.isComposing) e.preventDefault();
  };

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="flex h-10 items-center gap-1 rounded-control border border-border bg-surface pl-1 pr-0.5 shadow-[0_1px_2px_var(--color-shadow)]"
    >
      <button
        type="submit"
        aria-label="검색"
        className="flex size-10 shrink-0 items-center justify-center text-ink-secondary hit-44"
      >
        <span className="icon-[ci--search-magnifying-glass] size-5" aria-hidden="true" />
      </button>
      <input
        type="search"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
        }}
        placeholder="가게·동네 검색"
        aria-label="가게·동네 검색"
        autoComplete="off"
        enterKeyHint="search"
        className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-tertiary [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="검색어 지우기"
          className="flex size-10 shrink-0 items-center justify-center text-ink-tertiary hit-44"
        >
          <span className="icon-[ci--close-md] size-5" aria-hidden="true" />
        </button>
      )}
    </form>
  );
}
