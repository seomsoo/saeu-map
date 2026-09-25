/**
 * JSON-LD 한 블록 (plan seo-crawlability 2). **서버 컴포넌트에서만** 쓴다 — 데이터는 lib/seo.ts의 순수 객체.
 *
 * `<script>`의 **텍스트 자식**으로 넣는다. React DOM은 script 자식을 이스케이프하지 않는다(`renderToStaticMarkup` 실측 2026-09-25)
 * — 그래서 `dangerouslySetInnerHTML`이 필요 없고(규칙 6), 대신 `</script>` 탈출을 우리가 막는다: JSON.stringify 뒤
 * `<`·`>`·`&`를 유니코드 이스케이프로 바꾼다(JSON 문자열 안에서 같은 값이다). 상호·메뉴는 유저 입력이다.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json">{serializeJsonLd(data)}</script>;
}
