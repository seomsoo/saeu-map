import { Skeleton } from "@/components/ui/skeleton";

/** 라우트 로딩 — 검색 블록·칩 행·시트 자리 스켈레톤 (화면 1과 같은 배치). */
export default function Loading() {
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
      <div className="absolute inset-x-0 bottom-0 h-2/5 rounded-t-20 bg-bg shadow-upper">
        <div className="mx-auto mt-2.5 h-1.5 w-12.5 rounded-max bg-line-hairline" />
        <div className="space-y-2 border-b border-line-hairline px-5 pt-4 pb-4">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-5 w-52" />
        </div>
        <div className="px-5 pt-3">
          <Skeleton className="h-10 rounded-12" />
        </div>
        <div className="space-y-1.5 px-5 pt-4">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-5 w-3/5" />
        </div>
      </div>
    </div>
  );
}
