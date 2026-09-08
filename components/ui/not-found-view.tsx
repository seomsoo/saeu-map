import Link from "next/link";
import { buttonVariants } from "./button";
import { EmptyState } from "./empty-state";

/**
 * 없는 페이지 화면 — 전폭 가운데 빈 상태 + [지도로 돌아가기]. 카피만 다른 같은 모양이 네 곳이라 여기 모았다
 * (`/` · `/place/[id]` · `/gu/[name]` · `/admin`의 비관리자 위장). Suspense 경계가 없는 세그먼트는
 * 이걸 그리면서 HTTP 404로 나간다(decisions 2026-09-07).
 */
export function NotFoundView({ title, description }: { title: string; description: string }) {
  return (
    <main className="flex h-dvh items-center justify-center bg-bg">
      <EmptyState
        title={title}
        description={description}
        action={
          <Link href="/" className={buttonVariants({ variant: "outline", size: "md" })}>
            지도로 돌아가기
          </Link>
        }
      />
    </main>
  );
}
