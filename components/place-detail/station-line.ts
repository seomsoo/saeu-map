import { formatDistance } from "@/lib/geo";
import type { NearestStation } from "@/lib/types";

/**
 * 320px에서 역 줄이 쓸 수 있는 실제 폭은 265px다(Playwright 실측, `px-5` 안쪽).
 * 여기서 아이콘 열과 드롭다운을 뺀 나머지가 배지+라벨의 예산이다:
 * 265 − 22(핀 16 + gap 6) − 22(chevron 16 + gap 6) − 4(추정 여유, 아래) = **217**.
 */
const LINE_BUDGET_PX = 217;

/** 배지 하나가 먹는 폭: 16px 원 + gap 1.5(6px). */
const BADGE_PX = 22;

/** 배지를 그릴 수 있는 노선 = 원 안에 넣을 숫자가 있는 것만. 수인·분당, 김포 골드라인은 제외된다. */
const NUMERIC_LINE = /^[1-9]$/;

/**
 * 14px Pretendard 폭 근사. 브라우저 측정 없이 Vitest로 검증할 수 있어야 해서 canvas가 아니라 이 근사를 쓴다.
 * **실측보다 0.8~3.4px 작게 나온다**(표본 8개, Playwright). 즉 추정이 안전한 방향이 아니라서
 * 예산에서 4px(관측 최대 과소분 3.4 올림)을 미리 빼 둔다 — 이 여유가 없으면 예산에 아슬아슬하게
 * 걸린 라벨이 판정을 통과했다가 화면에서 잘린다.
 */
export function estWidth(s: string): number {
  return Array.from(s).reduce((w, c) => w + (/[가-힣]/.test(c) ? 12 : /\d/.test(c) ? 8 : 5), 0);
}

/** 숫자 호선만 남긴다(배지용). 나머지는 배지 없이 역명만 보여준다. */
export function numericLines(lines: string[]): string[] {
  return lines.filter((l) => NUMERIC_LINE.test(l));
}

/**
 * "가락시장역 2-1번출구에서 90m". **한 줄을 못 지키면 출구를 뗀다** — 역명이 길고 배지가 여럿인
 * 조합만 해당한다(현재 데이터에선 가산디지털단지역 2곳. 핀·chevron이 44px을 먹은 뒤로 8자 역명이 걸린다).
 * 폴백까지 넘치는 극단(10자 + 배지 3)은 `truncate`가 받는다 — 서울 전체에 동대문역사문화공원역뿐이다.
 * 뷰포트마다 다르게 판정하지 않고 320 기준 하나로 통일한다: 390에서만 출구가 나타났다 사라지면 더 이상하다.
 * 거리는 직선이라 10m 반올림(`formatDistance`) — 화면 1 카드와 같은 표기다.
 */
export function formatStationLine(station: NearestStation): string {
  const distance = formatDistance(station.distanceM / 1000);
  const withoutExit = `${station.name}에서 ${distance}`;
  if (station.exit === null) return withoutExit;

  const withExit = `${station.name} ${station.exit}번출구에서 ${distance}`;
  const badges = numericLines(station.lines).length;
  return estWidth(withExit) + BADGE_PX * badges <= LINE_BUDGET_PX ? withExit : withoutExit;
}
