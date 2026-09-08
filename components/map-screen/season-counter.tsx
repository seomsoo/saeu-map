import type { SeasonStats } from "@/lib/types";

/**
 * 4b. 시즌 카운터 — 시트 헤더 캡션 한 줄. 라이브 점 + "오늘 N건 확인됐어요 │ 이번 주 N곳".
 * 구분은 가운데 점 대신 세로 헤어라인(캐치테이블 "★4.5 │ 리뷰 120" 문법). "최다 확인"은 뺐다(긴 상호가 잘림).
 */
export function SeasonCounter({
  stats,
  onShowNew,
}: {
  stats: SeasonStats;
  /**
   * "새로 들어온 집 N곳"을 눌렀을 때 — 목록·마커를 신규만으로 좁히고 지도를 그리로 맞춘다.
   * **입구일 뿐 토글이 아니다**(멱등): 켜진 상태는 칩 행의 [새로 들어온 집 ✕]가 말하고 해제도 거기서 한다.
   * 상태 줄(오늘 N건·이번 주 N곳) 안에 눌린 상태를 두면 정보와 컨트롤이 섞인다(2026-09-09).
   */
  onShowNew: () => void;
}) {
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
      {/* 셋째 조각은 숫자를 약속하는 자리이자 그리로 가는 입구다 — 서울 400곳 줌에서는 신규가
          클러스터에 묻혀 마커 배지가 안 보인다. 눌러 갈 수 있다는 건 브랜드색으로 말한다. */}
      {stats.newPlaceCount > 0 && (
        <>
          <span className="h-2.5 w-px shrink-0 bg-line-strong" aria-hidden="true" />
          <button type="button" onClick={onShowNew} className="shrink-0 text-brand-fg">
            새로 들어온 집{" "}
            <strong className="font-semibold">{stats.newPlaceCount}</strong>곳
          </button>
        </>
      )}
    </p>
  );
}
