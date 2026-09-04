"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { AddressHit } from "@/components/map/map-view";
import { Skeleton } from "@/components/ui/skeleton";

export const ADDRESS_EMPTY_MESSAGE = "검색 결과가 없어요";
export const ADDRESS_ERROR_MESSAGE = "주소를 찾지 못했어요";

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "ready"; hits: AddressHit[] };

interface AddressSearchProps {
  /** MapHandle.geocode — 지도 중심 근처 우선, 최대 5건. reject면 '실패' 상태 */
  geocode: (query: string) => Promise<AddressHit[]>;
  /** 행 탭 — 핀을 그 좌표로. 목록은 닫힌다 */
  onPick: (hit: AddressHit) => void;
}

/**
 * 2단계 주소 검색 — 핀을 옮기는 보조다 (design 화면 3-2). 엔터(조합 중 제외)·돋보기로 한 번 부르고
 * 결과 ≤5행을 입력 아래에 편다. 결과는 목록이 열려 있는 동안만 이 컴포넌트 상태에 있고 선택·언마운트에 버린다 —
 * Place·파일·DB에 쓰지 않는다(CLAUDE.md 규칙 2).
 */
export function AddressSearch({ geocode, onPick }: AddressSearchProps) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const composing = useRef(false);
  /** 늦게 온 이전 응답을 버린다. (마운트 여부 ref는 두지 않는다 — StrictMode의 이중 effect가 false로 굳혀 응답이 영영 버려졌다) */
  const requestSeq = useRef(0);

  const search = () => {
    const q = query.trim();
    if (q.length === 0) return;
    const seq = ++requestSeq.current;
    setState({ kind: "loading" });
    geocode(q).then(
      (hits) => {
        if (seq !== requestSeq.current) return;
        setState(hits.length === 0 ? { kind: "empty" } : { kind: "ready", hits });
      },
      () => {
        if (seq !== requestSeq.current) return;
        setState({ kind: "error" });
      },
    );
  };

  const handleSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (composing.current) return; // 한글 조합 중 Enter는 확정이 아니다
    search();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && e.nativeEvent.isComposing) e.preventDefault();
  };

  return (
    <div>
      <form
        role="search"
        aria-label="도로명 주소 검색"
        onSubmit={handleSubmit}
        className="flex h-12 w-full items-center gap-0.5 rounded-8 bg-bg-sunken px-4"
      >
        <button
          type="submit"
          aria-label="주소 검색"
          className="-ml-2 flex size-10 shrink-0 items-center justify-center text-fg-placeholder"
        >
          <span className="icon-[ci--search-magnifying-glass] size-6" aria-hidden="true" />
        </button>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          placeholder="도로명 주소로 찾기"
          aria-label="도로명 주소"
          autoComplete="off"
          enterKeyHint="search"
          className="h-full min-w-0 flex-1 bg-transparent text-body-l-medium text-fg outline-none placeholder:font-normal placeholder:text-fg-placeholder [&::-webkit-search-cancel-button]:appearance-none"
        />
      </form>

      {state.kind === "loading" && (
        <div aria-busy="true" aria-label="주소 찾는 중" className="mt-2 flex flex-col gap-2 py-1">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-2/3" />
        </div>
      )}
      {state.kind === "empty" && (
        <p role="status" className="mt-3 text-body-m-regular text-fg-secondary">
          {ADDRESS_EMPTY_MESSAGE}
        </p>
      )}
      {state.kind === "error" && (
        <p role="status" className="mt-3 text-body-m-regular text-fg-secondary">
          {ADDRESS_ERROR_MESSAGE}
        </p>
      )}
      {state.kind === "ready" && (
        <ul aria-label="주소 검색 결과" className="mt-2 divide-y divide-line-hairline">
          {state.hits.map((hit) => (
            <li key={`${hit.roadAddress}|${hit.jibunAddress}`}>
              <button
                type="button"
                onClick={() => {
                  setState({ kind: "idle" });
                  onPick(hit);
                }}
                className="press flex min-h-11 w-full flex-col justify-center py-1.5 text-left"
              >
                <span className="block truncate text-body-m-medium text-fg">{hit.roadAddress}</span>
                {hit.jibunAddress && (
                  <span className="block truncate text-caption-l-regular text-fg-tertiary">
                    {hit.jibunAddress}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
