/**
 * 서버 쪽 "조용히 죽지 않기" — 실패를 삼키는 자리(웹훅·R2 삭제·경비 누락·집계 insert·익명 승계)는 로그 한 줄 + Sentry 이벤트 하나.
 * console.error만 두면 워커 로그를 열어야 보인다(보안 리뷰 #11: 빈 값으로 삼킨 42501을 아무도 몰랐다). DSN이 없으면 Sentry 호출은 no-op.
 * 같은 메시지는 한 이슈로 묶는다(fingerprint). 사용자 입력·연락처는 context에 넣지 않는다.
 */
import "server-only";
import * as Sentry from "@sentry/nextjs";

export function reportError(message: string, context: Record<string, unknown> = {}, cause?: unknown): void {
  console.error(message, context, cause instanceof Error ? cause.message : (cause ?? ""));
  Sentry.captureException(cause instanceof Error ? cause : new Error(message), {
    extra: { message, ...context },
    fingerprint: [message],
  });
}
