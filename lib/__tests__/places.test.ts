import { describe, expect, it } from "vitest";
import { makeMenu as menu, makePlace } from "./fixtures";
import type { Menu } from "../types";
import seoulBoundaries from "../gu-boundaries.json";
import koreaBoundaries from "../gu-boundaries-korea.json";
import {
  AMBIGUOUS_SIGUNGU,
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
        chips: ["ramen", "bookmarked"],
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
  it("사이드 칩과 찜한 곳도 AND", () => {
    expect(
      filterPlaces([both, ramenOnly], {
        tab: "all",
        ...noChips,
        chips: ["ramen", "bookmarked"],
        bookmarkedIds: new Set([both.id]),
      }),
    ).toEqual([both]);
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

describe("matchesChips — new 칩", () => {
  it("new 칩은 신규 핀만 남긴다", () => {
    const fresh = makePlace({ id: "a", isNew: true });
    const old = makePlace({ id: "b", isNew: false });
    const picked = filterPlaces([fresh, old], {
      tab: "all",
      chips: ["new"],
      query: "",
      bookmarkedIds: new Set<string>(),
    });
    expect(picked.map((p) => p.id)).toEqual(["a"]);
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

  it("서울 밖은 시도 괄호를 떼고 시군구만", () => {
    expect(areaLabel(gu("김포시(경기)", 1), 50)).toBe("김포시");
    expect(areaLabel([...gu("김포시(경기)", 1), ...gu("고양시(경기)", 1)], 50)).toBe("고양시 일대");
  });
  it("여러 시도에 있는 이름은 시도를 앞에 붙인다 — 서울은 생략", () => {
    expect(areaLabel(gu("강서구", 1), 50)).toBe("강서구"); // 서울
    expect(areaLabel(gu("강서구(부산)", 1), 50)).toBe("부산 강서구");
    expect(areaLabel(gu("서구(광주)", 1), 50)).toBe("광주 서구");
    expect(areaLabel(gu("고성군(강원)", 1), 50)).toBe("강원 고성군");
    expect(areaLabel([...gu("서구(광주)", 2), ...gu("북구(광주)", 1)], 50)).toBe("광주 서구 일대");
    expect(areaLabel([], 50, SEOUL_VIEW, "동구(대전)")).toBe("대전 동구");
  });
  it("한 시도 대부분이면 그 시도 '전체' — 서울 전용이 아니다", () => {
    expect(areaLabel([...gu("김포시(경기)", 2), ...gu("고양시(경기)", 1)], 5)).toBe("경기 전체");
  });
  it("시도가 섞여 최다 시도가 80% 미만이면 그 시도 + 일대", () => {
    expect(areaLabel([...gu("마포구", 3), ...gu("김포시(경기)", 1)], 50)).toBe("서울 일대");
  });
  it("곁다리 시도 한둘은 무시한다 — 서울 9 + 김포 1은 여전히 서울", () => {
    const mostlySeoul = [...gu("마포구", 5), ...gu("동작구", 4), ...gu("김포시(경기)", 1)];
    expect(areaLabel(mostlySeoul, 50)).toBe("마포구 일대");
  });

  // "전국"만 뷰포트로 정한다 — 시드의 93%가 서울이라 수도권 뷰와 전국 뷰는 보이는 가게가 거의 같다
  const KOREA = { north: 38.6, south: 33.1, east: 129.6, west: 125.9 };
  const SEOUL_VIEW = { north: 37.7, south: 37.4, east: 127.2, west: 126.8 };
  it("뷰포트가 나라 규모면 '전국'", () => {
    expect(areaLabel([...gu("마포구", 3), ...gu("김포시(경기)", 1)], 50, KOREA)).toBe("전국");
  });
  it("한 축만 넓으면 '전국'이 아니다 — 가로·세로 둘 다 3° 넘어야 한다", () => {
    expect(areaLabel(gu("마포구", 3), 50, { ...KOREA, north: 37.7, south: 37.4 })).toBe("마포구");
  });
  it("좁은 뷰포트와 bounds 없음(SSR)은 분포대로", () => {
    expect(areaLabel(gu("마포구", 3), 50, SEOUL_VIEW)).toBe("마포구");
    expect(areaLabel(gu("마포구", 3), 50, undefined)).toBe("마포구");
  });

  // 0곳이면 지도 중심의 지역을 부른다 — 전국 줌아웃을 열면서 "이 지역 0곳"이 흔해졌다
  const BUSAN_WIDE = { north: 35.6, south: 34.6, east: 129.5, west: 128.3 };
  it("0곳이고 좁게 보면 중심의 시군구", () => {
    expect(areaLabel([], 50, SEOUL_VIEW, "해운대구(부산)")).toBe("해운대구");
    expect(areaLabel([], 50, SEOUL_VIEW, "마포구")).toBe("마포구");
  });
  it("0곳이고 넓게 보면 중심의 시도", () => {
    expect(areaLabel([], 50, BUSAN_WIDE, "해운대구(부산)")).toBe("부산");
  });
  it("0곳이어도 나라 규모 뷰포트면 '전국'", () => {
    expect(areaLabel([], 50, KOREA, "해운대구(부산)")).toBe("전국");
  });
  it("중심을 모르면(한국 밖·경계 파일 실패) '이 지역'", () => {
    expect(areaLabel([], 50, SEOUL_VIEW, null)).toBe("이 지역");
    expect(areaLabel([], 50, SEOUL_VIEW)).toBe("이 지역");
    expect(areaLabel([], 50)).toBe("이 지역");
  });

  it("AMBIGUOUS_SIGUNGU가 경계 파일과 일치한다 (상수가 어긋나면 여기서 잡힌다)", () => {
    const names = [seoulBoundaries, koreaBoundaries].flatMap((b) =>
      (b as { districts: { name: string }[] }).districts.map((d) => d.name),
    );
    const sidosOf = new Map<string, Set<string>>();
    for (const name of names) {
      const open = name.indexOf("(");
      const sido = open === -1 ? "서울" : name.slice(open + 1, -1);
      const sigungu = open === -1 ? name : name.slice(0, open);
      const sidos = sidosOf.get(sigungu) ?? new Set<string>();
      sidos.add(sido);
      sidosOf.set(sigungu, sidos);
    }
    const duplicated = [...sidosOf].filter(([, sidos]) => sidos.size > 1).map(([sigungu]) => sigungu);
    expect(duplicated.sort()).toEqual([...AMBIGUOUS_SIGUNGU].sort());
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
