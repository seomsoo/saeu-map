import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    /**
     * 절대 URL이 필요한 곳(metadataBase·sitemap·robots)만. 없으면 lib/seo.ts가 프로덕션 워커 URL로 폴백. NEXT_PUBLIC_ 아님(규칙 7).
     * 런타임 값은 OpenNext가 Cloudflare 바인딩(wrangler `vars`)에서 채운다 — 셸 env는 빌드 때만 보인다(security-reviewer 2026-09-07).
     * http(s)만: 배포자 값이지만 `javascript:` 같은 스킴이 메타에 그대로 들어가는 길을 닫는다.
     */
    SITE_URL: z.url({ protocol: /^https?$/ }).optional(),
  },
  client: {
    NEXT_PUBLIC_NCP_CLIENT_ID: z.string().min(1),
  },
  runtimeEnv: {
    SITE_URL: process.env["SITE_URL"],
    NEXT_PUBLIC_NCP_CLIENT_ID: process.env["NEXT_PUBLIC_NCP_CLIENT_ID"],
  },
});
