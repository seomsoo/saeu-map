"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { findNameMatches } from "@/lib/duplicates";
import { TAG_LABELS } from "@/lib/places";
import type { Place } from "@/lib/types";
import { StepFrame } from "./step-frame";

export const NAME_MAX = 40;
export const NAME_REQUIRED_ERROR = "가게 이름을 입력해주세요";

interface StepNameProps {
  places: readonly Place[];
  value: string;
  onChange: (value: string) => void;
  onBack: () => void;
  /** 매치 행 탭 — 그 가게 상세로 넘어가고 플로우는 닫힌다 */
  onOpenExisting: (id: string) => void;
  onNext: () => void;
}

/**
 * 1단계 — 가게 이름 (design 화면 3-1). 입력은 열리자마자 포커스, 두 글자부터 우리 DB를 맞춰 최대 5행
 * "이미 있어요". 바닥 CTA [새로 등록하기]는 매치 유무와 무관하게 늘 있다 — 설명 캡션은 두지 않는다.
 */
export function StepName({
  places,
  value,
  onChange,
  onBack,
  onOpenExisting,
  onNext,
}: StepNameProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const composing = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const matches = findNameMatches(value, places);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    if (value.trim().length === 0) {
      setError(NAME_REQUIRED_ERROR);
      inputRef.current?.focus();
      return;
    }
    onNext();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (composing.current || e.nativeEvent.isComposing) return; // 한글 조합 중 Enter는 확정이 아니다
    submit();
  };

  return (
    <StepFrame
      step={1}
      title="가게 이름을 검색해주세요"
      caption="이미 있는 가게면 바로 알려드려요"
      onBack={onBack}
      footer={
        <Button variant="brand" size="xl" className="w-full" onClick={submit}>
          새로 등록하기
        </Button>
      }
    >
      <div className="flex h-12 items-center gap-1.5 rounded-8 bg-bg-sunken px-4">
        <span
          className="icon-[ci--search-magnifying-glass] -ml-1 size-6 shrink-0 text-fg-placeholder"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          value={value}
          maxLength={NAME_MAX}
          onChange={(e) => {
            setError(null);
            onChange(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          placeholder="예: 왕새우직판장"
          aria-label="가게 이름"
          aria-invalid={error !== null}
          autoComplete="off"
          enterKeyHint="next"
          className="h-full min-w-0 flex-1 bg-transparent text-body-l-medium text-fg outline-none placeholder:font-normal placeholder:text-fg-placeholder"
        />
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-caption-l-regular text-brand-fg">
          {error}
        </p>
      )}
      {matches.length > 0 && (
        <ul
          aria-label="이미 있는 가게"
          className="mt-3 divide-y divide-line-hairline"
        >
          {matches.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => {
                  onOpenExisting(place.id);
                }}
                className="press flex h-14 w-full items-center gap-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-l-semibold text-fg">
                    {place.name}
                  </span>
                  <span className="block truncate text-caption-l-regular text-fg-tertiary">
                    {[place.gu, ...place.tags.map((t) => TAG_LABELS[t])].join(
                      " · ",
                    )}
                  </span>
                </span>
                <Chip tone="active" size="xs">
                  이미 있어요
                </Chip>
              </button>
            </li>
          ))}
        </ul>
      )}
    </StepFrame>
  );
}
