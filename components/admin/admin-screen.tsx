"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { SessionProvider, useSession } from "@/components/auth/session-provider";
import { NotFoundView } from "@/components/ui/not-found-view";
import { Segmented, type SegmentOption } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { Toast } from "@/components/ui/toast";
import { getAdminStats } from "@/lib/data";
import type { AdminStats } from "@/lib/types";
import { EditsTab } from "./edits-tab";
import { PendingTab } from "./pending-tab";
import { ReportsTab } from "./reports-tab";
import { SearchTab } from "./search-tab";

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
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const admin = session?.isAdmin === true;

  /** 토스트 한 줄 — 지도 화면과 같은 계약(부모가 타이머를 갖는다) */
  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => {
      setNotice(null);
    }, 2400);
  }, []);
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

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
        {/* 탭은 **내용 폭**이고 왼쪽에 붙는다 — 전폭으로 늘리면 1440에서 탭 하나가 230px가 되어
            제목처럼 읽힌다(운영 도구의 탭은 목록의 머리지 헤드라인이 아니다).
            좁은 화면에서는 그대로 가로로 넘어간다(줄바꿈되면 배지가 라벨 아래로 떨어진다) */}
        <div className="no-scrollbar -mx-6 overflow-x-auto px-6">
          <Segmented
            label="관리 탭"
            value={tab}
            options={options}
            onChange={setTab}
            className="w-max"
          />
        </div>
        <div className="pt-4">
          {tab === "pending" && <PendingTab now={now} onNotice={showNotice} />}
          {tab === "reports" && <ReportsTab now={now} onNotice={showNotice} />}
          {tab === "edits" && <EditsTab now={now} onNotice={showNotice} />}
          {tab === "search" && <SearchTab now={now} onNotice={showNotice} />}
          {tab === "stats" && <AdminTabPlaceholder label="통계" />}
        </div>
      </div>

      {/* 화면 아래 가운데 — 표 위에 겹치지 않게 고정 */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-6">
        <Toast message={notice} />
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
