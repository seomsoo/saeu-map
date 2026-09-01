import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "새우맵",
  description: "서울 새우구이 지도",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
