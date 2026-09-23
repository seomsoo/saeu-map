import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // 빌드 시각 — 핀 공유 카드는 빌드 때만 만들어지므로(Workers Free CPU 10ms) 그 뒤 생긴 핀은 루트 카드로 보낸다(lib/seo.ts placeOgImagePath).
  // NEXT_PUBLIC_이 아니라 규칙 7 목록 밖이지만 값은 시각 하나라 비밀이 아니다(decisions 2026-09-16)
  env: { BUILD_AT: new Date().toISOString() },
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
 * Sentry(커밋 9, decisions 2026-09-16): 빌드 래퍼는 SDK 주입 + 소스맵 업로드. 원격 측정은 끈다. 터널 라우트는 두지 않는다(워커 요청 수 = 비용, 2026-09-01).
 * 트리셰이킹 옵션(disableLogger 등)은 webpack 전용이라 Turbopack 빌드에선 의미가 없다(10.74 경고) — 두지 않는다.
 *
 * 소스맵(Phase 7): **업로드 토큰이 있을 때만** 켠다 — main의 deploy 잡뿐이다(GH secret `SENTRY_UPLOAD_TOKEN`, runbook 2-5). 로컬·PR 빌드는
 * 지금처럼 맵을 만들지 않는다. `.env.local`의 `SENTRY_AUTH_TOKEN`은 읽기 전용 점검용이라 이름을 달리했다(그 토큰으로는 업로드가 거부된다).
 * Turbopack은 빌드가 끝난 뒤 한 번에 올린다(@sentry/nextjs 10.13+ · next 15.4.1+). 올린 뒤 .map은 지운다 — 워커 에셋으로 공개되지 않게.
 * 브라우저 스택만 풀린다: 서버 번들은 OpenNext가 다시 묶어(handler.mjs) 여기서 올린 맵과 맞지 않는다(이슈는 지금까지 전부 브라우저였다).
 */
const sentryUploadToken = process.env["SENTRY_UPLOAD_TOKEN"] === "" ? undefined : process.env["SENTRY_UPLOAD_TOKEN"];

export default withSentryConfig(nextConfig, {
  org: "syndicate-9a",
  project: "saeu-map",
  ...(sentryUploadToken === undefined ? {} : { authToken: sentryUploadToken }),
  silent: sentryUploadToken === undefined, // 올릴 때는 결과가 CI 로그에 보여야 한다
  telemetry: false,
  sourcemaps: { disable: sentryUploadToken === undefined, deleteSourcemapsAfterUpload: true },
});

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
