"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ModalSheet, closeEnclosingDialog } from "@/components/ui/modal-sheet";
import { TextField } from "@/components/ui/text-field";
import { mergePlaces, searchPlacesForAdmin } from "@/lib/data";
import type { Place } from "@/lib/types";

export const MERGED_NOTICE = "합쳤어요";
export const MERGE_FAILED_NOTICE = "합치지 못했어요";
const SEARCH_FAILED_NOTICE = "검색하지 못했어요";

interface Target {
  id: string;
  name: string;
}

/**
 * 합치기 시트 — 옛 가게(from)의 사진·확인·리뷰·찜·신고·이력을 새 가게로 옮기고 옛 가게는 숨긴다(RPC admin_merge_places).
 * **되돌리기 없음**이라 삭제와 같은 급의 확인 모달이다(plan §7 — design 화면 10의 "확인 모달은 삭제 하나뿐"에 둘째가 생겼다).
 * 중복 의심 배지에서 열면 후보(`into`)가 정해져 있어 검색 단계를 건너뛰고, 검색 탭에서는 상호로 찾아 고른다.
 */
export function MergeSheet({
  from,
  into = null,
  now,
  onClose,
  onMerged,
  onNotice,
}: {
  from: Place;
  /** 중복 의심 후보 — 있으면 검색 단계 없이 바로 확인 */
  into?: Target | null;
  now: string;
  onClose: () => void;
  /** 성공 — 부모가 목록에서 옛 가게를 뺀다 */
  onMerged: (into: Place) => void;
  onNotice: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [target, setTarget] = useState<Target | null>(into);
  const [merging, setMerging] = useState(false);
  /** 늦게 온 검색 응답은 버린다(요청 순번) */
  const seq = useRef(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  /** 시트가 닫힌 뒤 도착한 합치기 응답은 부모를 부르지 않는다(CLAUDE.md alive ref) */
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const search = () => {
    const q = query.trim();
    if (q === "") return;
    seq.current += 1;
    const mine = seq.current;
    searchPlacesForAdmin(q, now).then(
      (found) => {
        // 자기 자신·숨긴 가게는 대상이 못 된다(RPC도 거부한다)
        if (mine === seq.current) setResults(found.filter((p) => p.id !== from.id && p.hiddenAt === undefined));
      },
      () => {
        if (mine === seq.current) onNotice(SEARCH_FAILED_NOTICE);
      },
    );
  };

  const confirm = () => {
    if (target === null || merging) return;
    setMerging(true);
    mergePlaces(from.id, target.id).then(
      (place) => {
        if (!alive.current) return;
        onNotice(MERGED_NOTICE);
        onMerged(place);
      },
      () => {
        if (!alive.current) return;
        setMerging(false);
        onNotice(MERGE_FAILED_NOTICE);
      },
    );
  };

  return (
    <ModalSheet label={`${from.name} 합치기`} onClose={onClose}>
      <div className="px-5 pt-6">
        <h2 className="text-title-s-semibold text-fg">{from.name}을(를) 다른 가게로 합칠까요?</h2>
        <p className="mt-1 text-body-m-regular text-fg-secondary">
          사진·확인·리뷰·찜이 옮겨지고 이 가게는 숨겨져요. 옛 주소는 새 가게로 이어져요. 되돌릴 수 없어요.
        </p>

        {target === null ? (
          <>
            <form
              className="mt-4 flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                search();
              }}
            >
              <TextField
                className="flex-1"
                label="합칠 가게 상호"
                placeholder="예: 원조나라수산"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                }}
                autoComplete="off"
              />
              <Button variant="outline" size="md" type="submit">
                찾기
              </Button>
            </form>
            {results !== null &&
              (results.length === 0 ? (
                <p className="mt-3 text-body-m-regular text-fg-tertiary">찾는 가게가 없어요</p>
              ) : (
                <ul aria-label="합칠 가게 후보" className="mt-3 divide-y divide-line-hairline">
                  {results.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setTarget({ id: p.id, name: p.name });
                        }}
                        className="press flex h-11 w-full items-center justify-between text-left"
                      >
                        <span className="text-body-m-medium text-fg">{p.name}</span>
                        <span className="text-caption-l-regular text-fg-tertiary">{p.gu}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ))}
          </>
        ) : (
          <>
            <p className="mt-4 text-body-m-medium text-fg">→ {target.name}</p>
            {into === null && (
              <button
                type="button"
                onClick={() => {
                  setTarget(null);
                }}
                className="press mt-1 text-caption-l-regular text-fg-secondary hit-44"
              >
                다른 가게 고르기
              </button>
            )}
            <Button variant="danger" size="xl" className="mt-5 w-full" disabled={merging} onClick={confirm}>
              {merging ? "합치는 중…" : "합치기"}
            </Button>
          </>
        )}

        <button
          ref={closeRef}
          type="button"
          onClick={() => {
            closeEnclosingDialog(closeRef.current);
          }}
          className="press mx-auto mt-3 flex h-11 items-center px-3 text-body-m-regular text-fg-secondary"
        >
          그만두기
        </button>
      </div>
    </ModalSheet>
  );
}
