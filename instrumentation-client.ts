/**
 * 브라우저 Sentry (Next 15.3+ 방식 — sentry.client.config.ts 대신 이 파일을 Next가 직접 싣는다).
 * **에러만** — 트레이싱·세션 리플레이는 끈다(무료 5k 이벤트/월, 비용 방어 2026-09-01). PII 기본 수집도 끈다.
 * DSN이 없으면(로컬·프리뷰) 초기화하지 않는다 — captureException은 no-op이 된다.
 */
import * as Sentry from "@sentry/nextjs";

// lib/env는 서버 전용(zod·t3-env를 브라우저에 싣지 않는다 — plan perf-diet A1). 빈 문자열도 "없음"으로 본다
const dsn = process.env["NEXT_PUBLIC_SENTRY_DSN"];
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
