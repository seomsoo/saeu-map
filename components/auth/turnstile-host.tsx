"use client";

import Script from "next/script";
import { TURNSTILE_HOST_ID, TURNSTILE_SCRIPT } from "@/lib/turnstile-client";

/**
 * Turnstile 스크립트 + 위젯 자리. 위젯은 보통 보이지 않고(interaction-only) 사람 확인이 필요할 때만
 * 화면 아래 가운데에 나타난다 — 토스트와 같은 자리, 시트·모달 위(z-30).
 * 스크립트는 첫 쓰기 전에만 있으면 되므로 afterInteractive(LCP 뒤).
 */
export function TurnstileHost() {
  return (
    <>
      <Script src={TURNSTILE_SCRIPT} strategy="afterInteractive" />
      <div
        id={TURNSTILE_HOST_ID}
        className="pointer-events-none fixed inset-x-0 bottom-safe-bottom-or-3 z-30 flex justify-center [&>*]:pointer-events-auto"
      />
    </>
  );
}
