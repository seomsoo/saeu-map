"use client";

import { useCallback, useEffect, useRef } from "react";
import { isOverlayHistoryState } from "@/lib/history-state";

/**
 * 오버레이(로그인 시트·리뷰 폼)의 뒤로가기 한 단계. 여는 쪽이 이벤트 핸들러에서 `pushOverlayHistoryEntry()`로
 * 엔트리를 쌓고, 이 훅은 열려 있는 동안 popstate를 듣다가 `onPop`(언마운트·정리)을 부른다.
 * 돌려주는 `close()`는 **닫는 경로를 하나로** 만든다: 우리 엔트리가 있으면 `history.back()`으로 popstate를
 * 타게 하고(정리는 그때), 없으면 바로 `onPop`. 닫은 직후 호출자가 다른 엔트리를 쌓아도(로그인 뒤 리뷰 폼)
 * 늦게 도착한 back()이 그것을 삼키지 않는다 — 정리가 끝난 뒤에야 호출자에게 결과가 간다.
 */
export function useOverlayHistory(active: boolean, onPop: () => void): () => void {
  const onPopRef = useRef(onPop);
  useEffect(() => {
    onPopRef.current = onPop;
  });

  useEffect(() => {
    if (!active) return;
    const handle = () => {
      onPopRef.current();
    };
    window.addEventListener("popstate", handle);
    return () => {
      window.removeEventListener("popstate", handle);
    };
  }, [active]);

  return useCallback(() => {
    if (isOverlayHistoryState(window.history.state)) window.history.back();
    else onPopRef.current();
  }, []);
}
