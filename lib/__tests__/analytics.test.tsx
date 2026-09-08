import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";

// next/script는 로딩 전략을 실제로 태우므로 테스트에선 평범한 태그로 바꾼다
vi.mock("next/script", () => ({
  default: ({ src, children, ...rest }: { src?: string; children?: string }) => (
    <script data-src={src} {...rest}>
      {children}
    </script>
  ),
}));

describe("GA4 배선", () => {
  it("측정 ID가 없으면 아무것도 붙이지 않는다 — dev·프리뷰 수집 0", () => {
    const { container } = render(<GoogleAnalytics measurementId={undefined} />);
    expect(container.querySelectorAll("script")).toHaveLength(0);
  });

  it("ID가 있으면 gtag 로더와 config 두 줄", () => {
    const { container } = render(<GoogleAnalytics measurementId="G-ABC123" />);
    const scripts = [...container.querySelectorAll("script")];
    expect(scripts).toHaveLength(2);
    expect(scripts[0]?.getAttribute("data-src")).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-ABC123",
    );
    expect(scripts[1]?.textContent).toContain("gtag('config','G-ABC123')");
    // 첫 화면이 그려진 뒤에 받는다 — LCP 예산(error 12s)을 지킨다
    expect(scripts.every((s) => s.getAttribute("strategy") === "lazyOnload")).toBe(true);
  });
});
