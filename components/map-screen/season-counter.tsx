import type { SeasonStats } from "@/lib/types";

/**
 * 4b. 시즌 카운터 — 시트 헤더 캡션 한 줄. 라이브 점 + "오늘 N건 확인됐어요 │ 이번 주 N곳".
 * 구분은 가운데 점 대신 세로 헤어라인(캐치테이블 "★4.5 │ 리뷰 120" 문법). "최다 확인"은 뺐다(긴 상호가 잘림).
 */
export function SeasonCounter({ stats }: { stats: SeasonStats }) {
  return (
    <p
      className="flex min-w-0 items-center gap-2 text-caption-l-medium text-fg-secondary tabular-nums"
      aria-label="시즌 카운터"
    >
      <span
        className="size-1.5 shrink-0 rounded-max bg-green-500 motion-safe:animate-pulse"
        aria-hidden="true"
      />
      <span className="truncate">
        {stats.todayCheckinCount > 0 ? (
          <>
            오늘 <strong className="font-semibold text-fg">{stats.todayCheckinCount}</strong>건
            확인됐어요
          </>
        ) : (
          "오늘은 아직 확인이 없어요"
        )}
      </span>
      <span className="h-2.5 w-px shrink-0 bg-line-strong" aria-hidden="true" />
      <span className="shrink-0">
        이번 주 <strong className="font-semibold text-fg">{stats.weekPlaceCount}</strong>곳
      </span>
    </p>
  );
}
