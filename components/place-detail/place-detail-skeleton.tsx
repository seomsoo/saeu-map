import { Skeleton } from "@/components/ui/skeleton";

/** 상세 로딩 — 상호·확인 줄·주소·버튼 3개 자리. 사진은 있을지 알 수 없어 자리를 두지 않는다. */
export function PlaceDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="가게 정보 불러오는 중" className="px-5 pt-4">
      <Skeleton className="h-7 w-2/5" />
      <Skeleton className="mt-2 h-4 w-1/2" />
      <div className="mt-4 flex items-center justify-between border-y border-line-hairline py-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-9 w-24 rounded-max" />
      </div>
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-1.5 h-3 w-1/2" />
      <div className="mt-4 grid grid-cols-4 gap-2">
        <Skeleton className="col-span-2 h-12 rounded-12" />
        <Skeleton className="h-12 rounded-12" />
        <Skeleton className="h-12 rounded-12" />
      </div>
    </div>
  );
}
