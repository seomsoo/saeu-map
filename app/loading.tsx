import { Skeleton } from "@/components/ui/skeleton";

/**
 * 라우트 로딩 — 검색 블록·칩 행·시트 자리 스켈레톤 (화면 1과 같은 배치).
 * 데스크탑(lg)은 실제 화면과 같은 그릇: 왼쪽 400 패널(브랜드 행·검색·칩·헤더·카드) + 회색 지도 자리.
 */
export default function Loading() {
  return (
    <div
      className="relative h-dvh w-full overflow-hidden bg-bg-dim lg:flex"
      aria-busy="true"
      aria-label="불러오는 중"
    >
      <div className="contents lg:flex lg:h-full lg:w-100 lg:shrink-0 lg:flex-col lg:border-r lg:border-line-hairline lg:bg-bg">
        <div className="absolute inset-x-0 top-0 flex flex-col gap-2.5 lg:static lg:shrink-0">
          <div className="hidden lg:flex lg:h-14 lg:items-center lg:justify-between lg:pl-safe-left-or-5 lg:pr-safe-right-or-5">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-9 w-20 rounded-max" />
          </div>
          <div className="pt-safe-top-or-3 pl-safe-left-or-5 pr-safe-right-or-5 lg:pt-0">
            <Skeleton className="h-12 rounded-max" />
          </div>
          <div className="flex gap-1.5 pl-safe-left-or-5 pr-safe-right-or-5 lg:flex-wrap lg:pb-2" aria-hidden="true">
            <Skeleton className="h-9 w-14 rounded-max" />
            <Skeleton className="h-9 w-14 rounded-max" />
            <Skeleton className="h-9 w-12 rounded-max" />
            <Skeleton className="h-9 w-28 rounded-max" />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-2/5 rounded-t-20 bg-bg shadow-upper lg:static lg:h-auto lg:min-h-0 lg:flex-1 lg:rounded-none lg:shadow-none">
          <div className="mx-auto mt-2.5 h-1.5 w-12.5 rounded-max bg-line-hairline lg:hidden" />
          <div className="space-y-2 border-b border-line-hairline px-5 pt-4 pb-4 lg:pt-3">
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
    </div>
  );
}
