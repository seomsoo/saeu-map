"use client";

import { useRef, type KeyboardEvent } from "react";
import { cx } from "@/lib/cx";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  /** Enter/돋보기 — 결과가 다 보이게 지도 이동 */
  onSubmit: () => void;
}

/** 1. 검색바 — 우리 데이터 내 가게명·동네. 입력 즉시 필터, 확정 시 지도 이동. (버틸까 Search Bar) */
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
      className="flex h-12 w-full items-center gap-2.5 rounded-8 bg-bg-sunken px-4"
    >
      <button
        type="submit"
        aria-label="검색"
        className={cx(
          "flex size-6 shrink-0 items-center justify-center hit-44",
          value ? "text-fg-secondary" : "text-fg-placeholder",
        )}
      >
        <span className="icon-[ci--search-magnifying-glass] size-6" aria-hidden="true" />
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
        className="h-full min-w-0 flex-1 bg-transparent text-body-l-medium text-fg outline-none placeholder:font-normal placeholder:text-fg-placeholder [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="검색어 지우기"
          className="flex size-5 shrink-0 items-center justify-center rounded-max bg-fg-placeholder text-fg-on-brand hit-44"
        >
          <span className="icon-[ci--close-sm] size-3.5" aria-hidden="true" />
        </button>
      )}
    </form>
  );
}
