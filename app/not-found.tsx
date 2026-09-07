import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/** 어느 라우트에도 맞지 않는 경로(`/test` 등 — Phase 7까지) — Next 기본 404 대신 우리 빈 상태로, HTTP 404. */
export default function NotFound() {
  return (
    <main className="flex h-dvh items-center justify-center bg-bg">
      <EmptyState
        title="페이지를 찾을 수 없어요"
        description="주소가 잘못됐거나 없어진 페이지예요"
        action={
          <Link href="/" className={buttonVariants({ variant: "outline", size: "md" })}>
            지도로 돌아가기
          </Link>
        }
      />
    </main>
  );
}
