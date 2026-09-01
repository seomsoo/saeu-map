import type { SeasonStats } from "@/lib/types";

/** 3. 시즌 카운터 — 한 줄, 얇은 반투명 바. 좁으면 뒤 세그먼트부터 말줄임. */
export function SeasonCounter({ stats }: { stats: SeasonStats }) {
  return (
    <p
      className="truncate rounded-control bg-surface-translucent px-2.5 py-1 text-xs text-ink-secondary tabular-nums"
      aria-label="시즌 카운터"
    >
      이번 주 확인 <strong className="font-semibold text-ink">{stats.weekPlaceCount}</strong>곳
      {" · "}
      오늘 <strong className="font-semibold text-ink">{stats.todayCheckinCount}</strong>건
      {stats.topPlace && (
        <>
          {" · "}
          이번 주 최다 확인{" "}
          <strong className="font-semibold text-ink">{stats.topPlace.name}</strong>
        </>
      )}
    </p>
  );
}
