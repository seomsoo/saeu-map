import { describe, expect, it } from "vitest";
import { makeMenu, makePlace } from "./fixtures";
import { SEOUL_GU } from "../gu";
import {
  DEFAULT_SITE_URL,
  guDescription,
  isPreviewHost,
  guMeta,
  guTitle,
  placeDescription,
  placeMeta,
  siteUrl,
  sitemapEntries,
} from "../seo";

const NOW = "2026-09-01T12:00:00+09:00";
const nara = makePlace({
  id: "nara",
  name: "나라수산",
  gu: "마포구",
  tags: ["grill", "raw"],
  lastCheckedAt: "2026-08-31T03:00:00.000Z",
  checkCount: 3,
  menus: [makeMenu({ name: "생새우소금구이", price: 60000, unit: "kg", unit_raw: "1" })],
});

describe("핀 페이지 메타 (spec 4.6)", () => {
  it("설명은 구 · 카테고리 · 대표 메뉴 · 확인 라벨", () => {
    expect(placeDescription(nara, NOW)).toBe(
      "마포구 · 새우구이 · 생새우회 · 생새우소금구이 1kg 60,000원 · 어제 확인",
    );
  });
  it("제목은 상호(템플릿이 ' | 새우맵'을 붙인다), canonical·og:url은 /place/[id]", () => {
    const meta = placeMeta(nara, NOW);
    expect(meta.title).toBe("나라수산");
    expect(meta.alternates?.canonical).toBe("/place/nara");
    expect(meta.openGraph).toMatchObject({ title: "나라수산", url: "/place/nara" });
  });
});

describe("구 페이지 메타", () => {
  const places = [
    nara,
    makePlace({ id: "a", name: "가나수산", gu: "마포구", checkCount: 9 }),
    makePlace({ id: "b", name: "다라수산", gu: "마포구", checkCount: 0 }),
    makePlace({ id: "c", name: "마바수산", gu: "마포구", checkCount: 1 }),
  ];
  it("제목 '마포구 새우구이 4곳', 설명은 확인 많은 순 상호 3곳", () => {
    expect(guTitle("마포구", 4)).toBe("마포구 새우구이 4곳");
    expect(guDescription("마포구", places)).toBe(
      "마포구의 새우구이·생새우회 가게 4곳. 가나수산, 나라수산, 마바수산",
    );
    const meta = guMeta("마포구", places);
    expect(meta.alternates?.canonical).toBe("/gu/%EB%A7%88%ED%8F%AC%EA%B5%AC");
    // 구 카드는 파일 컨벤션이 아니라 ASCII 슬러그 라우트 — 한글 세그먼트의 정적 이미지가 404였다
    expect(meta.openGraph).toMatchObject({ images: [{ url: "/og/gu/mapo", width: 1200, height: 630 }] });
  });
  it("0곳인 구는 제보 유도 한 줄", () => {
    expect(guDescription("서초구", [])).toContain("아직 등록된 새우구이 가게가 없어요");
    expect(guMeta("서초구", []).title).toBe("서초구 새우구이 0곳");
  });
});

describe("sitemap · 사이트 URL", () => {
  it("홈 + 가게 전부 + 서울 25구. 구 URL은 퍼센트 인코딩, 가게 lastModified는 확인일", () => {
    const entries = sitemapEntries(new URL("https://saeumap.example"), [nara], NOW);
    expect(entries).toHaveLength(1 + 1 + SEOUL_GU.length);
    expect(entries[0]?.url).toBe("https://saeumap.example/");
    expect(entries[1]).toMatchObject({
      url: "https://saeumap.example/place/nara",
      lastModified: new Date("2026-08-31T03:00:00.000Z"),
    });
    expect(entries.some((e) => e.url === "https://saeumap.example/gu/%EB%A7%88%ED%8F%AC%EA%B5%AC")).toBe(true);
  });
  it("SITE_URL이 없으면 프로덕션 워커 URL", () => {
    expect(siteUrl(undefined).toString()).toBe(`${DEFAULT_SITE_URL}/`);
    expect(siteUrl("https://saeumap.kr").host).toBe("saeumap.kr");
  });
  it("프리뷰 호스트(preview-*)만 색인 금지 대상", () => {
    expect(isPreviewHost(new URL("https://preview-saeu-map.saeu-map.workers.dev"))).toBe(true);
    expect(isPreviewHost(siteUrl(undefined))).toBe(false);
    expect(isPreviewHost(new URL("https://saeumap.kr"))).toBe(false);
  });
});
