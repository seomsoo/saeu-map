"use client";

import { useEffect } from "react";

/** JS가 :root에 쓰고 .saeu-sheet가 읽는다. globals.css의 폴백(0px)과 이름이 같아야 한다. */
const KEYBOARD_INSET_VAR = "--kb";

/**
 * 가상 키보드가 먹은 높이를 `--kb`로 내보낸다. 시트가 레이아웃 뷰포트가 아니라 **보이는 영역** 바닥에 앉게 하는 값.
 *
 * iOS와 안드로이드가 같은 증상이다: 키보드가 떠도 레이아웃 뷰포트(`innerHeight`·`dvh`)는 안 줄고 visual viewport만 줄어든다.
 * 그래서 `position: fixed; bottom: 0`인 시트가 키보드 뒤에 남고, iOS가 포커스된 입력을 보이려고 visual viewport를
 * 스크롤하면 시트 위쪽 내용이 화면 밖으로 밀려난다(제보 1단계에서 CTA만 남던 문제 — decisions 2026-09-04).
 *
 * 뷰포트 meta의 `interactive-widget`은 쓰지 않는다: Chrome 108+·Firefox 132+ 전용이라 Safari에 없고(WebKit 259770),
 * 켜면 Chromium에서만 레이아웃 뷰포트가 줄어 `h-dvh`인 지도까지 리사이즈된다(제보 2단계에서 타이핑마다 지도가 튄다).
 * visualViewport 하나로 iOS·안드로이드를 같은 방식으로 덮는다.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return; // 구형 브라우저: 지금까지처럼 동작한다(키보드 보정 없음)

    const root = document.documentElement;
    const update = () => {
      // offsetTop을 빼는 이유: iOS는 키보드를 띄우며 visual viewport를 아래로 밀기도 한다.
      // 그 경우 남은 아래쪽 여백이 실제로 시트가 피해야 할 높이다.
      const inset = window.innerHeight - vv.height - vv.offsetTop;
      root.style.setProperty(KEYBOARD_INSET_VAR, `${String(Math.max(0, Math.round(inset)))}px`);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty(KEYBOARD_INSET_VAR);
    };
  }, []);
}
