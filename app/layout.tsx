import type { Metadata, Viewport } from "next";
import { env } from "@/lib/env";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/seo";
import "./globals.css";

/** 사이트 공통 메타 (spec 4.6). 라우트별 제목은 "%s | 새우맵", OG 이미지는 각 세그먼트의 opengraph-image.tsx가 붙인다 */
export const metadata: Metadata = {
  metadataBase: siteUrl(env.SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: { siteName: SITE_NAME, type: "website", locale: "ko_KR" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // env(safe-area-inset-*)는 viewport-fit: cover 없이는 항상 0을 반환한다 — globals.css의
  // --spacing-safe-* 토큰과 pb-safe-bottom-or-3/pt-safe-top-or-3 유틸이 전부 12px 폴백으로 죽어 있었다.
  // cover를 켜면 지도(absolute inset-0)가 상태바·홈 인디케이터 뒤까지 그려지고, 콘텐츠는 위 토큰들이 되민다.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="antialiased">
      <body className="font-sans">
        {/* dynamic subset: 화면에 쓰인 유니코드 범위의 조각만 다운로드 (전체 2MB → 방문당 ~100KB).
            번들러로 임포트하면 92개 woff2가 빌드에 섞이므로 런타임 링크가 맞다. */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link
          rel="stylesheet"
          precedence="default"
          href="/fonts/pretendard/pretendardvariable-dynamic-subset.css"
        />
        {children}
      </body>
    </html>
  );
}
