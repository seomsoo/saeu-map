"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ModalSheet, closeEnclosingDialog } from "@/components/ui/modal-sheet";
import { TextField } from "@/components/ui/text-field";
import { deletePlace, searchPlacesForAdmin, setPlaceHidden } from "@/lib/data";
import { relativeCheckAgo } from "@/lib/time";
import type { Place } from "@/lib/types";
import {
  AdminActions,
  AdminCell,
  AdminCount,
  AdminEmpty,
  AdminListState,
  AdminRow,
  AdminStatus,
  AdminTable,
  AdminWhen,
} from "./admin-table";
import { useAdminList } from "./use-admin-list";

export const SEARCH_HIDDEN_NOTICE = "숨겼어요";
export const SEARCH_RESTORED_NOTICE = "복구했어요";
export const SEARCH_DELETED_NOTICE = "내렸어요";
export const SEARCH_FAILED_NOTICE = "처리하지 못했어요";

const COLUMNS = [
  { key: "name", label: "상호" },
  { key: "gu", label: "구" },
  { key: "state", label: "상태" },
  { key: "created", label: "등록", align: "right" as const },
  { key: "actions", label: "", align: "right" as const },
];

/**
 * 검색 탭 (design 화면 10-4) — 비상용. 상호로 찾아 직접 내리거나 복구한다.
 * **숨긴 가게도 나온다**(복구하려면 찾을 수 있어야 한다). 삭제는 소프트고 **유일하게 확인 모달을 쓴다**.
 */
export function SearchTab({ now, onNotice }: { now: string; onNotice: (m: string) => void }) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const load = useCallback(
    () => (submitted === "" ? Promise.resolve<Place[]>([]) : searchPlacesForAdmin(submitted, now)),
    [submitted, now],
  );
  const { rows, status, retry, refresh } = useAdminList<Place>(load, submitted);
  const [pending, setPending] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Place | null>(null);

  const run = (place: Place, notice: string, work: () => Promise<unknown>) => {
    if (pending !== null) return;
    setPending(place.id);
    work().then(
      () => {
        setPending(null);
        onNotice(notice);
        refresh();
      },
      () => {
        setPending(null);
        onNotice(SEARCH_FAILED_NOTICE);
      },
    );
  };

  const state = AdminListState({ status, onRetry: retry, columns: COLUMNS });

  return (
    <div>
      <form
        className="flex items-end gap-2 pb-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <TextField
          className="w-80"
          label="상호로 찾기"
          placeholder="예: 나라수산"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          autoComplete="off"
        />
        <Button variant="outline" size="md" type="submit">
          검색
        </Button>
      </form>

      {submitted === "" ? (
        <AdminEmpty title="상호로 검색해보세요" />
      ) : (
        (state ??
          (rows.length === 0 ? (
            <AdminEmpty title="찾는 가게가 없어요" />
          ) : (
            <>
              <AdminCount>{rows.length}곳 찾았어요</AdminCount>
              <AdminTable label="검색 결과" columns={COLUMNS}>
              {rows.map((place) => {
                const hidden = place.hiddenAt !== undefined;
                return (
                  <AdminRow key={place.id}>
                    <AdminCell className="text-body-m-medium text-fg">{place.name}</AdminCell>
                    <AdminCell className="text-fg-secondary">{place.gu}</AdminCell>
                    <AdminCell>
                      <AdminStatus
                        label={hidden ? (place.removedByOwner === true ? "내림(사장님)" : "숨김") : "정상"}
                        tone={hidden ? "active" : "subtle"}
                      />
                    </AdminCell>
                    <AdminCell align="right">
                      {place.createdAt === undefined ? (
                        <span className="text-fg-tertiary">시드</span>
                      ) : (
                        <AdminWhen
                          at={place.createdAt}
                          relative={relativeCheckAgo(place.createdAt, now)}
                        />
                      )}
                    </AdminCell>
                    <AdminCell align="right">
                      <AdminActions>
                        <a
                          href={`/place/${place.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="press inline-flex h-8 items-center rounded-8 border border-line px-3 text-caption-l-medium text-fg-secondary"
                        >
                          가게 열기 ↗
                        </a>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pending === place.id}
                          onClick={() => {
                            run(
                              place,
                              hidden ? SEARCH_RESTORED_NOTICE : SEARCH_HIDDEN_NOTICE,
                              () => setPlaceHidden(place.id, !hidden, now),
                            );
                          }}
                        >
                          {hidden ? "복구" : "숨김"}
                        </Button>
                        {!hidden && (
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={pending === place.id}
                            onClick={() => {
                              setRemoving(place);
                            }}
                          >
                            삭제
                          </Button>
                        )}
                      </AdminActions>
                    </AdminCell>
                  </AdminRow>
                );
                })}
              </AdminTable>
            </>
          )))
      )}

      {removing && (
        <DeleteConfirm
          place={removing}
          onClose={() => {
            setRemoving(null);
          }}
          onConfirm={(place) => {
            setRemoving(null);
            // 관리자가 직접 내린 것은 **사장님 요청이 아니다** — byOwner를 붙이면 재제보 경고가
            // 엉뚱하게 뜬다(갭 스윕 2026-09-08). 사장님 요청은 신고·요청 탭에서 처리한다
            run(place, SEARCH_DELETED_NOTICE, () => deletePlace(place.id, now, false));
          }}
        />
      )}
    </div>
  );
}

/**
 * 삭제 확인 — 관리자 화면에서 **유일한 확인 모달**이다. 되돌리기·숨김은 대칭이라 확인이 없지만
 * 삭제는 사장님 요청 기록(`removedByOwner`)이 붙는 처리라 한 번 묻는다(탈퇴 확인과 같은 문법).
 */
function DeleteConfirm({
  place,
  onClose,
  onConfirm,
}: {
  place: Place;
  onClose: () => void;
  onConfirm: (place: Place) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  return (
    <ModalSheet label={`${place.name} 삭제 확인`} onClose={onClose}>
      <div className="px-5 pt-6">
        <h2 className="text-title-s-semibold text-fg">{place.name}을(를) 내릴까요?</h2>
        <p className="mt-1 text-body-m-regular text-fg-secondary">
          지도에서 사라지지만 기록은 남아요. 언제든 이 탭에서 복구할 수 있어요.
        </p>
        <Button
          variant="danger"
          size="xl"
          className="mt-5 w-full"
          onClick={() => {
            onConfirm(place);
          }}
        >
          내리기
        </Button>
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
