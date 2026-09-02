import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/** /place/[id]에 없는 id — 잘못된 공유 링크. 스트리밍이라 상태 코드는 200 + noindex(진짜 404는 Phase 5). */
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
