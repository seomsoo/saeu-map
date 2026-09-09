"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** 토스트가 떠 있는 시간 — 지도·관리자 화면과 같은 값 */
const NOTICE_MS = 2400;

/**
 * 토스트 한 줄의 표시·타이머 (`Toast`는 그리기만 한다). 화면마다 같은 코드를 쓰던 것을
 * 네 번째 호출자에서 뽑았다 — 언마운트 때 타이머를 반드시 지운다.
 */
export function useNotice(): {
  notice: string | null;
  showNotice: (message: string) => void;
} {
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setNotice(null);
    }, NOTICE_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { notice, showNotice };
}
