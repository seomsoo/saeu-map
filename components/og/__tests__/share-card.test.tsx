import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ShareCard } from "../share-card";

/** satori 없이 — 카드에 들어가는 글자만 본다 (그리는 건 프리뷰 curl로 확인) */
describe("ShareCard — 공유 카드 3종의 텍스트", () => {
  it("핀: 메타 · 상호 · 대표 메뉴 · 확인 라벨 · 브랜드", () => {
    const html = renderToStaticMarkup(
      <ShareCard
        variant="place"
        name="나라수산"
        meta="마포구 · 새우구이 · 생새우회"
        menu="생새우소금구이 1kg 60,000원"
        freshness="어제 확인 · 확인 4회"
        category="grill"
      />,
    );
    for (const text of ["나라수산", "마포구 · 새우구이 · 생새우회", "생새우소금구이 1kg 60,000원", "어제 확인 · 확인 4회", "새우맵"]) {
      expect(html).toContain(text);
    }
    expect(html).toContain("#F0885C"); // 구이 = 코랄 링
  });
  it("구: 이름 · N곳 · 상호 3곳 / 0곳이면 상호 줄 없음", () => {
    expect(renderToStaticMarkup(<ShareCard variant="gu" name="마포구" count={7} names="나라수산, 어수선, 동피랑" />))
      .toContain("나라수산, 어수선, 동피랑");
    const empty = renderToStaticMarkup(<ShareCard variant="gu" name="서초구" count={0} names={null} />);
    expect(empty.replaceAll("<!-- -->", "")).toContain("새우구이 0곳");
  });
  it("루트: 새우맵 · 지금 N곳", () => {
    expect(renderToStaticMarkup(<ShareCard variant="root" count={41} />).replaceAll("<!-- -->", "")).toContain("지금 41곳");
  });
});
