/**
 * 브라우저 Sentry (Next 15.3+ 방식 — sentry.client.config.ts 대신 이 파일을 Next가 직접 싣는다).
 * **에러만** — 트레이싱·세션 리플레이는 끈다(무료 5k 이벤트/월, 비용 방어 2026-09-01). PII 기본 수집도 끈다.
 * DSN이 없으면(로컬·프리뷰) 초기화하지 않는다 — captureException은 no-op이 된다.
 */
import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";

if (env.NEXT_PUBLIC_SENTRY_DSN !== undefined) {
  Sentry.init({
    dsn: env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
