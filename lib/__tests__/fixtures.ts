import type { Menu, Place } from "../types";

let seq = 0;

/** 테스트용 Place. 필요한 필드만 덮어쓴다. */
export function makePlace(overrides: Partial<Place> = {}): Place {
  seq += 1;
  return {
    id: `t${seq}`,
    name: `가게${seq}`,
    gu: "마포구",
    addressRoad: "서울 마포구 마포대로 1",
    addressJibun: "서울 마포구 도화동 1-1",
    lat: 37.54,
    lng: 126.95,
    tags: ["grill"],
    specialist: true,
    naverPlaceUrl: null,
    menus: [],
    sides: { headButter: false, ramen: false, friedRice: false },
    source: "seed",
    needsReview: false,
    lastCheckedAt: "2026-08-30T15:00:00.000Z",
    checkCount: 0,
    isNew: false,
    ...overrides,
  };
}

export function makeMenu(overrides: Partial<Menu> = {}): Menu {
  return {
    raw: "",
    name: "새우소금구이",
    price: 50000,
    unit: "none",
    unit_raw: null,
    ...overrides,
  };
}
