"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChipButton } from "@/components/ui/chip";
import {
  ADMIN_PAGE_SIZE,
  REPORT_ATTENTION_COUNT,
  deletePlace,
  deletePlacePhoto,
  getPlacesForAdmin,
  getReports,
  resolveReport,
  setPlaceHidden,
} from "@/lib/data";
import { copyText } from "@/lib/share";
import { relativeCheckAgo } from "@/lib/time";
import type { Report, ReportKind } from "@/lib/types";
import {
  AdminActions,
  AdminCell,
  AdminCount,
  AdminEmpty,
  AdminListState,
  AdminRow,
  AdminMore,
  AdminPeriodChips,
  AdminStatus,
  AdminTable,
  AdminWhen,
  type AdminPeriod,
} from "./admin-table";
import { useAdminList } from "./use-admin-list";

export const HIDDEN_NOTICE = "숨겼어요";
export const RESTORED_NOTICE = "복구했어요";
export const RESOLVED_NOTICE = "처리했어요";
export const DISMISSED_NOTICE = "무시했어요";
export const CONTACT_COPIED_NOTICE = "연락처를 복사했어요";
export const PHOTO_DELETED_NOTICE = "사진을 내렸어요";
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
  // **기본은 전체다**: 열린 신고를 기간으로 가리면 오래된 숙제가 조용히 사라진다(이력 탭과 반대다)
  const [period, setPeriod] = useState<AdminPeriod>(null);
  const [limit, setLimit] = useState(ADMIN_PAGE_SIZE);
  const load = useCallback(async () => {
    const [rows, places] = await Promise.all([
      getReports({ status: "open", now, sinceDays: period, limit }),
      getPlacesForAdmin(now),
    ]);
    return rows.map((r) => ({ report: r, place: places.find((p) => p.id === r.placeId) }));
  }, [now, period, limit]);
  const { rows, status, retry, refresh } = useAdminList(load, `${String(period)}-${String(limit)}`);
  const [pending, setPending] = useState<string | null>(null);

  const shown = useMemo(
    () => (kind === "all" ? rows : rows.filter((r) => r.report.kind === kind)),
    [rows, kind],
  );
  /**
   * 가게별로 열려 있는 **가게 신고** 수. 자동 숨김을 걷어낸 대신 약속한 표시다(spec 5) — 3건이 넘으면
   * 운영자가 알아볼 수 있어야 하고, 그러려면 행을 손으로 세게 두면 안 된다.
   * 게이트를 지난 이 목록에서 센다(게이트 없는 집계 함수를 따로 열지 않는다).
   */
  const reportedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { report } of rows) {
      if (report.kind !== "place_report") continue;
      counts.set(report.placeId, (counts.get(report.placeId) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

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

  const state = AdminListState({ status, onRetry: retry, columns: COLUMNS });

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
      <AdminPeriodChips value={period} onChange={setPeriod} />

      {state ??
        (shown.length === 0 ? (
          <AdminEmpty title="들어온 신고가 없어요" />
        ) : (
          <>
            <AdminCount>처리할 것 {shown.length}건</AdminCount>
            <AdminTable label="신고·요청" columns={COLUMNS}>
            {shown.map(({ report, place }) => {
              const busy = pending === report.id;
              const hidden = place !== undefined && place.hiddenAt !== undefined;
              return (
                <AdminRow key={report.id}>
                  <AdminCell>
                    <AdminStatus
                      label={KIND_LABEL[report.kind]}
                      tone={report.kind === "place_report" ? "active" : "muted"}
                    />
                  </AdminCell>
                  <AdminCell className="text-body-m-medium text-fg">
                    {place?.name ?? "없는 가게"}
                    {hidden && <span className="ml-1.5 text-caption-l-regular text-brand-fg">숨김</span>}
                    {!hidden && (reportedCounts.get(report.placeId) ?? 0) >= REPORT_ATTENTION_COUNT && (
                      <span className="ml-1.5 rounded-max bg-brand-tint px-1.5 text-caption-l-medium text-brand-fg tabular-nums">
                        신고 {reportedCounts.get(report.placeId)}건
                      </span>
                    )}
                  </AdminCell>
                  <AdminCell className="text-fg-secondary">{bodyOf(report)}</AdminCell>
                  <AdminCell align="right">
                    <AdminWhen at={report.at} relative={relativeCheckAgo(report.at, now)} />
                  </AdminCell>
                  <AdminCell align="right">
                    <AdminActions>
                      {/* 어느 종류든 그 가게를 바로 열어 볼 수 있어야 판단이 된다 (design 화면 10-2) */}
                      {place !== undefined && (
                        <a
                          href={`/place/${place.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="press inline-flex h-8 items-center rounded-8 border border-line px-3 text-caption-l-medium text-fg-secondary"
                        >
                          가게 열기 ↗
                        </a>
                      )}
                      {report.kind === "photo_report" && place !== undefined && report.photoId !== undefined && (
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            run(report.id, PHOTO_DELETED_NOTICE, async () => {
                              await deletePlacePhoto(place.id, report.photoId ?? "");
                              await resolveReport(report.id, "done");
                            });
                          }}
                        >
                          사진 내리기
                        </Button>
                      )}
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
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          run(report.id, RESOLVED_NOTICE, async () => {
                            /*
                             * 사장님의 **게재 삭제** 요청은 상태만 닫으면 가게가 그대로 남는다 —
                             * `removedByOwner`가 영영 안 찍혀 재제보 경고(spec 5)가 죽는다.
                             * 내리고 나서 닫는다 (Codex PR #12).
                             */
                            if (report.kind === "owner_request" && report.ownerKind === "remove" && place) {
                              await deletePlace(place.id, now, true);
                            }
                            await resolveReport(report.id, "done");
                          });
                        }}
                      >
                        {busy ? "처리 중…" : report.ownerKind === "remove" ? "내리고 처리" : "처리함"}
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
                    </AdminActions>
                  </AdminCell>
                </AdminRow>
              );
            })}
            </AdminTable>
            <AdminMore
              shown={rows.length}
              limit={limit}
              onMore={() => {
                setLimit((n) => n + ADMIN_PAGE_SIZE);
              }}
            />
          </>
        ))}
    </div>
  );
}
