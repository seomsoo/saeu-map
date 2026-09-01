import { Skeleton } from "@/components/ui/skeleton";

/** 라우트 로딩 — 지도 자리 + 시트 자리 스켈레톤. */
export default function Loading() {
  return (
    <div
      className="relative h-dvh w-full overflow-hidden bg-surface-dim"
      aria-busy="true"
      aria-label="불러오는 중"
    >
      <Skeleton className="absolute inset-0 rounded-none" />
      <div className="absolute inset-x-0 top-0 flex flex-col gap-1.5 px-3 pt-2">
        <div className="flex h-9 items-center justify-between">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-9 w-16 rounded-control" />
        </div>
        <Skeleton className="h-10 rounded-control" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[40dvh] rounded-t-card border-t border-border bg-surface">
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-border-strong" />
        <div className="space-y-3 px-4 pt-5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      </div>
    </div>
  );
}
