import { Skeleton } from "@/components/ui/skeleton";

/** 상세 로딩 — 상호·카테고리·확인 캡션 / 정보 블록 / 버튼 줄 자리. 사진은 있을지 알 수 없어 자리를 두지 않는다. */
export function PlaceDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="가게 정보 불러오는 중" className="px-5 pt-4">
      <Skeleton className="h-7 w-2/5" />
      <Skeleton className="mt-1.5 h-4 w-1/2" />
      <Skeleton className="mt-1.5 h-3 w-2/5" />
      {/* 정보 블록 — 아이콘 열(16 원) + 값 한 줄씩 두 그룹. **주소 자리는 두지 않는다**:
          기본이 접힘이라 실제 화면도 역 줄 + 영업시간 두 줄이다 */}
      <div className="mt-5 flex items-center gap-1.5">
        <Skeleton className="size-4 rounded-max" />
        <Skeleton className="h-4 w-2/5" />
      </div>
      {/* 영업시간 자리 — 실제 정보 블록과 같은 12(위치와는 다른 필드) */}
      <div className="mt-3 flex items-center gap-1.5">
        <Skeleton className="size-4 rounded-max" />
        <Skeleton className="h-4 w-3/5" />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        <Skeleton className="col-span-2 h-12 rounded-12" />
        <Skeleton className="h-12 rounded-12" />
        <Skeleton className="h-12 rounded-12" />
      </div>
    </div>
  );
}
