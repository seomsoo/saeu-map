import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/** /place/[id]에 없는 id — 잘못된 공유 링크. 이 세그먼트엔 Suspense 경계가 없어 HTTP 404로 나간다 (decisions 2026-09-07). */
export default function PlaceNotFound() {
  return (
    <main className="flex h-dvh items-center justify-center bg-bg">
      <EmptyState
        title="가게를 찾을 수 없어요"
        description="링크가 잘못됐거나 지도에서 내려간 가게예요"
        action={
          <Link href="/" className={buttonVariants({ variant: "outline", size: "md" })}>
            지도로 돌아가기
          </Link>
        }
      />
    </main>
  );
}
