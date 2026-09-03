import { Skeleton } from "@/components/ui/skeleton";

/** 상세 로딩 — 상호·카테고리·확인 캡션 / 정보 블록 / 버튼 줄 자리. 사진은 있을지 알 수 없어 자리를 두지 않는다. */
export function PlaceDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="가게 정보 불러오는 중" className="px-5 pt-4">
      <Skeleton className="h-7 w-2/5" />
      <Skeleton className="mt-1.5 h-4 w-1/2" />
      <Skeleton className="mt-1.5 h-3 w-2/5" />
      <div className="mt-5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-7 w-12 rounded-8" />
      </div>
      <Skeleton className="mt-1.5 h-4 w-3/5" />
      <div className="mt-4 grid grid-cols-4 gap-2">
        <Skeleton className="col-span-2 h-12 rounded-12" />
        <Skeleton className="h-12 rounded-12" />
        <Skeleton className="h-12 rounded-12" />
      </div>
    </div>
  );
}
