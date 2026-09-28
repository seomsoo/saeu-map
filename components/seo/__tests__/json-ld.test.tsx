import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JsonLd, serializeJsonLd } from "../json-ld";

describe("JsonLd — 유저 입력(상호)으로 스크립트를 탈출할 수 없다", () => {
  const hostile = { "@type": "Restaurant", name: '</script><img src=x onerror="1"> & "따옴표"' };

  it("직렬화에 <·>·&가 남지 않고 JSON.parse로 원문이 돌아온다", () => {
    const text = serializeJsonLd(hostile);
    expect(text).not.toMatch(/[<>&]/);
    expect(JSON.parse(text)).toEqual(hostile);
  });

  it("렌더 결과의 <·>는 script 태그 한 쌍뿐이다", () => {
    const html = renderToStaticMarkup(<JsonLd data={hostile} />);
    expect(html.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(html.endsWith("</script>")).toBe(true);
    expect(html.match(/</g)).toHaveLength(2);
    const inner = html.slice('<script type="application/ld+json">'.length, -"</script>".length);
    expect(JSON.parse(inner)).toEqual(hostile);
  });
});
