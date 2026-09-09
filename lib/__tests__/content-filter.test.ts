import { describe, expect, it } from "vitest";
import { hasBannedWord, hasUrl, isCleanText } from "../content-filter";

describe("content-filter — 링크·욕설만 막고 나머지는 통과", () => {
  it("URL은 형태를 바꿔도 잡는다", () => {
    expect(hasUrl("https://example.com")).toBe(true);
    expect(hasUrl("www.naver.com 보세요")).toBe(true);
    expect(hasUrl("문의 saeu-map.kr")).toBe(true);
    expect(hasUrl("배달은 baemin.app/x")).toBe(true);
  });
  it("주소·메뉴·시간은 안 잡는다", () => {
    for (const s of ["서울 마포구 마포대로 1", "가락동 600", "23:00 라스트오더, 월 휴무", "새우소금구이 1kg 60,000", "3~4인 세트"]) {
      expect(hasUrl(s), s).toBe(false);
    }
  });
  it("욕설은 띄어쓰기·기호·전각을 넘어 잡고, 일상어는 통과", () => {
    expect(hasBannedWord("시 발 진짜")).toBe(true);
    expect(hasBannedWord("ㅅ.ㅂ")).toBe(true);
    expect(hasBannedWord("씨-발")).toBe(true);
    expect(hasBannedWord("씨\uFF0D발")).toBe(true); // 전각 하이픈은 NFKC가 "-"로 접는다
    for (const s of ["새우가 실했어요", "머리버터구이 꼭", "웨이팅 있음", "발 편한 신발"]) {
      expect(hasBannedWord(s), s).toBe(false);
    }
  });
  it("isCleanText는 둘 다 통과해야 true", () => {
    expect(isCleanText("대하 크기가 실했어요")).toBe(true);
    expect(isCleanText("여기 좆같음")).toBe(false);
    expect(isCleanText("자세한 건 www.x.com")).toBe(false);
  });
});
