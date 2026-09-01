import { describe, expect, it } from "vitest";
import { getPlaces, getPlaceById, getCheckins, getReviews } from "../data";
import type { Place } from "../types";

describe("getPlaces", () => {
  it("returns all places without filter", () => {
    const places = getPlaces();
    expect(places.length).toBeGreaterThan(0);
    expect(places[0]).toHaveProperty("id");
    expect(places[0]).toHaveProperty("name");
    expect(places[0]).toHaveProperty("lat");
    expect(places[0]).toHaveProperty("lng");
  });

  it("filters by tag", () => {
    const grillPlaces = getPlaces({ tag: "grill" });
    for (const p of grillPlaces) {
      expect(p.tags).toContain("grill");
    }
  });

  it("filters by isNew", () => {
    const newPlaces = getPlaces({ isNew: true });
    for (const p of newPlaces) {
      expect(p.isNew).toBe(true);
    }
  });

  it("filters by query", () => {
    const places = getPlaces();
    if (places.length > 0) {
      const first = places[0] as Place;
      const result = getPlaces({ query: first.name.slice(0, 2) });
      expect(result.length).toBeGreaterThan(0);
    }
  });
});

describe("getPlaceById", () => {
  it("returns a place by id", () => {
    const places = getPlaces();
    if (places.length > 0) {
      const first = places[0] as Place;
      const found = getPlaceById(first.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe(first.name);
    }
  });

  it("returns undefined for non-existent id", () => {
    expect(getPlaceById("nonexistent")).toBeUndefined();
  });
});

describe("getCheckins", () => {
  it("returns all checkins without filter", () => {
    const all = getCheckins();
    expect(all.length).toBeGreaterThan(0);
    expect(all[0]).toHaveProperty("placeId");
    expect(all[0]).toHaveProperty("type");
  });

  it("filters by placeId", () => {
    const all = getCheckins();
    const first = all[0];
    if (first) {
      const filtered = getCheckins(first.placeId);
      for (const c of filtered) {
        expect(c.placeId).toBe(first.placeId);
      }
    }
  });
});

describe("getReviews", () => {
  it("returns all reviews without filter", () => {
    const all = getReviews();
    expect(all.length).toBeGreaterThan(0);
  });

  it("filters by placeId", () => {
    const all = getReviews();
    const first = all[0];
    if (first) {
      const filtered = getReviews(first.placeId);
      for (const r of filtered) {
        expect(r.placeId).toBe(first.placeId);
      }
    }
  });
});
