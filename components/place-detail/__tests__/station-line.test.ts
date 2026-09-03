import { describe, expect, it } from "vitest";
import { getPlaces } from "@/lib/data";
import type { NearestStation } from "@/lib/types";
import { estWidth, formatStationLine, numericLines } from "../station-line";

const NOW = "2026-09-01T12:00:00+09:00";

/** 320px 실제 폭 265 − estWidth 과소추정분 6. station-line.ts의 예산과 같은 값을 여기 한 번 더 적는다 */
const BUDGET = 259;
const BADGE = 26;

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
    expect(formatStationLine(station({ distanceM: 367 }))).toBe("가락시장역 2-1번출구에서 370m");
  });

  it("한 줄을 넘기면 출구를 뗀다 — 서울 최장 역명 + 배지 3개", () => {
    const worst = station({
      name: "동대문역사문화공원역",
      exit: "11-1",
      distanceM: 990,
      lines: ["2", "4", "5"],
    });
    expect(formatStationLine(worst)).toBe("동대문역사문화공원역에서 990m");
    // 출구를 뗀 형태는 배지 3개를 달고도 예산 안 — 폴백이 또 넘치지는 않는다
    expect(estWidth(formatStationLine(worst)) + BADGE * 3).toBeLessThanOrEqual(BUDGET);
  });

  it("265에 아슬아슬하게 걸리는 라벨도 출구를 뗀다 (추정이 실측보다 작게 나오는 만큼 여유를 뒀다)", () => {
    const tight = station({ name: "총신대입구(이수)역", exit: "5", distanceM: 320, lines: ["4", "7"] });
    // 추정 265 / 실측 265.8 — 예산이 265였다면 통과했다가 truncate로 잘렸다
    expect(formatStationLine(tight)).toBe("총신대입구(이수)역에서 320m");
  });

  it("같은 역명이라도 배지가 적으면 출구가 살아남는다 (판정은 배지 폭까지 센다)", () => {
    const one = station({ name: "가산디지털단지역", exit: "2", distanceM: 140, lines: ["1", "7"] });
    expect(formatStationLine(one)).toBe("가산디지털단지역 2번출구에서 140m");
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

  it("지금 데이터는 전부 출구를 유지한다 (폴백은 서울 전역용 안전망)", async () => {
    const places = await getPlaces({}, NOW);
    const dropped = places.filter(
      (p) => p.nearestStation?.exit != null && !formatStationLine(p.nearestStation).includes("출구"),
    );
    expect(dropped.map((p) => p.name)).toEqual([]);
  });
});
