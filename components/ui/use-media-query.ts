"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * 미디어 쿼리 구독. 서버 스냅샷은 false — 서버는 뷰포트를 모르므로 모바일 그릇으로 그리고,
 * 하이드레이션 뒤 데스크탑 전용 요소가 붙는다(그릇 자체는 CSS가 첫 페인트부터 맞게 놓는다).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => {
        mql.removeEventListener("change", onChange);
      };
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
