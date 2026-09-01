import { describe, expect, it } from "vitest";
import { boundsOf, formatDistance, haversineKm, inBounds, SEOUL_CENTER } from "../geo";

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
