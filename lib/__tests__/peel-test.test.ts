import { describe, expect, it } from "vitest";
import { getPeelMatchPlaces, getPeelTest, getPeelType, getPeelTypePlaces } from "../data";
import { PEEL_PLACE_COUNT, PEEL_SLUGS, TYPE_ART, decodePeelSlug, isPeelSlug, matchKey, scoreAnswers } from "../peel-test";
import type { PeelSlug } from "../types";

const NOW = "2026-09-09T03:00:00.000Z";

const content = await getPeelTest();

/** 축 A는 1·3·5번, 축 B는 2·4·6번. 0이 앞쪽(까준다·구이), 1이 뒤쪽(받는다·회)을 민다. */
function answers(role: 0 | 1, taste: 0 | 1): number[] {
  return content.questions.map((q) => (q.axis === "role" ? role : taste));
}

describe("콘텐츠 — 카피를 고쳐도 구조는 지켜져야 한다", () => {
  it("문항 6개가 축마다 3개씩(홀수라 동점이 없다)", () => {
    expect(content.questions).toHaveLength(6);
    expect(content.questions.filter((q) => q.axis === "role")).toHaveLength(3);
    expect(content.questions.filter((q) => q.axis === "taste")).toHaveLength(3);
    for (const q of content.questions) expect(q.choices).toHaveLength(2);
  });

  it("축을 연달아 묻지 않는다 — 채점이 티 나지 않게 교차 배치", () => {
    const axes = content.questions.map((q) => q.axis);
    for (let i = 1; i < axes.length; i += 1) expect(axes[i]).not.toBe(axes[i - 1]);
  });

  it("유형 4개가 축 조합을 하나씩 덮는다", () => {
    expect(content.types.map((t) => t.slug)).toEqual([...PEEL_SLUGS]);
    const axes = content.types.map((t) => `${t.role}-${t.taste}`);
    expect(new Set(axes).size).toBe(4);
  });

  it("잘 맞는 유형은 실재하고 자기 자신이 아니다", () => {
    for (const type of content.types) {
      expect(isPeelSlug(type.partner)).toBe(true);
      expect(type.partner).not.toBe(type.slug);
    }
  });

  it("궁합 4종이 다 있고 점수가 0~100이다", () => {
    expect(content.matches.map((m) => m.key)).toEqual(["R1", "R2", "R3", "R4"]);
    for (const m of content.matches) expect(m.score).toBeGreaterThanOrEqual(0);
    for (const m of content.matches) expect(m.score).toBeLessThanOrEqual(100);
  });

  it("유형마다 아트 자리가 있다", () => {
    for (const slug of PEEL_SLUGS) expect(TYPE_ART[slug]).toMatch(/^\/[\w\-./]+$/);
  });

  it("UI 문장을 em dash·가운데 점으로 잇지 않는다 (spec 7 카피 톤)", () => {
    const lines = [
      content.title,
      content.subtitle,
      content.duration,
      ...content.questions.flatMap((q) => [q.text, ...q.choices]),
      ...content.types.flatMap((t) => [t.name, t.tagline, t.description, t.caution]),
      ...content.matches.flatMap((m) => [m.title, m.description]),
    ];
    for (const line of lines) expect(line).not.toMatch(/[—·]/);
  });
});

describe("scoreAnswers — 축마다 많은 쪽", () => {
  it.each([
    [0, 0, "jipge"],
    [0, 1, "sonjil"],
    [1, 0, "wansik"],
    [1, 1, "chojang"],
  ] as const)("role=%i taste=%i → %s", (role, taste, slug) => {
    expect(scoreAnswers(content.questions, answers(role, taste))).toBe(slug);
  });

  it("한 문항만 반대로 골라도 다수결이라 유형이 안 바뀐다", () => {
    const mixed = answers(0, 0);
    mixed[0] = 1;
    expect(scoreAnswers(content.questions, mixed)).toBe("jipge");
  });

  it("덜 답했으면 답한 만큼만 센다", () => {
    expect(scoreAnswers(content.questions, [1, 1])).toBe("chojang");
  });
});

