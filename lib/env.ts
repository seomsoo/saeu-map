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
    /**
     * Supabase — 셋 다 서버 전용. 브라우저에 supabase-js가 없어 publishable도 NEXT_PUBLIC_이 아니다(규칙 7, decisions 2026-09-10).
     * secret key는 RLS를 우회한다: 병합·탈퇴·임포트·크론만. 프리뷰 워커에는 주지 않는다(없으면 그 액션만 막힌다).
     */
    SUPABASE_URL: z.url({ protocol: /^https?$/ }),
    SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    SUPABASE_SECRET_KEY: z.string().min(1).optional(),
    /** Turnstile 서버 검증 키. 로컬·CI는 테스트 키(`1x…AA` 항상 통과 — runbook). */
    TURNSTILE_SECRET_KEY: z.string().min(1),
    /** 속도 제한용 IP 해시 salt — 아무 긴 문자열. 새면 교체만 하면 된다(해시는 24시간이면 쓸모를 다한다). */
    IP_HASH_SALT: z.string().min(16),
    /** 프리뷰 워커만 "1" — 모든 쓰기·로그인·익명 생성을 거부한다(prod DB를 보는 프리뷰, decisions 2026-09-10). */
    PREVIEW_READONLY: z.enum(["1"]).optional(),
    /** 디스코드 채널 웹훅(비밀) — 제보·신고·사장님 요청·신고 누적 알림. 없으면 알림만 건너뛴다(로컬·프리뷰). http는 로컬 가짜 수신기용. */
    DISCORD_WEBHOOK_URL: z.url({ protocol: /^https?$/ }).optional(),
  },
  client: {
    NEXT_PUBLIC_NCP_CLIENT_ID: z.string().min(1),
    /** Turnstile 위젯 site key — 공개값(위젯을 그리려면 브라우저가 안다). 콘솔에서 호스트명으로 묶는다(규칙 7 허용 목록). */
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
    /**
     * GA4 측정 ID (`G-XXXXXXX`). **비우면 스크립트를 아예 안 붙인다** — dev·프리뷰에서 수치가 섞이지 않게,
     * 그리고 런칭 전까지는 아무것도 수집하지 않게. 공개 값이라 NEXT_PUBLIC_ 허용 목록에 있다(규칙 7).
     */
    NEXT_PUBLIC_GA_ID: z
      .string()
      .regex(/^G-[A-Z0-9]+$/)
      .optional(),
    /** Sentry DSN — 공개값(에러를 보낼 주소, 규칙 7 허용 목록). **비우면 Sentry를 초기화하지 않는다**(로컬·DSN 전 프리뷰). 콘솔에서 Allowed Domains로 묶는다. */
    NEXT_PUBLIC_SENTRY_DSN: z.url({ protocol: /^https?$/ }).optional(),
  },
  runtimeEnv: {
    SITE_URL: process.env["SITE_URL"],
    SUPABASE_URL: process.env["SUPABASE_URL"],
    SUPABASE_PUBLISHABLE_KEY: process.env["SUPABASE_PUBLISHABLE_KEY"],
    SUPABASE_SECRET_KEY: process.env["SUPABASE_SECRET_KEY"],
    TURNSTILE_SECRET_KEY: process.env["TURNSTILE_SECRET_KEY"],
    IP_HASH_SALT: process.env["IP_HASH_SALT"],
    PREVIEW_READONLY: process.env["PREVIEW_READONLY"],
    DISCORD_WEBHOOK_URL: process.env["DISCORD_WEBHOOK_URL"],
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"],
    NEXT_PUBLIC_NCP_CLIENT_ID: process.env["NEXT_PUBLIC_NCP_CLIENT_ID"],
    NEXT_PUBLIC_GA_ID: process.env["NEXT_PUBLIC_GA_ID"],
    NEXT_PUBLIC_SENTRY_DSN: process.env["NEXT_PUBLIC_SENTRY_DSN"],
  },
  // `.env.example`의 `SITE_URL=`(빈 값)을 그대로 두면 ""가 들어와 z.url()이 거부하고 앱이 안 뜬다 — 빈 문자열은 없는 것으로 (Codex PR #9 P1)
  emptyStringAsUndefined: true,
});
