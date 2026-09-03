import { describe, expect, it } from "vitest";
import { getPlaces } from "@/lib/data";
import { shortJibun } from "../address";

describe("shortJibun", () => {
  it("시·구 접두어를 뗀다 — 바로 위 도로명이 이미 보여준 값이다", () => {
    expect(shortJibun("서울 송파구 가락동 600")).toBe("가락동 600");
    expect(shortJibun("서울 마포구 마포동 123-4")).toBe("마포동 123-4");
  });

  it("'○○동N가'도 동 이름으로 본다", () => {
    expect(shortJibun("서울 성동구 성수동1가 656-988")).toBe("성수동1가 656-988");
  });

  it("번지 뒤에 붙은 건물명·층은 지번이 아니라 크롤링 잔재라 자른다", () => {
    expect(shortJibun("서울 구로구 신도림동 400-1 금강리빙스텔 2층 팔팔수산(구로역,)")).toBe(
      "신도림동 400-1",
    );
  });

  it("산번지는 '산'까지 살린다", () => {
    expect(shortJibun("서울 종로구 평창동 산 12-3")).toBe("평창동 산 12-3");
  });

  it("모르는 형식은 원문 그대로 — 잘라서 틀린 주소를 만들지 않는다", () => {
    // 동을 찾아도 번지가 없으면 원문이다 — 끝까지 자르면 "고촌읍"이 돼 시·도가 조용히 사라진다
    expect(shortJibun("경기 김포시 고촌읍")).toBe("경기 김포시 고촌읍");
    // "N번지" 표기는 LOT에 안 걸린다(번호 뒤 글자) — 이것도 원문
    expect(shortJibun("경기 김포시 고촌읍 123번지")).toBe("경기 김포시 고촌읍 123번지");
    expect(shortJibun("주소 미확인")).toBe("주소 미확인");
  });
});

describe("목 데이터 전수", () => {
  it("모든 지번이 시·구 없이 짧아지고 원문보다 길어지지 않는다", async () => {
    const places = await getPlaces({}, "2026-09-01T12:00:00+09:00");
    const jibun = places.map((p) => p.addressJibun).filter((j): j is string => j !== null);
    expect(jibun.length).toBeGreaterThan(40);
    for (const j of jibun) {
      const short = shortJibun(j);
      expect(short.length, j).toBeLessThanOrEqual(j.length);
      expect(short, j).not.toMatch(/^서울/);
      expect(short, j).not.toMatch(/(구|시) /);
    }
  });
});
