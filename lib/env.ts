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
    /**
     * GA4 측정 ID (`G-XXXXXXX`). **비우면 스크립트를 아예 안 붙인다** — dev·프리뷰에서 수치가 섞이지 않게,
     * 그리고 런칭 전까지는 아무것도 수집하지 않게. 공개 값이라 NEXT_PUBLIC_ 허용 목록에 있다(규칙 7).
     */
    NEXT_PUBLIC_GA_ID: z
      .string()
      .regex(/^G-[A-Z0-9]+$/)
      .optional(),
  },
  runtimeEnv: {
    SITE_URL: process.env["SITE_URL"],
    NEXT_PUBLIC_NCP_CLIENT_ID: process.env["NEXT_PUBLIC_NCP_CLIENT_ID"],
    NEXT_PUBLIC_GA_ID: process.env["NEXT_PUBLIC_GA_ID"],
  },
  // `.env.example`의 `SITE_URL=`(빈 값)을 그대로 두면 ""가 들어와 z.url()이 거부하고 앱이 안 뜬다 — 빈 문자열은 없는 것으로 (Codex PR #9 P1)
  emptyStringAsUndefined: true,
});
