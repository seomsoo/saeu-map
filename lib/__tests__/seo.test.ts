import { describe, expect, it } from "vitest";
import { makeMenu, makePlace } from "./fixtures";
import { SEOUL_GU } from "../gu";
import { PEEL_SLUGS } from "../peel-test";
import {
  DEFAULT_SITE_URL,
  displayOrigin,
  guDescription,
  guFullLabel,
  guJsonLd,
  homeMeta,
  isPreviewHost,
  guMeta,
  guTitle,
  legalMeta,
  placeDescription,
  placeJsonLd,
  placeMeta,
  placeOgImagePath,
  placeTitle,
  siteJsonLd,
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
  it("설명은 도로명 주소 · 카테고리 · 대표 메뉴 · 확인 라벨 — 주소 없는 제보 핀은 구", () => {
    expect(placeDescription(nara, NOW)).toBe(
      "서울 마포구 마포대로 1 · 새우구이 · 생새우회 · 생새우소금구이 1kg 60,000원 · 어제 확인",
    );
    expect(placeDescription({ ...nara, addressRoad: null }, NOW)).toBe(
      "마포구 · 새우구이 · 생새우회 · 생새우소금구이 1kg 60,000원 · 어제 확인",
    );
  });
  it("제목은 '상호 · 구 카테고리'(템플릿이 ' | 새우맵'을 붙인다), og:title은 상호만, canonical·og:url은 /place/[id]", () => {
    const meta = placeMeta(nara, NOW);
    expect(meta.title).toBe("나라수산 · 마포구 새우구이");
    expect(meta.alternates?.canonical).toBe("/place/nara");
    expect(meta.openGraph).toMatchObject({ title: "나라수산", url: "/place/nara", siteName: "새우맵", locale: "ko_KR" });
  });
  it("서울 밖은 시도를 앞에, 회만 파는 집은 생새우회", () => {
    expect(guFullLabel("수영구(부산)")).toBe("부산 수영구");
    expect(guFullLabel("서초구")).toBe("서초구");
    expect(placeTitle({ ...nara, gu: "수영구(부산)", tags: ["raw"] })).toBe("나라수산 · 부산 수영구 생새우회");
  });
});

