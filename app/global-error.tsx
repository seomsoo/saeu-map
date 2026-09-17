"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";
import "./globals.css";

/**
 * 루트 레이아웃까지 죽었을 때 — 레이아웃이 없으니 html·body를 직접 그리고 토큰은 globals.css를 들인다.
 * 여기 오는 오류는 Next가 자동으로 보내지 않는다 → Sentry에 직접. 문구는 app/error.tsx와 같다.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="ko" className="antialiased">
      <body className="font-sans">
        <main className="flex h-dvh items-center justify-center bg-bg">
          <ErrorState title="화면을 불러오지 못했어요" description="잠시 후 다시 시도해주세요." onRetry={retry} />
        </main>
      </body>
    </html>
  );
}
