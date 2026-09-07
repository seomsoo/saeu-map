import type { Metadata, MetadataRoute } from "next";
import { SEOUL_GU } from "./gu";
import { primaryMenuLine, TAG_LABELS } from "./places";
import { relativeCheckLabel } from "./time";
import type { Place } from "./types";

/**
 * SEO 문자열 — 순수 함수(spec 4.6). 페이지의 generateMetadata·sitemap이 부르고, 테스트는 여기만 본다.
 * **서버 전용**: siteUrl()이 t3-env server 변수를 읽는다(클라이언트 컴포넌트에서 import 금지).
 */
export const SITE_NAME = "새우맵";
export const SITE_DESCRIPTION = "서울 새우구이 지도. 다녀온 사람들의 확인과 제보로 갱신돼요";
/** 프로덕션 워커 URL — 도메인(saeumap.kr)은 Phase 7에 SITE_URL로 바꾼다 (decisions 2026-09-07) */
export const DEFAULT_SITE_URL = "https://saeu-map.saeu-map.workers.dev";

export function siteUrl(envUrl: string | undefined): URL {
  return new URL(envUrl ?? DEFAULT_SITE_URL);
}

/** 프리뷰 배포(`preview-*.workers.dev`)는 색인되면 안 된다 — robots가 전부 막는다 (security-reviewer 2026-09-07) */
export function isPreviewHost(url: URL): boolean {
  return url.hostname.startsWith("preview-");
}

export function placePath(place: Pick<Place, "id">): string {
  return `/place/${encodeURIComponent(place.id)}`;
}

export function guPath(name: string): string {
  return `/gu/${encodeURIComponent(name)}`;
}

/** 핀 페이지 설명 한 줄: "마포구 · 새우구이 · 생새우회 · 생새우소금구이 1kg 60,000원 · 어제 확인" */
export function placeDescription(place: Place, now: string): string {
  return [
    place.gu,
    ...place.tags.map((tag) => TAG_LABELS[tag]),
    primaryMenuLine(place),
    relativeCheckLabel(place.lastCheckedAt, now),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function placeMeta(place: Place, now: string): Metadata {
  const description = placeDescription(place, now);
  const path = placePath(place);
  return {
    title: place.name,
    description,
    alternates: { canonical: path },
    openGraph: { title: place.name, description, url: path, type: "website" },
  };
}

/** 구 페이지 제목: "마포구 새우구이 7곳" */
export function guTitle(name: string, count: number): string {
  return `${name} 새우구이 ${count}곳`;
}

/** 구 페이지 설명: 확인 많은 순 상호 3곳. 0곳이면 제보 유도 한 줄 */
export function guDescription(name: string, places: readonly Place[]): string {
  if (places.length === 0) {
    return `${name}에는 아직 등록된 새우구이 가게가 없어요. 아는 곳이 있다면 제보해주세요.`;
  }
  const top = [...places]
    .sort((a, b) => b.checkCount - a.checkCount || a.name.localeCompare(b.name, "ko"))
    .slice(0, 3)
    .map((p) => p.name)
    .join(", ");
  return `${name}의 새우구이·생새우회 가게 ${places.length}곳. ${top}`;
}

export function guMeta(name: string, places: readonly Place[]): Metadata {
  const title = guTitle(name, places.length);
  const description = guDescription(name, places);
  const path = guPath(name);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: "website" },
  };
}

/** sitemap: 홈 + 가게 전부(확인일이 갱신 시각) + 서울 25구(가게 0곳 포함 — 런칭 글 "구별 카드 25장"의 자리) */
export function sitemapEntries(base: URL, places: readonly Place[], now: string): MetadataRoute.Sitemap {
  const at = (path: string) => new URL(path, base).toString();
  return [
    { url: at("/"), lastModified: new Date(now), changeFrequency: "daily", priority: 1 },
    ...places.map((place) => ({
      url: at(placePath(place)),
      lastModified: new Date(place.lastCheckedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...SEOUL_GU.map((name) => ({
      url: at(guPath(name)),
      lastModified: new Date(now),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
