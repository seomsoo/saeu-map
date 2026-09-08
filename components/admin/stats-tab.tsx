"use client";

import { useCallback } from "react";
import { getAdminStats } from "@/lib/data";
import type { AdminStats } from "@/lib/types";
import {
  AdminCell,
  AdminCount,
  AdminListState,
  AdminRow,
  AdminStat,
  AdminTable,
} from "./admin-table";
import { useAdminList } from "./use-admin-list";

const DAILY_COLUMNS = [
  { key: "date", label: "날짜" },
  { key: "reports", label: "제보", align: "right" as const },
  { key: "checkins", label: "확인", align: "right" as const },
  { key: "reviews", label: "리뷰", align: "right" as const },
  { key: "edits", label: "수정", align: "right" as const },
];

const TOP_COLUMNS = [
  { key: "name", label: "가게" },
  { key: "count", label: "확인", align: "right" as const },
];

/**
 * 통계 탭 (design 화면 10-5) — **우리 DB로 셀 수 있는 것만**. 방문자·페이지뷰·유입은 여기 없다:
 * 그건 Cloudflare Web Analytics가, 퍼널은 GA4가 본다(spec 6).
 * 목 단계에선 숫자가 가짜지만 집계 함수와 배치는 Phase 6에서 그대로 산다.
 */
export function StatsTab({ now }: { now: string }) {
  // 통계는 목록이 아니라 한 덩어리다 — 같은 4상태를 쓰려고 한 칸짜리 배열로 싣는다
  const load = useCallback(async () => [await getAdminStats(now)], [now]);
  const { rows, status, retry } = useAdminList<AdminStats>(load);

  const state = AdminListState({ status, onRetry: retry });
  if (state !== null) return state;
  const stats = rows[0];
  if (!stats) return null;

  const week = stats.daily.slice(-7);
  const sum = (pick: (d: AdminStats["daily"][number]) => number) =>
    week.reduce((acc, d) => acc + pick(d), 0);

  return (
    <div className="space-y-6">
      {/* 오늘만 두면 많은지 적은지 모른다 — 최근 7일을 같이 놓는다 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminStat label="오늘 제보" value={stats.today.reports} sub={`7일 ${sum((d) => d.reports)}`} />
        <AdminStat label="오늘 확인" value={stats.today.checkins} sub={`7일 ${sum((d) => d.checkins)}`} />
        <AdminStat label="오늘 리뷰" value={stats.today.reviews} sub={`7일 ${sum((d) => d.reviews)}`} />
        <AdminStat label="오늘 수정" value={stats.today.edits} sub={`7일 ${sum((d) => d.edits)}`} />
      </div>

      <div>
        <AdminCount>최근 14일</AdminCount>
        <AdminTable label="일별 참여" columns={DAILY_COLUMNS}>
          {[...stats.daily].reverse().map((d) => (
            <AdminRow key={d.date}>
              <AdminCell className="text-fg-secondary tabular-nums">{d.date}</AdminCell>
              <AdminCell align="right" className="tabular-nums">{d.reports}</AdminCell>
              <AdminCell align="right" className="tabular-nums">{d.checkins}</AdminCell>
              <AdminCell align="right" className="tabular-nums">{d.reviews}</AdminCell>
              <AdminCell align="right" className="tabular-nums">{d.edits}</AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
      </div>

      <div>
        <AdminCount>참여한 사람</AdminCount>
        <div className="grid grid-cols-2 gap-3 lg:w-1/2">
          <AdminStat label="익명" value={stats.participants.anonymous} />
          <AdminStat label="카카오" value={stats.participants.kakao} />
        </div>
      </div>

      <div>
        <AdminCount>확인이 많은 가게</AdminCount>
        <AdminTable label="상위 가게" columns={TOP_COLUMNS}>
          {stats.topPlaces.map((p) => (
            <AdminRow key={p.placeId}>
              <AdminCell className="text-body-m-medium text-fg">{p.name}</AdminCell>
              <AdminCell align="right" className="tabular-nums">{p.checkCount}</AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
      </div>
    </div>
  );
}
