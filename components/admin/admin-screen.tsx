"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SessionProvider, useSession } from "@/components/auth/session-provider";
import { NotFoundView } from "@/components/ui/not-found-view";
import { Segmented, type SegmentOption } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdminStats } from "@/lib/data";
import type { AdminStats } from "@/lib/types";

export type AdminTab = "pending" | "reports" | "edits" | "search" | "stats";

const TABS: { key: AdminTab; label: string }[] = [
  { key: "pending", label: "사후 확인" },
  { key: "reports", label: "신고·요청" },
  { key: "edits", label: "수정 이력" },
  { key: "search", label: "검색" },
  { key: "stats", label: "통계" },
];

/**
 * /admin 그릇 (design 화면 10) — 지도가 없다. 흰 배경 + 최대 폭 1200 가운데.
 * 탭 상태는 URL에 두지 않는다: 공유할 화면이 아니고, 주소로 관리자 화면의 구조를 알릴 이유도 없다.
 */
export function AdminScreen({ now }: { now: string }) {
  return (
    <SessionProvider>
      <AdminShell now={now} />
    </SessionProvider>
  );
}

function AdminShell({ now }: { now: string }) {
  const { session } = useSession();
  const [tab, setTab] = useState<AdminTab>("pending");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const admin = session?.isAdmin === true;

  // 탭 배지(숙제 수)는 화면을 열 때 한 번 읽는다 — 각 탭이 자기 목록을 따로 읽는다
  useEffect(() => {
    if (!admin) return;
    let alive = true;
    void getAdminStats(now).then(
      (s) => {
        if (alive) setStats(s);
      },
      () => {
        // 배지는 없으면 안 그리면 그만이다 — 탭 본문의 에러 상태가 진짜 신호다
      },
    );
    return () => {
      alive = false;
    };
  }, [admin, now]);

  // 세션을 아직 모르는 동안은 아무것도 알리지 않는다 (관리자 화면의 존재를 깜빡이지 않게)
  if (session === null) return <div className="h-dvh bg-bg" aria-busy="true" />;
  // spec 4.5 "비관리자는 404 위장" — 로그인 유도도, "권한 없음"도 아니다
  if (!admin)
    return (
      <NotFoundView title="페이지를 찾을 수 없어요" description="주소가 잘못됐거나 없어진 페이지예요" />
    );

  const options: SegmentOption<AdminTab>[] = TABS.map((t) => ({
    ...t,
    badge:
      t.key === "reports" ? stats?.openReports : t.key === "pending" ? stats?.unverified : undefined,
  }));

  return (
    <main className="min-h-dvh bg-bg text-fg">
      <header className="flex h-11 items-center justify-between border-b border-line-hairline px-6">
        <h1 className="text-body-l-semibold">새우맵 관리</h1>
        <div className="flex items-center gap-3">
          <span className="text-caption-l-regular text-fg-tertiary">
            {session.nickname ?? "익명"}
          </span>
          <Link href="/" className="press text-caption-l-medium text-fg-secondary hit-44">
            사용자 화면으로
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-300 px-6 py-4">
        <Segmented label="관리 탭" value={tab} options={options} onChange={setTab} />
        <div className="pt-4">
          {tab === "pending" && <AdminTabPlaceholder label="사후 확인" />}
          {tab === "reports" && <AdminTabPlaceholder label="신고·요청" />}
          {tab === "edits" && <AdminTabPlaceholder label="수정 이력" />}
          {tab === "search" && <AdminTabPlaceholder label="검색" />}
          {tab === "stats" && <AdminTabPlaceholder label="통계" />}
        </div>
      </div>
    </main>
  );
}

/** 탭 본문이 붙기 전 자리 — 표 헤더가 남아 화면이 뛰지 않는 로딩 문법을 미리 세워 둔다 */
function AdminTabPlaceholder({ label }: { label: string }) {
  return (
    <div aria-label={label} className="space-y-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-13" />
      ))}
    </div>
  );
}
