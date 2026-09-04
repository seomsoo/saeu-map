import { describe, expect, it } from "vitest";
import { makeMenu as menu, makePlace } from "./fixtures";
import type { Menu } from "../types";
import {
  SIDE_LABELS,
  areaLabel,
  filterPlaces,
  markerCategory,
  primaryMenu,
  sideChips,
  sortPlaces,
  unitChipLabel,
  primaryMenuLine,
} from "../places";

const noChips = { chips: [], query: "", bookmarkedIds: new Set<string>() };

describe("filterPlaces — 탭은 다중 태그 매칭", () => {
  const grill = makePlace({ tags: ["grill"] });
  const both = makePlace({ tags: ["grill", "raw"] });
  const raw = makePlace({ tags: ["raw"] });
  const all = [grill, both, raw];

  it("전체", () => {
    expect(filterPlaces(all, { tab: "all", ...noChips })).toHaveLength(3);
  });
  it("구이 탭엔 구이+회 가게도 나온다", () => {
    expect(filterPlaces(all, { tab: "grill", ...noChips })).toEqual([grill, both]);
  });
  it("회 탭엔 회만 파는 집과 둘 다 파는 집", () => {
    expect(filterPlaces(all, { tab: "raw", ...noChips })).toEqual([both, raw]);
  });
});

describe("filterPlaces — 칩", () => {
  const fresh = makePlace({ isNew: true });
  const old = makePlace({ isNew: false });

  it("새로 들어온 집", () => {
    expect(
      filterPlaces([fresh, old], { tab: "all", ...noChips, chips: ["new"] }),
    ).toEqual([fresh]);
  });
  it("찜한 곳은 북마크 집합 기준, 비어 있으면 0곳", () => {
    expect(
      filterPlaces([fresh, old], { tab: "all", ...noChips, chips: ["bookmarked"] }),
    ).toEqual([]);
    expect(
      filterPlaces([fresh, old], {
        tab: "all",
        ...noChips,
        chips: ["bookmarked"],
        bookmarkedIds: new Set([old.id]),
      }),
    ).toEqual([old]);
  });
  it("칩은 AND", () => {
    expect(
      filterPlaces([fresh, old], {
        tab: "all",
        ...noChips,
        chips: ["new", "bookmarked"],
        bookmarkedIds: new Set([old.id]),
      }),
    ).toEqual([]);
  });
});

describe("filterPlaces — 사이드 칩", () => {
  const both = makePlace({ sides: { headButter: true, ramen: true, friedRice: true } });
  const ramenOnly = makePlace({ sides: { headButter: false, ramen: true, friedRice: false } });
  const none = makePlace();

  it("라면 → 라면 되는 집만", () => {
    expect(
      filterPlaces([both, ramenOnly, none], { tab: "all", ...noChips, chips: ["ramen"] }),
    ).toEqual([both, ramenOnly]);
  });
  it("라면 + 볶음밥은 AND", () => {
    expect(
      filterPlaces([both, ramenOnly, none], {
        tab: "all",
        ...noChips,
        chips: ["ramen", "friedRice"],
      }),
    ).toEqual([both]);
  });
  it("사이드 칩과 새로 들어온 집도 AND", () => {
    const freshRamen = makePlace({ isNew: true, sides: { headButter: false, ramen: true, friedRice: false } });
    expect(
      filterPlaces([freshRamen, ramenOnly], { tab: "all", ...noChips, chips: ["ramen", "new"] }),
    ).toEqual([freshRamen]);
  });
  it("카드 미니칩 라벨과 필터 라벨은 같은 출처", () => {
    expect(sideChips({ headButter: true, ramen: true, friedRice: true }).map((c) => c.label)).toEqual([
      SIDE_LABELS.headButter,
      SIDE_LABELS.ramen,
      SIDE_LABELS.friedRice,
    ]);
  });
});

describe("filterPlaces — 검색(우리 데이터)", () => {
  const nara = makePlace({ name: "나라수산", gu: "마포구" });
  const seongsu = makePlace({
    name: "성수부두",
    gu: "성동구",
    addressRoad: "서울 성동구 연무장길 41-26",
    addressJibun: "서울 성동구 성수동2가 316-22",
  });
  const all = [nara, seongsu];
  const search = (query: string) =>
    filterPlaces(all, { tab: "all", ...noChips, query });

  it("상호", () => { expect(search("나라")).toEqual([nara]); });
  it("구", () => { expect(search("성동구")).toEqual([seongsu]); });
  it("동네(지번)", () => { expect(search("성수동")).toEqual([seongsu]); });
  it("공백·대소문자 무시", () => { expect(search(" 마포 구 ")).toEqual([nara]); });
  it("없는 동네는 0곳", () => { expect(search("없는동네")).toEqual([]); });
});

