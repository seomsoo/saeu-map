import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ShareCard } from "../share-card";

/** satori 없이 — 카드에 들어가는 글자만 본다 (그리는 건 프리뷰 curl로 확인) */
describe("ShareCard — 공유 카드 4종의 텍스트", () => {
  it("핀: 메타 · 상호 · 대표 메뉴 · 브랜드 (상대 시간은 없다 — 빌드 시 굽는 카드)", () => {
    const html = renderToStaticMarkup(
      <ShareCard
        variant="place"
        name="나라수산"
        meta="마포구 · 새우구이 · 생새우회"
        menu="생새우소금구이 1kg 60,000원"
        category="grill"
      />,
    );
    for (const text of ["나라수산", "마포구 · 새우구이 · 생새우회", "생새우소금구이 1kg 60,000원", "새우맵"]) {
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
  it("테스트: 유형 카드는 아트, 궁합 카드는 점수 원", () => {
    const art = "data:image/png;base64,iVBORw0KGgo=";
    const type = renderToStaticMarkup(
      <ShareCard
        variant="test"
        eyebrow="새우 까주기 테스트"
        title="묵묵히 까주는 집게형"
        sub="불판 앞을 안 떠나는 사람"
        art={art}
      />,
    );
    expect(type).toContain("묵묵히 까주는 집게형");
    expect(type).toContain(art);

    const match = renderToStaticMarkup(
      <ShareCard
        variant="test"
        eyebrow="새우 까주기 테스트"
        title="이보다 잘 맞기 어렵다"
        sub="묵묵히 까주는 집게형과 머리까지 남기지 않는 완식형"
        art={art}
        score={100}
      />,
    ).replaceAll("<!-- -->", "");
    expect(match).toContain("이보다 잘 맞기 어렵다");
    expect(match).toContain("100");
    // 점수가 있으면 아트 대신 레드 원이다
    expect(match).not.toContain(art);
  });
  it("루트: 새우맵 · 가게 N곳", () => {
    expect(renderToStaticMarkup(<ShareCard variant="root" count={41} art="data:image/png;base64,iVBORw0KGgo=" />).replaceAll("<!-- -->", "")).toContain("가게 41곳");
  });
});
