"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { getPlaceEdits, getPlaces, revertPlaceEdit } from "@/lib/data";
import { relativeCheckAgo } from "@/lib/time";
import type { Place, PlaceEdit } from "@/lib/types";
import { AdminCell, AdminEmpty, AdminListState, AdminRow, AdminTable } from "./admin-table";
import { FIELD_LABEL, actorText, editSummary } from "./edit-summary";
import { useAdminList } from "./use-admin-list";

export const REVERTED_NOTICE = "되돌렸어요";
export const REVERT_FAILED_NOTICE = "되돌리지 못했어요";

const COLUMNS = [
  { key: "place", label: "가게" },
  { key: "field", label: "무엇" },
  { key: "diff", label: "이전 → 지금", className: "w-1/2" },
  { key: "actor", label: "누가" },
  { key: "at", label: "언제", align: "right" as const },
  { key: "actions", label: "", align: "right" as const },
];

/**
 * 수정 이력 탭 (design 화면 10-3) — **운영자가 가장 자주 보는 탭**. 값이 이미 바뀐 뒤라
 * "무엇이 무엇으로 바뀌었나"가 한 줄에 보여야 판단이 된다.
 * **되돌리기는 확인 없이 즉시** — 파괴적이지 않고, 되돌린 것도 이력에 남아 다시 되돌릴 수 있다(대칭).
 */
export function EditsTab({ now, onNotice }: { now: string; onNotice: (m: string) => void }) {
  const load = useCallback(async () => {
    const [edits, places] = await Promise.all([getPlaceEdits(), getPlaces({}, now)]);
    return edits.map((edit) => ({ edit, place: places.find((p) => p.id === edit.placeId) }));
  }, [now]);
  const { rows, status, retry, refresh } = useAdminList(load);
  const [pending, setPending] = useState<string | null>(null);

  const revert = (edit: PlaceEdit) => {
    if (pending !== null) return;
    setPending(edit.id);
    revertPlaceEdit(edit.id, now).then(
      () => {
        setPending(null);
        onNotice(REVERTED_NOTICE);
        // 되돌린 것도 이력이라 목록 맨 위에 새 줄이 생긴다 — 다시 읽어야 그게 보인다
        refresh();
      },
      () => {
        setPending(null);
        onNotice(REVERT_FAILED_NOTICE);
      },
    );
  };

  const state = AdminListState({ status, onRetry: retry });
  if (state !== null) return state;
  if (rows.length === 0) return <AdminEmpty title="아직 고쳐진 곳이 없어요" />;

  return (
    <AdminTable label="수정 이력" columns={COLUMNS}>
      {rows.map(({ edit, place }) => (
        <EditRow
          key={edit.id}
          edit={edit}
          place={place}
          now={now}
          pending={pending === edit.id}
          onRevert={revert}
        />
      ))}
    </AdminTable>
  );
}

function EditRow({
  edit,
  place,
  now,
  pending,
  onRevert,
}: {
  edit: PlaceEdit;
  place: Place | undefined;
  now: string;
  pending: boolean;
  onRevert: (edit: PlaceEdit) => void;
}) {
  const lines = editSummary(edit, place);
  return (
    <AdminRow>
      <AdminCell className="text-body-m-medium text-fg">{place?.name ?? "숨겨진 가게"}</AdminCell>
      <AdminCell className="text-fg-secondary">{FIELD_LABEL[edit.field]}</AdminCell>
      <AdminCell className="py-2 text-fg-secondary">
        {/* 메뉴는 줄 단위로 여러 줄이 나온다 — 한 줄로 이으면 무엇이 바뀌었는지 안 읽힌다 */}
        <ul className="space-y-0.5">
          {lines.map((line) => (
            <li key={line} className="tabular-nums">
              {line}
            </li>
          ))}
        </ul>
      </AdminCell>
      <AdminCell className="text-fg-tertiary">{actorText(edit)}</AdminCell>
      <AdminCell align="right" className="text-fg-tertiary tabular-nums">
        {relativeCheckAgo(edit.at, now)}
      </AdminCell>
      <AdminCell align="right">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => {
            onRevert(edit);
          }}
        >
          {pending ? "되돌리는 중…" : "되돌리기"}
        </Button>
      </AdminCell>
    </AdminRow>
  );
}
