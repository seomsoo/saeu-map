import type { Place } from "./types";

/**
 * 네이버 지도 링크 — 규칙 2(API 응답 저장 금지)와 무관한 순수 URL 생성.
 * 앱 스킴: NCP "지도 앱 연동 URL Scheme" (nmap://route/public?dlat&dlng&dname&appname).
 * 웹 폴백: 네이버 지도팀이 안내한 좌표 표시 링크 (map.naver.com/?lng&lat&title) — 길찾기 웹 URL은 공식 문서가 없다.
 */

type PlaceLocation = Pick<Place, "lat" | "lng" | "name">;

/** nmap appname — 앱 식별용 문자열. 웹 서비스라 도메인 이름을 쓴다. */
const APP_NAME = "saeu-map";

/** 네이버 지도 앱 대중교통 길찾기 딥링크. */
export function naverRouteAppUrl(place: PlaceLocation): string {
  return (
    `nmap://route/public?dlat=${String(place.lat)}&dlng=${String(place.lng)}` +
    `&dname=${encodeURIComponent(place.name)}&appname=${APP_NAME}`
  );
}

/** 앱이 없을 때(데스크탑·미설치) 웹 지도에서 가게 위치를 여는 링크. */
export function naverPlaceWebUrl(place: PlaceLocation): string {
  return (
    `https://map.naver.com/?lng=${String(place.lng)}&lat=${String(place.lat)}` +
    `&title=${encodeURIComponent(place.name)}`
  );
}

/** "네이버에서 사진 보기"에 허용하는 호스트 — 시드 데이터의 naverPlaceUrl만 통과시킨다(규칙 3의 링크판 방어). */
const ALLOWED_PLACE_HOSTS: ReadonlySet<string> = new Set([
  "m.place.naver.com",
  "place.naver.com",
  "map.naver.com",
  "naver.me",
]);

export function isAllowedNaverPlaceUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ALLOWED_PLACE_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

/** 모바일 브라우저면 앱 스킴을 먼저 시도할 대상. */
export function isMobileUserAgent(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod/i.test(userAgent);
}
