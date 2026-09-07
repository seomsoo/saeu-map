import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    /** 절대 URL이 필요한 곳(metadataBase·sitemap·robots)만. 없으면 lib/seo.ts가 프로덕션 워커 URL로 폴백. NEXT_PUBLIC_ 아님(규칙 7). */
    SITE_URL: z.url().optional(),
  },
  client: {
    NEXT_PUBLIC_NCP_CLIENT_ID: z.string().min(1),
  },
  runtimeEnv: {
    SITE_URL: process.env["SITE_URL"],
    NEXT_PUBLIC_NCP_CLIENT_ID: process.env["NEXT_PUBLIC_NCP_CLIENT_ID"],
  },
});
