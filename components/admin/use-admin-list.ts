"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LoadStatus } from "@/components/activity/use-activity";

/**
 * 관리자 탭의 목록 하나 — 4상태(로딩·빈·에러·정상) + 재시도 + 액션 뒤 새로고침.
 * 네 탭이 같은 모양이라 여기 모았다. 늦게 온 응답이 최신 목록을 덮지 않게 **요청 순번(seq)**으로 거른다
 * (CLAUDE.md 비동기 가드 — alive ref는 StrictMode 이중 effect에서 돌아오지 않아 응답을 잃는다).
 */
export function useAdminList<T>(
  load: () => Promise<T[]>,
  /**
   * 이게 바뀌면 다시 읽는다(기간 칩·상한·검색어). 별도 effect로 `refresh()`를 부르면
   * **마운트 때 두 번 읽는다** — 그 자리에서 잡았다(2026-09-08).
   */
  key = "",
): {
  rows: T[];
  status: LoadStatus;
  retry: () => void;
  /** 액션이 끝난 뒤 목록을 다시 읽는다 — 스켈레톤을 다시 보이지 않고 조용히 갈아끼운다 */
  refresh: () => void;
  /** 낙관 갱신 — 서버 응답으로 한 행만 갈아끼울 때 */
  setRows: (next: T[]) => void;
} {
  const [rows, setRows] = useState<T[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const seq = useRef(0);
  /** 로더는 매 렌더 새 함수라 deps에 넣으면 무한 루프다 — ref로 최신 것만 들고 effect는 attempt로만 돈다 */
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    seq.current += 1;
    const mine = seq.current;
    // 재시도는 스켈레톤부터, 액션 뒤 새로고침(attempt 그대로)은 조용히
    loadRef.current().then(
      (next) => {
        if (mine !== seq.current) return;
        setRows(next);
        setStatus("ready");
      },
      () => {
        if (mine !== seq.current) return;
        setStatus("error");
      },
    );
  }, [attempt, key]);

  const retry = useCallback(() => {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }, []);
  const refresh = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  return { rows, status, retry, refresh, setRows };
}
