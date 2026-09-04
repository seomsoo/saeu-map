"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/lib/cx";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  /** Enter/돋보기 — 결과가 다 보이게 지도 이동 */
  onSubmit: () => void;
  /** 오른쪽 끝 슬롯(프로필 버튼). 검색어가 있으면 그 자리는 지우기 ✕라 렌더하지 않는다. */
  trailing?: ReactNode;
}

/** 1. 검색바 — 우리 데이터 내 가게명·동네. 입력 즉시 필터, 확정 시 지도 이동.
 *  지도 위에 떠 있는 pill(칩과 같은 층·문법) — 불투명 블록으로 지도를 덮지 않는다 (decisions 2026-09-04).
 *  오른쪽 끝은 내 활동 입구(프로필 버튼) — 지도 위에 층을 더하지 않는 카카오맵·네이버지도 문법 (design 화면 5). */
export function SearchBar({ value, onChange, onClear, onSubmit, trailing }: SearchBarProps) {
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
      className="flex h-12 w-full items-center gap-0.5 rounded-max border border-line bg-bg px-4 shadow-float"
    >
      {/* 히트 영역 40px, 시각은 24px 아이콘 — 음수 마진으로 아이콘 위치는 그대로 (Codex #3 P2) */}
      <button
        type="submit"
        aria-label="검색"
        className={cx(
          "-ml-2 flex size-10 shrink-0 items-center justify-center",
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
      {value ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="검색어 지우기"
          className="-mr-2.5 flex size-10 shrink-0 items-center justify-center"
        >
          <span
            className="flex size-5 items-center justify-center rounded-max bg-fg-placeholder text-fg-on-brand"
            aria-hidden="true"
          >
            <span className="icon-[ci--close-sm] size-3.5" />
          </span>
        </button>
      ) : (
        trailing
      )}
    </form>
  );
}
