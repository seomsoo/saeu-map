import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

/**
 * Sentry(커밋 9, decisions 2026-09-16): 빌드 래퍼는 SDK 주입·트리셰이킹만. **소스맵 업로드는 아직 없다** — SENTRY_AUTH_TOKEN·org·project는
 * Phase 7 백로그(스택이 압축된 채 보이지만 이벤트는 온다). 원격 측정·빌드 로그는 끈다. 터널 라우트는 두지 않는다(워커 요청 수 = 비용, 2026-09-01).
 * 트리셰이킹 옵션(disableLogger 등)은 webpack 전용이라 Turbopack 빌드에선 의미가 없다(10.74 경고) — 두지 않는다.
 */
export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  sourcemaps: { disable: true },
});

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
