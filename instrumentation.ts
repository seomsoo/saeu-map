/**
 * Next 계측 훅 — OpenNext(Cloudflare)는 nodejs 런타임 하나뿐이라 edge 설정은 없다.
 * onRequestError: 서버 컴포넌트·라우트 핸들러·서버 액션에서 던진 오류를 Sentry로(@sentry/nextjs ≥ 8.28, Next 15+).
 */
import * as Sentry from "@sentry/nextjs";

export async function register(): Promise<void> {
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    await import("./sentry.server.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
