"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChipButton } from "@/components/ui/chip";
import { getPlaces, getReports, resolveReport, setPlaceHidden } from "@/lib/data";
import { copyText } from "@/lib/share";
import { relativeCheckAgo } from "@/lib/time";
import type { Report, ReportKind } from "@/lib/types";
import { AdminCell, AdminEmpty, AdminListState, AdminRow, AdminTable } from "./admin-table";
import { useAdminList } from "./use-admin-list";

export const HIDDEN_NOTICE = "숨겼어요";
export const RESTORED_NOTICE = "복구했어요";
export const RESOLVED_NOTICE = "처리했어요";
export const DISMISSED_NOTICE = "무시했어요";
export const CONTACT_COPIED_NOTICE = "연락처를 복사했어요";
export const ACTION_FAILED_NOTICE = "처리하지 못했어요";

const KIND_LABEL: Record<ReportKind, string> = {
  place_report: "가게 신고",
  photo_report: "사진 신고",
  place_flag: "정보 수정 제안",
  owner_request: "사장님 요청",
};

/** 사유 코드 → 사람이 읽는 말. 사용자 화면의 시트 문구와 같은 말을 쓴다. */
const REASON_LABEL: Record<string, string> = {
  location: "위치가 달라요",
  menu: "메뉴·가격이 달라요",
  closed: "문 닫았어요",
  not_shrimp: "새우집이 아니에요",
  fake: "허위·광고성 등록",
  duplicate: "중복 등록이에요",
  inappropriate: "부적절한 사진",
  wrong_place: "다른 가게 사진",
  spam: "광고·도배",
  other: "기타",
};

const FILTERS: { key: ReportKind | "all"; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "place_report", label: "가게 신고" },
  { key: "photo_report", label: "사진 신고" },
  { key: "place_flag", label: "정보 수정 제안" },
  { key: "owner_request", label: "사장님 요청" },
];

const COLUMNS = [
  { key: "kind", label: "종류" },
  { key: "place", label: "가게" },
  { key: "body", label: "내용" },
  { key: "at", label: "접수", align: "right" as const },
  { key: "actions", label: "", align: "right" as const },
];

/** 한 줄로 읽히는 내용 — 사유 또는 사장님 요청의 종류·연락처. */
function bodyOf(report: Report): string {
  if (report.kind === "owner_request") {
    const kind = report.ownerKind === "remove" ? "게재 삭제" : "정보 수정";
    return [kind, report.contact, report.message].filter(Boolean).join(" · ");
  }
  const reason = report.reason ? (REASON_LABEL[report.reason] ?? report.reason) : "";
  return report.kind === "photo_report" && report.photoId ? `${reason} (${report.photoId})` : reason;
}

/**
 * 신고·요청 탭 (design 화면 10-2) — 사용자가 알려온 일감이 전부 모인다. 넷 다 "열림 → 처리함/무시함"으로
 * 흐름이 같아 한 탭이고, 종류 칩으로 거른다. **액션만 종류마다 다르다.**
 * 열린 것만 보여준다 — 처리한 것을 계속 쌓아 두면 숙제가 몇 개인지 안 보인다.
 */
export function ReportsTab({ now, onNotice }: { now: string; onNotice: (m: string) => void }) {
  const [kind, setKind] = useState<ReportKind | "all">("all");
  const load = useCallback(async () => {
    const [rows, places] = await Promise.all([getReports({ status: "open" }), getPlaces({}, now)]);
    return rows.map((r) => ({ report: r, place: places.find((p) => p.id === r.placeId) }));
  }, [now]);
  const { rows, status, retry, refresh } = useAdminList(load);
  const [pending, setPending] = useState<string | null>(null);

  const shown = useMemo(
    () => (kind === "all" ? rows : rows.filter((r) => r.report.kind === kind)),
    [rows, kind],
  );

  /** 액션 하나 — 끝나면 목록을 조용히 다시 읽는다(처리한 행은 열린 목록에서 빠진다) */
  const run = (id: string, notice: string, work: () => Promise<unknown>) => {
    if (pending !== null) return;
    setPending(id);
    work().then(
      () => {
        setPending(null);
        onNotice(notice);
        refresh();
      },
      () => {
        setPending(null);
        onNotice(ACTION_FAILED_NOTICE);
      },
    );
  };

  const state = AdminListState({ status, onRetry: retry });

  return (
    <div>
      <ul aria-label="종류" className="flex flex-wrap gap-1.5 pb-3">
        {FILTERS.map((f) => (
          <li key={f.key}>
            <ChipButton
              size="sm"
              pressed={kind === f.key}
              onClick={() => {
                setKind(f.key);
              }}
            >
              {f.label}
            </ChipButton>
          </li>
        ))}
      </ul>

      {state ??
        (shown.length === 0 ? (
          <AdminEmpty title="들어온 신고가 없어요" />
        ) : (
          <AdminTable label="신고·요청" columns={COLUMNS}>
            {shown.map(({ report, place }) => {
              const busy = pending === report.id;
              const hidden = place === undefined || place.hiddenAt !== undefined;
              return (
                <AdminRow key={report.id}>
                  <AdminCell className="text-fg-secondary">{KIND_LABEL[report.kind]}</AdminCell>
                  <AdminCell className="text-body-m-medium text-fg">
                    {place?.name ?? "숨겨진 가게"}
                  </AdminCell>
                  <AdminCell className="text-fg-secondary">{bodyOf(report)}</AdminCell>
                  <AdminCell align="right" className="text-fg-tertiary tabular-nums">
                    {relativeCheckAgo(report.at, now)}
                  </AdminCell>
                  <AdminCell align="right">
                    <span className="inline-flex gap-2">
                      {report.kind === "owner_request" && report.contact !== undefined && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            void copyText(report.contact ?? "").then((ok) => {
                              onNotice(ok ? CONTACT_COPIED_NOTICE : ACTION_FAILED_NOTICE);
                            });
                          }}
                        >
                          연락처 복사
                        </Button>
                      )}
                      {report.kind === "place_report" && place !== undefined && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            run(report.id, hidden ? RESTORED_NOTICE : HIDDEN_NOTICE, () =>
                              setPlaceHidden(place.id, !hidden, now),
                            );
                          }}
                        >
                          {hidden ? "복구" : "숨김"}
                        </Button>
                      )}
                      <Button
                        variant="brand"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          run(report.id, RESOLVED_NOTICE, () => resolveReport(report.id, "done"));
                        }}
                      >
                        {busy ? "처리 중…" : "처리함"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          run(report.id, DISMISSED_NOTICE, () =>
                            resolveReport(report.id, "dismissed"),
                          );
                        }}
                      >
                        무시
                      </Button>
                    </span>
                  </AdminCell>
                </AdminRow>
              );
            })}
          </AdminTable>
        ))}
    </div>
  );
}
