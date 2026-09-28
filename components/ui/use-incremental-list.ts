"use client";

import { useEffect, useState } from "react";

/**
 * 긴 목록을 처음 `step`장만 그리고, 끝의 감시 요소가 보이면 `step`장씩 더 그린다(plan perf-diet B2).
 * 지도 화면 시트는 뷰포트 안 가게 전부(첫 화면 281장, 서울 전체 줌이면 771장)를 한 번에 그렸는데 반쯤 열린 시트엔 2~3장만 보인다.
 * **`key`가 바뀔 때만** 처음부터 다시 센다 — 배열 identity가 아니다. 지도 훅의 목록은 찜 토글·지도 idle마다 내용이 같아도 새 배열이라
 * identity로 리셋하면 45번째 카드의 ♥를 누르는 순간 30장으로 잘려 그 카드가 사라진다(reviewer 2026-09-25 P2). 호출자가 id 순서 같은 "진짜 바뀜"을 키로 준다.
 * IntersectionObserver가 없으면(jsdom) 전부 그린다 — 지원 하한(iOS 16)엔 있다.
 * 감시 요소는 끝에서 `rootMargin`만큼 앞에서 발화하므로 보통 스크롤에선 빈 자리가 보이지 않는다.
 */
export function useIncrementalList<T>(
  items: readonly T[],
  /** 목록이 진짜 바뀌었는지의 키(예: id 순서 join). 같으면 한도를 유지한 채 새 배열의 값만 그린다 */
  key: string,
  step = 30,
): { visible: readonly T[]; done: boolean; sentinelRef: (node: Element | null) => void } {
  const [limit, setLimit] = useState(step);
  const [trackedKey, setTrackedKey] = useState(key);
  if (trackedKey !== key) {
    // props에서 파생한 상태를 렌더 중에 되돌린다(React 공식 패턴) — effect로 하면 한 프레임 동안 옛 한도로 새 목록을 그린다
    setTrackedKey(key);
    setLimit(step);
  }
  const [node, setNode] = useState<Element | null>(null);
  const supported = typeof IntersectionObserver !== "undefined";
  const done = !supported || limit >= items.length;

  useEffect(() => {
    if (!node || done) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLimit((n) => Math.min(n + step, items.length));
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => { observer.disconnect(); };
  }, [node, done, step, items.length]);

  return { visible: done ? items : items.slice(0, limit), done, sentinelRef: setNode };
}
