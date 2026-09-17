import { describe, expect, it } from "vitest";
import { sameOriginPath } from "../safe-next";

const ORIGIN = "https://saeu-map.saeu-map.workers.dev";

describe("sameOriginPath", () => {
  it("같은 사이트 경로는 쿼리까지 그대로", () => {
    expect(sameOriginPath("/place/abc?intent=review", ORIGIN)).toBe("/place/abc?intent=review");
    expect(sameOriginPath(`${ORIGIN}/gu/마포구`, ORIGIN)).toBe("/gu/%EB%A7%88%ED%8F%AC%EA%B5%AC");
    // 퍼센트 인코딩된 백슬래시는 파서가 풀지 않는다 — 우리 사이트의 이상한 경로일 뿐, 다른 호스트가 아니다
    expect(sameOriginPath("/%5Cevil.com", ORIGIN)).toBe("/%5Cevil.com");
  });

  it("없거나 깨진 값은 홈", () => {
    expect(sameOriginPath(null, ORIGIN)).toBe("/");
    expect(sameOriginPath("", ORIGIN)).toBe("/");
    expect(sameOriginPath("http://[", ORIGIN)).toBe("/");
  });

  it("다른 호스트로 새는 모양은 전부 홈 — 백슬래시·프로토콜 상대·절대 URL·javascript:", () => {
    for (const bad of ["/\\evil.com", "//evil.com/x", "/\\/evil.com", "https://evil.com/", "javascript:alert(1)"]) {
      expect(sameOriginPath(bad, ORIGIN), bad).toBe("/");
    }
  });
});
