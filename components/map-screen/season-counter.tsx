import type { SeasonStats } from "@/lib/types";

/** 4b. 시즌 카운터 — 시트 헤더 부제 한 줄. 좁으면 뒤 세그먼트부터 말줄임. */
export function SeasonCounter({ stats }: { stats: SeasonStats }) {
  return (
    <p
      className="truncate text-body-l-medium text-fg-secondary tabular-nums"
      aria-label="시즌 카운터"
    >
      이번 주 확인 <strong className="font-semibold text-fg">{stats.weekPlaceCount}</strong>곳
      {" · "}
      오늘 <strong className="font-semibold text-fg">{stats.todayCheckinCount}</strong>건
      {stats.topPlace && (
        <>
          {" · "}
          이번 주 최다 확인{" "}
          <strong className="font-semibold text-fg">{stats.topPlace.name}</strong>
        </>
      )}
    </p>
  );
}
