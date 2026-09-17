/**
 * 서버(워커) Sentry — instrumentation.ts가 nodejs 런타임에서 들인다. 브라우저 쪽과 같은 원칙: 에러만, PII 없음, DSN 없으면 꺼짐.
 * 환경은 프리뷰(PREVIEW_READONLY=1)와 실서비스를 가른다 — 같은 DSN이라 태그가 없으면 섞인다.
 */
import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";

if (env.NEXT_PUBLIC_SENTRY_DSN !== undefined) {
  Sentry.init({
    dsn: env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    environment: env.PREVIEW_READONLY === "1" ? "preview" : process.env.NODE_ENV,
  });
}
