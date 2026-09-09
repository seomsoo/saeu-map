"use client";

import { useSyncExternalStore } from "react";

/**
 * 이 세션에서 테스트를 **직접 풀었는지**. 결과 화면이 두 사람을 가르는 데 쓴다:
 * 방금 푼 사람에게 "나도 해보기"는 말이 안 되고, 공유 링크로 온 사람에게는 그게 유일한 입구다.
 *
 * 저장소를 쓰지 않는다(규칙 4) — **모듈 메모리**다. 응시자는 `router.push`로 오므로 같은 JS 인스턴스가
 * 살아 있고, 공유 링크·새로고침·새 탭은 새 인스턴스라 false로 시작한다. 그거면 충분하다.
 */
let finished = false;

export function markTestFinished(): void {
  finished = true;
}

/** 서버 스냅샷은 false(서버는 모른다) — 하이드레이션 뒤 응시자에게만 true가 된다. `useMediaQuery`와 같은 문법. */
export function useTookTest(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => finished,
    () => false,
  );
}
