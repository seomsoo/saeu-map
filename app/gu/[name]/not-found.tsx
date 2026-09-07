import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/** /gu/[name]에 서울 25구가 아닌 이름 — HTTP 404 (Suspense 경계 없음, decisions 2026-09-07). */
export default function GuNotFound() {
  return (
    <main className="flex h-dvh items-center justify-center bg-bg">
      <EmptyState
        title="찾을 수 없는 지역이에요"
        description="구별 페이지는 서울 25개 구만 있어요"
        action={
          <Link href="/" className={buttonVariants({ variant: "outline", size: "md" })}>
            지도로 돌아가기
          </Link>
        }
      />
    </main>
  );
}
