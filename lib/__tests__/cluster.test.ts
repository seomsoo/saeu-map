import { describe, expect, it } from "vitest";
import { buildPlaceIndex } from "../cluster";
import { makePlace } from "./fixtures";

const SEOUL = { north: 37.7, south: 37.4, east: 127.2, west: 126.8 };

/** 중심 주변 ~50m 안에 n곳 */
function cluster(lat: number, lng: number, n: number) {
  return Array.from({ length: n }, (_, i) =>
    makePlace({ lat: lat + i * 0.0001, lng: lng + i * 0.0001 }),
  );
}

describe("buildPlaceIndex", () => {
  const mapo = cluster(37.54, 126.95, 10);
  const gangnam = cluster(37.5, 127.03, 5);
  const index = buildPlaceIndex([...mapo, ...gangnam]);

  it("낮은 줌에서는 뭉친다", () => {
    const items = index.getItems(SEOUL, 11);
    const clusters = items.filter((i) => i.kind === "cluster");
    expect(clusters).toHaveLength(2);
    expect(clusters.map((c) => c.count).sort((a, b) => a - b)).toEqual([5, 10]);
  });

  it("높은 줌에서는 전부 단독 마커", () => {
    const items = index.getItems(SEOUL, 18);
    expect(items.every((i) => i.kind === "place")).toBe(true);
    expect(items).toHaveLength(15);
  });

  it("bounds 밖은 제외", () => {
    const mapoOnly = { north: 37.56, south: 37.52, east: 126.97, west: 126.93 };
    const items = index.getItems(mapoOnly, 11);
    expect(items).toHaveLength(1);
    expect(items[0]?.kind === "cluster" && items[0].count).toBe(10);
  });

  it("확장 줌은 현재 줌보다 크다", () => {
    const first = index.getItems(SEOUL, 11).find((i) => i.kind === "cluster");
    if (first?.kind !== "cluster") throw new Error("cluster expected");
    expect(index.getExpansionZoom(first.id)).toBeGreaterThan(11);
  });

  it("소수점 줌은 내림", () => {
    expect(index.getItems(SEOUL, 11.7)).toEqual(index.getItems(SEOUL, 11));
  });

  it("빈 목록도 동작", () => {
    expect(buildPlaceIndex([]).getItems(SEOUL, 12)).toEqual([]);
  });
});