describe("matchKey — 궁합은 축에서 도출한다", () => {
  const typeOf = (slug: PeelSlug) => {
    const type = content.types.find((t) => t.slug === slug);
    if (!type) throw new Error(slug);
    return type;
  };

  it.each([
    ["jipge", "wansik", "R1"],
    ["sonjil", "chojang", "R1"],
    ["jipge", "chojang", "R2"],
    ["sonjil", "wansik", "R2"],
    ["jipge", "sonjil", "R3"],
    ["jipge", "jipge", "R3"],
    ["wansik", "chojang", "R4"],
    ["chojang", "chojang", "R4"],
  ] as const)("%s × %s → %s", (a, b, key) => {
    expect(matchKey(typeOf(a), typeOf(b))).toBe(key);
  });

  it("16조합 전부가 R1~R4로 떨어지고 순서를 바꿔도 같다", () => {
    for (const a of PEEL_SLUGS) {
      for (const b of PEEL_SLUGS) {
        const key = matchKey(typeOf(a), typeOf(b));
        expect(["R1", "R2", "R3", "R4"]).toContain(key);
        expect(matchKey(typeOf(b), typeOf(a))).toBe(key);
        expect(content.matches.find((m) => m.key === key)).toBeDefined();
      }
    }
  });
});

describe("슬러그", () => {
  it("네 개만 통과한다", () => {
    for (const slug of PEEL_SLUGS) expect(decodePeelSlug(slug)).toBe(slug);
    expect(decodePeelSlug("with")).toBeNull();
    expect(decodePeelSlug("집게형")).toBeNull();
    expect(decodePeelSlug("%ED%8A%B8")).toBeNull();
  });

  it("깨진 인코딩도 던지지 않고 null이다", () => {
    expect(decodePeelSlug("%E0%A4%A")).toBeNull();
  });
});

describe("추천 가게 — lib/data.ts 경유 (규칙 1)", () => {
  it("유형별로 3곳, 축 B에 맞는 카테고리만", async () => {
    for (const slug of PEEL_SLUGS) {
      const type = await getPeelType(slug);
      const places = await getPeelTypePlaces(slug, NOW);
      expect(places).toHaveLength(PEEL_PLACE_COUNT);
      for (const place of places) expect(place.tags).toContain(type?.taste);
    }
  });

  it("까주는 쪽과 받는 쪽의 추천이 다르다 — 축 A가 순위를 가른다", async () => {
    const peel = await getPeelTypePlaces("jipge", NOW);
    const served = await getPeelTypePlaces("wansik", NOW);
    expect(peel.map((p) => p.id)).not.toEqual(served.map((p) => p.id));
  });

  it("까주는 쪽 1위는 사이드가 있는 집, 받는 쪽 1위는 전문점", async () => {
    const [peel] = await getPeelTypePlaces("jipge", NOW);
    const [served] = await getPeelTypePlaces("wansik", NOW);
    expect(Object.values(peel?.sides ?? {}).some(Boolean)).toBe(true);
    expect(served?.specialist).toBe(true);
  });

  it("없는 유형은 빈 목록", async () => {
    expect(await getPeelTypePlaces("nope" as PeelSlug, NOW)).toEqual([]);
  });
});

describe("궁합 추천", () => {
  it("취향이 갈리면 구이·회를 둘 다 하는 집을 뽑는다", async () => {
    const places = await getPeelMatchPlaces("jipge", "chojang", NOW);
    expect(places).toHaveLength(PEEL_PLACE_COUNT);
    for (const place of places) {
      expect(place.tags).toContain("grill");
      expect(place.tags).toContain("raw");
    }
  });

  it("취향이 같으면 그 카테고리에서 뽑는다", async () => {
    const places = await getPeelMatchPlaces("jipge", "wansik", NOW);
    for (const place of places) expect(place.tags).toContain("grill");
  });

  it("순서를 바꿔도 같은 집이 나온다", async () => {
    const ab = await getPeelMatchPlaces("sonjil", "wansik", NOW);
    const ba = await getPeelMatchPlaces("wansik", "sonjil", NOW);
    expect(ab.map((p) => p.id)).toEqual(ba.map((p) => p.id));
  });
});
