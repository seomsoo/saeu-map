import { describe, expect, it } from "vitest";
import { boundsOf, formatDistance, haversineKm, inBounds, pointInRing, SEOUL_CENTER } from "../geo";

const GANGNAM_STATION = { lat: 37.4979, lng: 127.0276 };

describe("haversineKm", () => {
  it("서울시청 ↔ 강남역 ≈ 8.7km", () => {
    const km = haversineKm(SEOUL_CENTER, GANGNAM_STATION);
    expect(km).toBeGreaterThan(8.3);
    expect(km).toBeLessThan(9.1);
  });

  it("같은 점은 0", () => {
    expect(haversineKm(SEOUL_CENTER, SEOUL_CENTER)).toBe(0);
  });
});

describe("formatDistance", () => {
  it.each([
    [0.004, "10m"],
    [0.85, "850m"],
    [0.854, "850m"],
    [1.23, "1.2km"],
    [9.96, "10.0km"],
    [12.6, "13km"],
  ])("%f km → %s", (km, label) => {
    expect(formatDistance(km)).toBe(label);
  });
});

describe("bounds", () => {
  const bounds = { north: 37.6, south: 37.5, east: 127.1, west: 126.9 };

  it("inBounds는 경계 포함", () => {
    expect(inBounds(SEOUL_CENTER, bounds)).toBe(true);
    expect(inBounds({ lat: 37.6, lng: 127.1 }, bounds)).toBe(true);
    expect(inBounds({ lat: 37.61, lng: 127.0 }, bounds)).toBe(false);
  });

  it("boundsOf는 감싸는 사각형, 빈 목록은 null", () => {
    expect(boundsOf([])).toBeNull();
    expect(boundsOf([SEOUL_CENTER, GANGNAM_STATION])).toEqual({
      north: SEOUL_CENTER.lat,
      south: GANGNAM_STATION.lat,
      east: GANGNAM_STATION.lng,
      west: SEOUL_CENTER.lng,
    });
  });
});

describe("pointInRing", () => {
  // [lng, lat] 정사각형. 닫힌 링(첫 점 반복)과 열린 링 둘 다 같은 답이어야 한다.
  const open = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const closed = [...open, [0, 0]];

  it.each([
    ["안", { lat: 0.5, lng: 0.5 }, true],
    ["밖(오른쪽)", { lat: 0.5, lng: 1.5 }, false],
    ["밖(위)", { lat: 1.5, lng: 0.5 }, false],
    ["밖(왼쪽, 같은 위도)", { lat: 0.5, lng: -0.5 }, false],
  ])("%s", (_, point, expected) => {
    expect(pointInRing(point, open)).toBe(expected);
    expect(pointInRing(point, closed)).toBe(expected);
  });

  it("오목한 링의 파인 부분은 밖", () => {
    const concave = [[0, 0], [3, 0], [3, 3], [2, 3], [2, 1], [1, 1], [1, 3], [0, 3]];
    expect(pointInRing({ lat: 2, lng: 1.5 }, concave)).toBe(false);
    expect(pointInRing({ lat: 0.5, lng: 1.5 }, concave)).toBe(true);
  });
});
