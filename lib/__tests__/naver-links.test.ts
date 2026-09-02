import { describe, expect, it } from "vitest";
import {
  isAllowedNaverPlaceUrl,
  isMobileUserAgent,
  naverPlaceWebUrl,
  naverRouteAppUrl,
} from "../naver-links";

const place = { lat: 37.5445, lng: 127.0501, name: "뚝섬포구 & 회" };

describe("naverRouteAppUrl — nmap 스킴 (NCP URL Scheme)", () => {
  it("목적지 좌표·이름·appname, 이름은 URL 인코딩", () => {
    const url = naverRouteAppUrl(place);
    expect(url.startsWith("nmap://route/public?")).toBe(true);
    expect(url).toContain("dlat=37.5445");
    expect(url).toContain("dlng=127.0501");
    expect(url).toContain(`dname=${encodeURIComponent("뚝섬포구 & 회")}`);
    expect(url).not.toContain("&dname=뚝섬포구 &");
    expect(url).toContain("appname=saeu-map");
  });
});

describe("naverPlaceWebUrl — 앱 없을 때 웹 폴백", () => {
  it("https map.naver.com 좌표 표시 링크", () => {
    const url = new URL(naverPlaceWebUrl(place));
    expect(url.hostname).toBe("map.naver.com");
    expect(url.searchParams.get("lat")).toBe("37.5445");
    expect(url.searchParams.get("lng")).toBe("127.0501");
    expect(url.searchParams.get("title")).toBe("뚝섬포구 & 회");
  });
});

describe("isAllowedNaverPlaceUrl — 외부 링크 호스트 화이트리스트", () => {
  it("네이버 플레이스만 통과", () => {
    expect(isAllowedNaverPlaceUrl("https://m.place.naver.com/restaurant/1/home")).toBe(true);
    expect(isAllowedNaverPlaceUrl("https://map.naver.com/p/entry/place/1")).toBe(true);
  });
  it("다른 호스트·http·스킴 장난·null은 거부", () => {
    expect(isAllowedNaverPlaceUrl("https://evil.example/naver.com")).toBe(false);
    expect(isAllowedNaverPlaceUrl("http://m.place.naver.com/restaurant/1")).toBe(false);
    expect(isAllowedNaverPlaceUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedNaverPlaceUrl("https://m.place.naver.com.evil.example/")).toBe(false);
    expect(isAllowedNaverPlaceUrl(null)).toBe(false);
    expect(isAllowedNaverPlaceUrl("not a url")).toBe(false);
  });
});

describe("isMobileUserAgent", () => {
  it("iOS·Android만 true", () => {
    expect(isMobileUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isMobileUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe(true);
    expect(isMobileUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBe(false);
  });
});
