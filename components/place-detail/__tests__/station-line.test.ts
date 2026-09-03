import { describe, expect, it } from "vitest";
import { getPlaces } from "@/lib/data";
import type { NearestStation } from "@/lib/types";
import { estWidth, formatStationLine, numericLines } from "../station-line";

const NOW = "2026-09-01T12:00:00+09:00";

/** 265(320 콘텐츠 폭) − 22(핀) − 22(chevron) − 4(추정 과소분). station-line.ts의 예산을 여기 한 번 더 적는다 */
const BUDGET = 217;
const BADGE = 22;

function station(overrides: Partial<NearestStation> = {}): NearestStation {
  return { name: "가락시장역", exit: "2-1", distanceM: 90, lines: ["3", "8"], ...overrides };
}

describe("formatStationLine", () => {
  it("출구가 있으면 '역 N번출구에서 거리'", () => {
    expect(formatStationLine(station())).toBe("가락시장역 2-1번출구에서 90m");
  });

  it("출구가 없으면 역 중심까지 — '역에서 거리'", () => {
    expect(formatStationLine(station({ name: "고촌역", exit: null, distanceM: 620, lines: [] }))).toBe(
      "고촌역에서 620m",
    );
  });

  it("거리는 10m 반올림 (직선거리라 1m 단위로 쓰지 않는다)", () => {
    // 역명·출구가 짧은 곳으로 잰다 — 가락시장역 2-1번출구는 세 자리 거리까지 오면 폭 예산에 걸린다
    expect(formatStationLine(station({ name: "마포역", exit: "3", distanceM: 367 }))).toBe(
      "마포역 3번출구에서 370m",
    );
  });

  it("한 줄을 넘기면 출구를 뗀다 — 서울 최장 역명 + 배지 3개", () => {
    const worst = station({
      name: "동대문역사문화공원역",
      exit: "11-1",
      distanceM: 990,
      lines: ["2", "4", "5"],
    });
    expect(formatStationLine(worst)).toBe("동대문역사문화공원역에서 990m");
    // 배지 3개까지 오면 **폴백도** 예산을 넘는다(244 > 217) — 그 조합은 truncate가 받는다.
    // 서울에서 10자 역명 + 3중 환승은 이 역 하나뿐이라 폴백 사다리를 더 만들지 않는다.
    expect(estWidth(formatStationLine(worst)) + BADGE * 3).toBeGreaterThan(BUDGET);
    expect(estWidth(formatStationLine(worst)) + BADGE).toBeLessThanOrEqual(BUDGET);
  });

  it("예산에 아슬아슬하게 걸리는 라벨도 출구를 뗀다 (추정이 실측보다 작게 나오는 만큼 여유를 뒀다)", () => {
    const tight = station({ name: "가산디지털단지역", exit: "4", distanceM: 50, lines: ["1", "7"] });
    // 추정 239 — 핀·chevron이 44px을 먹은 뒤로 8자 역명은 출구를 못 달고, 폴백은 190으로 들어간다
    expect(formatStationLine(tight)).toBe("가산디지털단지역에서 50m");
  });

  it("같은 역명이라도 배지가 적으면 출구가 살아남는다 (판정은 배지 폭까지 센다)", () => {
    const two = station({ name: "연신내역", exit: "7", distanceM: 260, lines: ["3", "6"] });
    expect(formatStationLine(two)).toBe("연신내역 7번출구에서 260m");
    // 같은 라벨(155)에 배지가 3개면 221 > 217 — 배지 폭이 판정을 바꾼다
    const three = station({ name: "연신내역", exit: "7", distanceM: 260, lines: ["3", "6", "9"] });
    expect(formatStationLine(three)).toBe("연신내역에서 260m");
  });
});

describe("numericLines", () => {
  it("숫자 호선만 배지가 된다 — 이름 노선은 걸러진다", () => {
    expect(numericLines(["3", "8"])).toEqual(["3", "8"]);
    expect(numericLines(["수인·분당"])).toEqual([]);
    expect(numericLines(["김포 골드라인"])).toEqual([]);
  });
});

// 데이터를 다시 구워도 화면이 안 깨지는지 — 특정 id가 아니라 전수 성질로 단언한다
describe("목 데이터 전수", () => {
  it("표시되는 역 줄은 배지 폭까지 더해도 320에서 한 줄", async () => {
    const places = await getPlaces({}, NOW);
    const shown = places.filter((p) => p.nearestStation !== null);
    expect(shown.length).toBeGreaterThan(40);
    for (const p of shown) {
      const s = p.nearestStation;
      if (s === null) continue;
      const width = estWidth(formatStationLine(s)) + BADGE * numericLines(s.lines).length;
      expect(width, `${p.name} — ${formatStationLine(s)}`).toBeLessThanOrEqual(BUDGET);
    }
  });

  it("폭이 모자란 곳만 출구를 뗀다 — 지금 데이터에선 가산디지털단지역 2곳", async () => {
    const places = await getPlaces({}, NOW);
    const dropped = places.filter(
      (p) => p.nearestStation?.exit != null && !formatStationLine(p.nearestStation).includes("출구"),
    );
    // 8자 역명 + 배지 2개만 걸린다. 데이터를 다시 구워 목록이 늘면 예산이 아니라 이 기대치를 확인해라
    expect(dropped.map((p) => p.nearestStation?.name)).toEqual([
      "가산디지털단지역",
      "가산디지털단지역",
    ]);
  });
});
