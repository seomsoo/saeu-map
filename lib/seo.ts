import type { Metadata, MetadataRoute } from "next";
import { guSlug, SEOUL_GU } from "./gu";
import { primaryMenuLine, TAG_LABELS } from "./places";
import { relativeCheckLabel } from "./time";
import type { PeelMatch, PeelSlug, PeelTest, PeelType, Place } from "./types";

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

/** 구별 OG 카드 경로 — ASCII 슬러그 라우트(app/og/gu/[slug]/route.tsx). 모르는 구면 null */
export function guOgImagePath(name: string): string | null {
  const slug = guSlug(name);
  return slug ? `/og/gu/${slug}` : null;
}

export function guMeta(name: string, places: readonly Place[]): Metadata {
  const title = guTitle(name, places.length);
  const description = guDescription(name, places);
  const path = guPath(name);
  const image = guOgImagePath(name);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: "website",
      // 파일 컨벤션 대신 명시 — 한글 세그먼트의 프리렌더 이미지가 정적 서빙에서 404였다 (decisions 2026-09-07)
      ...(image && { images: [{ url: image, width: 1200, height: 630, alt: `${name} 새우구이 공유 카드` }] }),
    },
  };
}

/* ── 까주기 테스트 (spec 8 · design 화면 11) ─────────────────────────────── */

export function peelTypePath(slug: PeelSlug): string {
  return `/test/${slug}`;
}

/** 궁합 초대 링크 — 이걸 공유하면 친구가 풀고 궁합으로 떨어진다(decisions 2026-09-09) */
export function peelInvitePath(slug: PeelSlug): string {
  return `/test/with/${slug}`;
}

export function peelMatchPath(a: PeelSlug, b: PeelSlug): string {
  return `/test/${a}/${b}`;
}

export function peelTestMeta(content: PeelTest): Metadata {
  const description = `${content.subtitle}. ${content.duration}`;
  return {
    title: content.title,
    description,
    alternates: { canonical: "/test" },
    openGraph: { title: content.title, description, url: "/test", type: "website" },
  };
}

export function peelTypeMeta(type: PeelType): Metadata {
  const description = `${type.tagline}. ${type.description}`;
  const path = peelTypePath(type.slug);
  return {
    title: type.name,
    description,
    alternates: { canonical: path },
    openGraph: { title: type.name, description, url: path, type: "website" },
  };
}

/**
 * 초대·궁합은 **공유 링크로만 사는 얇은 페이지**라 색인하지 않는다(decisions 2026-09-09).
 * OG는 그대로 붙는다 — 색인과 공유 카드는 다른 문제다.
 */
export function peelInviteMeta(type: PeelType): Metadata {
  const title = `${type.name}과 궁합 보기`;
  const description = "질문 6개를 풀면 둘의 궁합이 나와요";
  return {
    title,
    description,
    robots: { index: false, follow: true },
    openGraph: { title, description, url: peelInvitePath(type.slug), type: "website" },
  };
}

export function peelMatchMeta(a: PeelType, b: PeelType, match: PeelMatch): Metadata {
  const title = `${a.name}과 ${b.name}의 궁합 ${match.score}`;
  const description = `${match.title}. ${match.description}`;
  return {
    title,
    description,
    robots: { index: false, follow: true },
    openGraph: { title, description, url: peelMatchPath(a.slug, b.slug), type: "website" },
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