describe("sortPlaces", () => {
  const origin = { lat: 37.5, lng: 127.0 };
  const near = makePlace({ name: "나", lat: 37.501, lng: 127.0 });
  const far = makePlace({ name: "가", lat: 37.6, lng: 127.0 });
  const sameNear = makePlace({ name: "가", lat: 37.501, lng: 127.0 });

  it("가까운순: 거리 → 이름", () => {
    expect(sortPlaces([far, near, sameNear], "distance", origin).map((p) => p.name)).toEqual([
      "가",
      "나",
      "가",
    ]);
    expect(sortPlaces([far, near, sameNear], "distance", origin)[0]).toBe(sameNear);
  });

  it("기준점 없으면 입력 순서 유지", () => {
    expect(sortPlaces([far, near], "distance", null)).toEqual([far, near]);
  });

  it("최근 확인순: lastCheckedAt 내림차순 → 이름", () => {
    const a = makePlace({ name: "나", lastCheckedAt: "2026-08-20T00:00:00.000Z" });
    const b = makePlace({ name: "가", lastCheckedAt: "2026-08-20T00:00:00.000Z" });
    const c = makePlace({ name: "다", lastCheckedAt: "2026-08-28T00:00:00.000Z" });
    expect(sortPlaces([a, b, c], "recent", origin)).toEqual([c, b, a]);
  });

  it("확인 많은 순: checkCount → 최근 → 이름 (0건 동률이 대부분)", () => {
    const a = makePlace({ name: "나", checkCount: 0, lastCheckedAt: "2026-08-20T00:00:00.000Z" });
    const b = makePlace({ name: "가", checkCount: 0, lastCheckedAt: "2026-08-20T00:00:00.000Z" });
    const c = makePlace({ name: "다", checkCount: 0, lastCheckedAt: "2026-08-25T00:00:00.000Z" });
    const d = makePlace({ name: "라", checkCount: 3, lastCheckedAt: "2026-08-01T00:00:00.000Z" });
    expect(sortPlaces([a, b, c, d], "checks", origin)).toEqual([d, c, b, a]);
  });

  it("입력 배열을 변경하지 않는다", () => {
    const input = [far, near];
    sortPlaces(input, "distance", origin);
    expect(input).toEqual([far, near]);
  });
});

describe("카드 표시용", () => {
  it("대표 메뉴: 가격 있는 첫 메뉴 → 첫 메뉴 → null", () => {
    const priced = menu({ name: "생새우소금구이", price: 60000 });
    const free = menu({ name: "새우머리튀김", price: null });
    expect(primaryMenu(makePlace({ menus: [free, priced] }))).toBe(priced);
    expect(primaryMenu(makePlace({ menus: [free] }))).toBe(free);
    expect(primaryMenu(makePlace({ menus: [] }))).toBeNull();
  });

  it.each([
    [menu({ unit: "kg", unit_raw: "1" }), "1kg"],
    [menu({ unit: "kg", unit_raw: "1.5" }), "1.5kg"],
    [menu({ unit: "g", unit_raw: "500" }), "500g"],
    [menu({ unit: "pan", unit_raw: "한판" }), "한판"],
    [menu({ unit: "count", unit_raw: "15마리" }), "15마리"],
    [menu({ unit: "size", unit_raw: "소" }), "소"],
    [menu({ unit: "none", unit_raw: null }), null],
    [menu({ unit: "kg", unit_raw: null }), null],
  ])("단위 칩 %o → %s", (m, label) => {
    expect(unitChipLabel(m)).toBe(label);
  });

  it("마커 색은 구이 우선", () => {
    expect(markerCategory(["grill", "raw"])).toBe("grill");
    expect(markerCategory(["raw"])).toBe("raw");
  });

  it("사이드 3종 순서 고정", () => {
    expect(
      sideChips({ headButter: true, ramen: false, friedRice: true }).map((c) => [
        c.label,
        c.active,
      ]),
    ).toEqual([
      ["머리버터구이", true],
      ["라면", false],
      ["볶음밥", true],
    ]);
  });
});

describe("areaLabel — 시트 제목의 지역", () => {
  const gu = (name: string, n: number) =>
    Array.from({ length: n }, () => makePlace({ gu: name }));

  it("0곳이면 '이 지역'", () => {
    expect(areaLabel([], 50)).toBe("이 지역");
  });
  it("구 하나면 그 구", () => {
    expect(areaLabel(gu("마포구", 3), 50)).toBe("마포구");
  });
  it("여러 구면 최다 구 + 일대 (동률은 가나다순)", () => {
    expect(areaLabel([...gu("마포구", 3), ...gu("서대문구", 1)], 50)).toBe("마포구 일대");
    expect(areaLabel([...gu("마포구", 1), ...gu("동작구", 1)], 50)).toBe("동작구 일대");
  });
  it("전체의 60% 이상 보이면 '서울 전체'", () => {
    expect(areaLabel([...gu("마포구", 2), ...gu("동작구", 1)], 5)).toBe("서울 전체");
    expect(areaLabel([...gu("마포구", 2), ...gu("동작구", 1)], 6)).toBe("마포구 일대");
  });
  it("구가 8개 이상 섞여도 '서울 전체'", () => {
    const many = ["강남구", "강동구", "강북구", "강서구", "관악구", "광진구", "구로구", "금천구"].flatMap((g) => gu(g, 1));
    expect(areaLabel(many, 500)).toBe("서울 전체");
  });
});

describe("primaryMenuLine — 대표 메뉴 한 줄 (제보 완료 카드·신규 패널 행)", () => {
  it("이름 + 단위 + 가격, 단위가 이름에 이미 있으면 한 번만", () => {
    const line = (overrides: Partial<Menu>) => primaryMenuLine(makePlace({ menus: [menu(overrides)] }));
    expect(line({ name: "왕새우 소금구이", price: 35000, unit: "kg", unit_raw: "1" })).toBe("왕새우 소금구이 1kg 35,000원");
    expect(line({ name: "생새우대하구이 한판", price: 42000, unit: "pan", unit_raw: "한판" })).toBe("생새우대하구이 한판 42,000원");
    expect(line({ name: "왕새우 소금구이 1kg (계절메뉴)", price: 65000, unit: "kg", unit_raw: "1" })).toBe(
      "왕새우 소금구이 1kg (계절메뉴) 65,000원",
    );
    expect(line({ name: "새우 머리구이", price: null, unit: "none", unit_raw: null })).toBe("새우 머리구이");
    expect(primaryMenuLine(makePlace({ menus: [] }))).toBeNull();
  });
});
