"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

/**
 * 라우트 에러 — 내부 메시지는 노출하지 않는다. retry는 Next가 세그먼트를 다시 렌더.
 * 서버에서 던진 오류는 instrumentation.ts(onRequestError)가 이미 보냈지만 클라이언트 렌더 오류는 여기서만 잡힌다 → Sentry에 직접(같은 digest면 한 이슈로 묶인다).
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <main className="flex h-dvh items-center justify-center bg-bg">
      <ErrorState
        title="화면을 불러오지 못했어요"
        description="잠시 후 다시 시도해주세요."
        onRetry={retry}
      />
    </main>
  );
}
