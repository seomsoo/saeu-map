import { describe, expect, it } from "vitest";

import {
  findDuplicate,
  findNameMatches,
  normalizeName,
  samePlace,
  similarityRatio,
} from "../duplicates";
import { makePlace } from "./fixtures";

// 기대값은 python3 difflib.SequenceMatcher(None, a, b).ratio()로 뽑았다(collect.py와 같은 기준).
const PYTHON_RATIOS: Array<[string, string, number]> = [
  ["나라수산", "나라수산본점", 0.8],
  ["수성2호왕새우소금구이", "수성왕새우소금구이", 0.9],
  ["365활새우창우수산", "창우수산365활새우", 0.6],
  ["청춘조개포차신촌점", "청춘조개포차홍대점", 0.7777777777777778],
  ["abcxyz", "xyzabc", 0.5],
  ["왕새우", "새우왕", 0.6666666666666666],
];

describe("normalizeName", () => {
  it("collect.py norm_name처럼 공백·기호를 떼고 소문자로", () => {
    expect(normalizeName("Nara Susan")).toBe("narasusan");
    expect(normalizeName("강남조개구이&어촌")).toBe("강남조개구이어촌");
    expect(normalizeName("(주)나라·수산, 본-점.")).toBe("주나라수산본점");
  });
});

describe("similarityRatio", () => {
  it.each(PYTHON_RATIOS)("difflib 패리티 %s vs %s", (a, b, ratio) => {
    expect(similarityRatio(a, b)).toBeCloseTo(ratio, 12);
    expect(similarityRatio(b, a)).toBeCloseTo(ratio, 12);
  });

  it("같으면 1, 빈 문자열끼리도 1, 겹치는 글자가 없으면 0", () => {
    expect(similarityRatio("나라수산", "나라수산")).toBe(1);
    expect(similarityRatio("", "")).toBe(1);
    expect(similarityRatio("가나", "다라")).toBe(0);
  });
});

describe("samePlace", () => {
  const here = { lat: 37.54, lng: 126.95 };

  it("150m 안이고 상호가 포함 관계면 같은 가게", () => {
    expect(
      samePlace({ name: "나라수산", ...here }, { name: "나라수산 본점", ...here }),
    ).toBe(true);
  });

  it("150m 안이고 ratio가 0.85 이상이면 같은 가게", () => {
    expect(
      samePlace(
        { name: "수성2호왕새우소금구이", ...here },
        { name: "수성왕새우소금구이", lat: 37.5405, lng: 126.95 },
      ),
    ).toBe(true);
  });

  it("150m 안이라도 상호가 다르면(ratio 0.78) 다른 가게", () => {
    expect(
      samePlace(
        { name: "청춘조개포차 신촌점", ...here },
        { name: "청춘조개포차 홍대점", ...here },
      ),
    ).toBe(false);
  });

  it("상호가 같아도 150m 밖이면 다른 가게 (프랜차이즈)", () => {
    expect(
      samePlace({ name: "나라수산", ...here }, { name: "나라수산", lat: 37.542, lng: 126.95 }),
    ).toBe(false);
  });
});

describe("findDuplicate", () => {
  it("같은 가게로 보이는 것 중 가장 가까운 곳", () => {
    const far = makePlace({ name: "나라수산", lat: 37.541, lng: 126.95 });
    const near = makePlace({ name: "나라수산 본점", lat: 37.5402, lng: 126.95 });
    const other = makePlace({ name: "청춘조개포차", lat: 37.54, lng: 126.95 });
    expect(
      findDuplicate({ name: "나라수산", lat: 37.54, lng: 126.95 }, [far, other, near]),
    ).toBe(near);
  });

  it("없으면 null", () => {
    const place = makePlace({ name: "나라수산", lat: 37.6, lng: 126.95 });
    expect(findDuplicate({ name: "나라수산", lat: 37.54, lng: 126.95 }, [place])).toBeNull();
  });
});

describe("findNameMatches", () => {
  const places = [
    makePlace({ name: "나라수산 본점" }),
    makePlace({ name: "우리나라새우" }),
    makePlace({ name: "나라수산" }),
    makePlace({ name: "청춘조개포차" }),
  ];

  it("두 글자부터 맞추고 닮은 순으로, 동률은 원래 순서", () => {
    expect(findNameMatches("나", places)).toEqual([]);
    expect(findNameMatches("나라", places).map((p) => p.name)).toEqual([
      "나라수산",
      "나라수산 본점",
      "우리나라새우",
    ]);
  });

  it("질의도 정규화한다 (공백·기호 무시)", () => {
    expect(findNameMatches("나라 수산", places).map((p) => p.name)).toEqual([
      "나라수산",
      "나라수산 본점",
    ]);
  });

  it("최대 5곳", () => {
    const many = Array.from({ length: 7 }, (_, i) => makePlace({ name: `새우집${i}` }));
    expect(findNameMatches("새우집", many)).toHaveLength(5);
  });
});
