"use client";

import { ErrorState } from "@/components/ui/error-state";

/** 라우트 에러 — 내부 메시지는 노출하지 않는다. retry는 Next가 세그먼트를 다시 렌더. */
export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
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