describe("홈·약관 메타 (prod 실측 2026-09-25 — canonical·og:image가 빠져 있었다)", () => {
  it("홈은 canonical '/' + og:url + 루트 카드", () => {
    const meta = homeMeta();
    expect(meta.alternates?.canonical).toBe("/");
    expect(meta.openGraph).toMatchObject({ url: "/", siteName: "새우맵", images: [{ url: "/opengraph-image", width: 1200, height: 630 }] });
  });
  it("약관·방침은 루트 카드를 명시한다(파일 컨벤션은 페이지 openGraph에 덮인다)", () => {
    const meta = legalMeta("/privacy", "개인정보처리방침", "설명");
    expect(meta.alternates?.canonical).toBe("/privacy");
    expect(meta.openGraph).toMatchObject({ url: "/privacy", siteName: "새우맵", images: [{ url: "/opengraph-image" }] });
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
  it("홈 + 가게 전부 + 서울 25구 + 까주기 테스트 5장 + 약관·방침. 구 URL은 퍼센트 인코딩, 가게 lastModified는 확인일", () => {
    const entries = sitemapEntries(new URL("https://saeumap.example"), [nara], NOW);
    // 홈 1 + 가게 1 + 구 25 + 테스트 표지 1 + 유형 결과 4 (초대·궁합 20개는 noindex라 빠진다) + 약관·방침 2
    expect(entries).toHaveLength(1 + 1 + SEOUL_GU.length + 1 + PEEL_SLUGS.length + 2);
    expect(entries.some((e) => e.url === "https://saeumap.example/privacy")).toBe(true);
    expect(entries.some((e) => e.url === "https://saeumap.example/terms")).toBe(true);
    expect(entries[0]?.url).toBe("https://saeumap.example/");
    expect(entries[1]).toMatchObject({
      url: "https://saeumap.example/place/nara",
      lastModified: new Date("2026-08-31T03:00:00.000Z"),
    });
    expect(entries.some((e) => e.url === "https://saeumap.example/gu/%EB%A7%88%ED%8F%AC%EA%B5%AC")).toBe(true);
    expect(entries.some((e) => e.url === "https://saeumap.example/test")).toBe(true);
    expect(entries.some((e) => e.url === "https://saeumap.example/test/jipge")).toBe(true);
    // 초대·궁합은 공유 링크로만 산다 — 사이트맵에 없다
    expect(entries.some((e) => e.url.includes("/test/with/"))).toBe(false);
    expect(entries.some((e) => e.url === "https://saeumap.example/test/jipge/wansik")).toBe(false);
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

  it("핀 공유 카드는 빌드 때 있던 가게만 — 배포 뒤 생긴 핀은 루트 카드로 폴백(plan 결정 18)", () => {
    const buildAt = "2026-09-10T00:00:00Z";
    expect(placeOgImagePath({ id: "old", createdAt: "2026-09-01T00:00:00Z" }, buildAt)).toBe("/og/place/old");
    expect(placeOgImagePath({ id: "new", createdAt: "2026-09-11T00:00:00Z" }, buildAt)).toBe("/opengraph-image");
    expect(placeOgImagePath({ id: "dev", createdAt: "2026-09-11T00:00:00Z" }, undefined)).toBe("/og/place/dev");
    expect(placeMeta(nara, NOW).openGraph).toMatchObject({ images: [{ url: `/og/place/${nara.id}`, width: 1200, height: 630 }] });
  });

  it("공유 링크만 한글 도메인 — 실서비스 origin(퓨니코드)은 새우맵.kr로, 프리뷰·로컬은 그대로(2026-09-17)", () => {
    expect(displayOrigin("https://xn--r02bv8jvof.kr")).toBe("https://새우맵.kr");
    expect(displayOrigin("https://www.xn--r02bv8jvof.kr")).toBe("https://새우맵.kr");
    expect(displayOrigin("https://preview-saeu-map.saeu-map.workers.dev")).toBe("https://preview-saeu-map.saeu-map.workers.dev");
    expect(displayOrigin("http://localhost:3000")).toBe("http://localhost:3000");
    expect(DEFAULT_SITE_URL).toBe("https://xn--r02bv8jvof.kr");
  });
});

describe("JSON-LD (plan seo-crawlability 2)", () => {
  const base = new URL("https://saeumap.example");
  it("홈은 WebSite", () => {
    expect(siteJsonLd(base)).toMatchObject({ "@type": "WebSite", name: "새우맵", url: "https://saeumap.example/" });
  });
  it("상세는 Restaurant — 주소·좌표·카테고리, 평점·네이버 링크·사진은 있을 때만", () => {
    const ld = placeJsonLd(nara, base, NOW);
    expect(ld).toMatchObject({
      "@type": "Restaurant",
      name: "나라수산",
      url: "https://saeumap.example/place/nara",
      servesCuisine: ["새우구이", "생새우회"],
      address: {
        "@type": "PostalAddress",
        streetAddress: "서울 마포구 마포대로 1",
        addressLocality: "마포구",
        addressRegion: "서울",
        addressCountry: "KR",
      },
      geo: { "@type": "GeoCoordinates", latitude: 37.54, longitude: 126.95 },
    });
    expect(ld).not.toHaveProperty("aggregateRating");
    expect(ld).not.toHaveProperty("sameAs");
    expect(ld).not.toHaveProperty("image");
    const rated = placeJsonLd(
      {
        ...nara,
        gu: "수영구(부산)",
        addressRoad: null,
        rating: { count: 4, average: 4.5 },
        naverPlaceUrl: "https://map.naver.com/p/1",
        thumbnailUrl: "/photos/a.webp",
      },
      base,
      NOW,
    );
    expect(rated).toMatchObject({
      address: { addressLocality: "수영구", addressRegion: "부산" },
      aggregateRating: { ratingValue: 4.5, reviewCount: 4, bestRating: 5 },
      sameAs: ["https://map.naver.com/p/1"],
      image: "https://saeumap.example/photos/a.webp",
    });
    expect(rated.address).not.toHaveProperty("streetAddress");
  });
  it("구는 빵부스러기 + 확인 많은 순 ItemList", () => {
    const [crumbs, list] = guJsonLd(
      "마포구",
      [nara, makePlace({ id: "a", name: "가나수산", gu: "마포구", checkCount: 9 })],
      base,
    );
    expect(crumbs).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { position: 1, item: "https://saeumap.example/" },
        { position: 2, name: "마포구 새우구이 2곳", item: "https://saeumap.example/gu/%EB%A7%88%ED%8F%AC%EA%B5%AC" },
      ],
    });
    expect(list).toMatchObject({
      "@type": "ItemList",
      numberOfItems: 2,
      itemListElement: [
        { position: 1, name: "가나수산", url: "https://saeumap.example/place/a" },
        { position: 2, name: "나라수산" },
      ],
    });
  });
});
