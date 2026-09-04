import { describe, expect, it } from "vitest";
import {
  CLUSTER_MARKER_SIZE,
  PLACE_MARKER_SIZE,
  REPORT_PIN_SIZE,
  getClusterIcon,
  getPlaceMarkerIcon,
  getReportPinIcon,
  safeThumbnailUrl,
} from "../marker-icons";

/* naver.maps 없이 Size/Point만 흉내 */
class Size {
  constructor(
    public width: number,
    public height: number,
  ) {}
}
class Point {
  constructor(
    public x: number,
    public y: number,
  ) {}
}
const navermaps = { Size, Point } as unknown as typeof naver.maps;

const base = { category: "grill" as const, isNew: false, inactive: false, selected: false };

describe("safeThumbnailUrl — innerHTML에 넣어도 되는 우리 경로만", () => {
  it("루트 상대 경로는 통과", () => {
    expect(safeThumbnailUrl("/mock/thumb-1.svg")).toBe("/mock/thumb-1.svg");
    expect(safeThumbnailUrl("/photos/p018/thumb_80.webp")).toBe("/photos/p018/thumb_80.webp");
  });
  it("외부·프로토콜 상대·상위 경로·따옴표·null은 거른다", () => {
    expect(safeThumbnailUrl("https://pstatic.net/a.jpg")).toBeNull();
    expect(safeThumbnailUrl("//evil.example/a.jpg")).toBeNull();
    expect(safeThumbnailUrl("/mock/../etc")).toBeNull();
    expect(safeThumbnailUrl('/a" onerror="x')).toBeNull();
    expect(safeThumbnailUrl("mock/thumb.svg")).toBeNull();
    expect(safeThumbnailUrl(null)).toBeNull();
  });
});

describe("getPlaceMarkerIcon", () => {
  it("썸네일이 있으면 img, 없으면 색점 플레이스홀더", () => {
    const withThumb = getPlaceMarkerIcon(navermaps, { ...base, thumbnailUrl: "/mock/thumb-1.svg" });
    expect(withThumb.content).toContain('<img class="saeu-marker__img" src="/mock/thumb-1.svg"');
    const noThumb = getPlaceMarkerIcon(navermaps, { ...base, thumbnailUrl: null });
    expect(noThumb.content).toContain('<span class="saeu-marker__dot">');
    expect(noThumb.content).not.toContain("<img");
  });
  it("거른 URL은 플레이스홀더로 떨어지고 문자열이 삽입되지 않는다", () => {
    const icon = getPlaceMarkerIcon(navermaps, { ...base, thumbnailUrl: '/x" onerror="alert(1)' });
    expect(icon.content).not.toContain("onerror");
    expect(icon.content).toContain("saeu-marker__dot");
  });
  it("상태 클래스와 크기·앵커", () => {
    const icon = getPlaceMarkerIcon(navermaps, {
      category: "raw",
      isNew: true,
      inactive: true,
      selected: true,
      thumbnailUrl: null,
    });
    expect(icon.content).toContain("saeu-marker--raw");
    expect(icon.content).toContain("saeu-marker--new");
    expect(icon.content).toContain("saeu-marker--inactive");
    expect(icon.content).toContain("saeu-marker--selected");
    expect(icon.size).toEqual(new Size(PLACE_MARKER_SIZE, PLACE_MARKER_SIZE));
    expect(icon.anchor).toEqual(new Point(PLACE_MARKER_SIZE / 2, PLACE_MARKER_SIZE / 2));
  });
  it("같은 모양(썸네일 포함)은 같은 객체를 돌려준다 — 다르면 다른 객체", () => {
    const a = getPlaceMarkerIcon(navermaps, { ...base, thumbnailUrl: "/mock/thumb-1.svg" });
    const b = getPlaceMarkerIcon(navermaps, { ...base, thumbnailUrl: "/mock/thumb-1.svg" });
    const c = getPlaceMarkerIcon(navermaps, { ...base, thumbnailUrl: "/mock/thumb-2.svg" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("getClusterIcon", () => {
  it("가게 수만 숫자로 넣는다", () => {
    const icon = getClusterIcon(navermaps, 20.7);
    expect(icon.content).toBe('<div class="saeu-cluster">20</div>');
    expect(icon.size).toEqual(new Size(CLUSTER_MARKER_SIZE, CLUSTER_MARKER_SIZE));
    expect(getClusterIcon(navermaps, 20)).toBe(getClusterIcon(navermaps, 20));
  });
});

describe("getReportPinIcon — 제보 핀", () => {
  it("44px 히트 박스, 앵커는 바닥 중앙(핀 끝이 좌표), 같은 객체를 돌려준다", () => {
    const icon = getReportPinIcon(navermaps);
    expect(icon.size).toEqual(new Size(REPORT_PIN_SIZE, REPORT_PIN_SIZE));
    expect(icon.anchor).toEqual(new Point(REPORT_PIN_SIZE / 2, REPORT_PIN_SIZE));
    expect(icon.content).toContain('class="saeu-report-pin"');
    expect(icon.content).toContain("saeu-report-pin__head");
    expect(icon.content).toContain("saeu-report-pin__stem");
    expect(getReportPinIcon(navermaps)).toBe(icon);
  });
});
