import { PlaceDetailSkeleton } from "@/components/place-detail/place-detail-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/** /place/[id] 직접 진입 로딩 — 검색 블록·칩 행 자리 + 요약 높이(50%) 시트 안 상세 스켈레톤. */
export default function PlaceLoading() {
  return (
    <div
      className="relative h-dvh w-full overflow-hidden bg-bg-dim"
      aria-busy="true"
      aria-label="불러오는 중"
    >
      <div className="absolute inset-x-0 top-0 flex flex-col gap-2.5">
        <div className="bg-bg px-5 pt-safe-top-or-3 pb-3 shadow-float">
          <Skeleton className="h-12" />
        </div>
        <div className="flex gap-1.5 px-5" aria-hidden="true">
          <Skeleton className="h-9 w-14 rounded-max" />
          <Skeleton className="h-9 w-14 rounded-max" />
          <Skeleton className="h-9 w-12 rounded-max" />
          <Skeleton className="h-9 w-28 rounded-max" />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1/2 rounded-t-20 bg-bg shadow-upper">
        <div className="mx-auto mt-2.5 h-1.5 w-12.5 rounded-max bg-line-hairline" />
        <PlaceDetailSkeleton />
      </div>
    </div>
  );
}
