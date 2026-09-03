import { Skeleton } from "@/components/ui/skeleton";

/** 상세 로딩 — 상호·카테고리·확인 캡션 / 정보 블록 / 버튼 줄 자리. 사진은 있을지 알 수 없어 자리를 두지 않는다. */
export function PlaceDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="가게 정보 불러오는 중" className="px-5 pt-4">
      <Skeleton className="h-7 w-2/5" />
      <Skeleton className="mt-1.5 h-4 w-1/2" />
      <Skeleton className="mt-1.5 h-3 w-2/5" />
      {/* 역 줄 자리 — 배지 높이 그대로 20 (역이 없는 곳도 있지만 로딩 중엔 알 수 없다) */}
      <Skeleton className="mt-5 h-5 w-2/5" />
      <div className="mt-0.5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-7 w-12 rounded-8" />
      </div>
      {/* 영업시간 자리 — 실제 정보 블록과 같은 12(주소와는 다른 필드) */}
      <Skeleton className="mt-3 h-4 w-3/5" />
      <div className="mt-4 grid grid-cols-4 gap-2">
        <Skeleton className="col-span-2 h-12 rounded-12" />
        <Skeleton className="h-12 rounded-12" />
        <Skeleton className="h-12 rounded-12" />
      </div>
    </div>
  );
}
