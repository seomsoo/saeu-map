"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

/**
 * GA4 (spec 6, 2026-09-08 채택). **측정 ID가 없으면 아무것도 붙이지 않는다** —
 * dev·프리뷰에서 수치가 섞이지 않고, 런칭 전까지는 수집이 0이다.
 *
 * `lazyOnload`인 이유: 우리 LCP 예산이 빡빡하다(error 12s 실측, decisions 2026-09-07).
 * 분석 스크립트는 첫 화면이 그려진 뒤에 와도 되는 종류라 브라우저가 한가할 때 받게 미룬다.
 *
 * Cloudflare Web Analytics와 **같이 쓴다**: CF는 방문자·유입(쿠키 없이), GA4는 퍼널
 * ("제보를 시작한 사람 중 몇 %가 끝냈나")을 본다 — CF로는 못 보는 값이다.
 *
 * **`/admin`에서는 붙이지 않는다**: 운영자의 관리 경로·체류가 Google로 나갈 이유가 없고,
 * 우리가 보려는 건 사용자 퍼널이지 우리 자신의 클릭이 아니다(security-reviewer 2026-09-08).
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string | undefined }) {
  const pathname = usePathname();
  if (measurementId === undefined || pathname.startsWith("/admin")) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="lazyOnload"
      />
      <Script id="ga4-init" strategy="lazyOnload">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${measurementId}');`}
      </Script>
    </>
  );
}
