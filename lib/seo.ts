import type { Metadata, MetadataRoute } from "next";
import { LEGAL_EFFECTIVE_DATE } from "./legal";
import { guSlug, SEOUL_GU } from "./gu";
import { PEEL_SLUGS, peelInvitePath, peelMatchPath, peelTypePath } from "./peel-test";
import { checkLabel, markerCategory, primaryMenuLine, TAG_LABELS } from "./places";
import type { PeelMatch, PeelTest, PeelType, Place } from "./types";

/**
 * SEO 문자열 — 순수 함수(spec 4.6). 페이지의 generateMetadata·sitemap이 부르고, 테스트는 여기만 본다.
 * **서버 전용**: siteUrl()이 t3-env server 변수를 읽는다(클라이언트 컴포넌트에서 import 금지).
 */
export const SITE_NAME = "새우맵";
export const SITE_DESCRIPTION = "전국 새우구이 지도. 다녀온 사람들의 확인과 제보로 갱신돼요";
/**
 * 모든 페이지의 `openGraph`에 스프레드한다. 페이지의 `openGraph`는 레이아웃 것을 **통째로** 덮어(Next는 얕은 병합)
 * 상세·구·테스트·약관에 og:site_name·og:locale이 빠져 있었다(prod 실측 2026-09-25).
 */
const OG_BASE = { siteName: SITE_NAME, type: "website", locale: "ko_KR" } as const;
/** 루트 공유 카드(app/opengraph-image.tsx). 홈·약관·배포 뒤 생긴 핀이 쓴다 — 파일 컨벤션은 페이지 `openGraph`에 덮이므로 명시 */
const ROOT_OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: `${SITE_NAME} — 전국 새우구이 지도` };

/** 홈 — canonical·og:url이 없어 workers.dev 호스트·쿼리 변형이 중복 후보였다(prod 실측 2026-09-25). 제목은 레이아웃 기본(새우맵) */
export function homeMeta(): Metadata {
  return {
    alternates: { canonical: "/" },
    openGraph: { ...OG_BASE, title: SITE_NAME, description: SITE_DESCRIPTION, url: "/", images: [ROOT_OG_IMAGE] },
  };
}
/**
 * 실서비스 도메인 `새우맵.kr`(2026-09-17). 기계용 표기는 퓨니코드 `xn--r02bv8jvof.kr` — canonical·og:url·sitemap·콜백 URL은 이걸 쓴다
 * (URL 객체가 어차피 이 형태로 바꾼다). 사람에게 보여 주는 링크(공유·복사)만 `displayOrigin`으로 한글 표기.
 * 프리뷰·workers.dev는 SITE_URL 변수로 덮는다(ci.yml·wrangler.jsonc vars).
 */
export const SITE_HOST = "xn--r02bv8jvof.kr";
export const SITE_HOST_DISPLAY = "새우맵.kr";
export const DEFAULT_SITE_URL = `https://${SITE_HOST}`;

export function siteUrl(envUrl: string | undefined): URL {
  return new URL(envUrl ?? DEFAULT_SITE_URL);
}

/** 브라우저의 `location.origin`은 퓨니코드로 나온다 — 카톡·복사로 나가는 링크는 `https://새우맵.kr`로 바꿔 준다. 다른 호스트(프리뷰·로컬)는 그대로 */
export function displayOrigin(origin: string): string {
  try {
    const u = new URL(origin);
    if (u.hostname === SITE_HOST || u.hostname === `www.${SITE_HOST}`) return `https://${SITE_HOST_DISPLAY}`;
  } catch {
    /* 이상한 origin은 그대로 */
  }
  return origin;
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

/**
 * 핀 페이지 설명 한 줄: "서울 마포구 마포대로 1 · 새우구이 · 생새우회 · 생새우소금구이 1kg 60,000원 · 어제 확인".
 * 첫 조각은 **도로명 주소**(없는 제보 핀은 구) — 검색 스니펫·AI 답변의 1순위 지역 신호인데 HTML 본문엔 접힘 뒤라 없었다(2026-09-25).
 */
export function placeDescription(place: Place, now: string): string {
  return [
    place.addressRoad ?? place.gu,
    ...place.tags.map((tag) => TAG_LABELS[tag]),
    primaryMenuLine(place),
    checkLabel(place, now),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * 핀 공유 카드 경로 — 카드는 빌드 시 생성(Workers Free CPU 10ms → 요청 시 satori 불가)이라 **빌드 때 있던 가게만 카드가 있다**.
 * 배포 뒤 생긴 핀(제보)은 루트 카드로(plan 결정 18). BUILD_AT은 next.config가 박는다 — 없으면(dev·테스트) 전부 있는 것으로 본다.
 */
export function placeOgImagePath(place: Pick<Place, "id" | "createdAt">, buildAt: string | undefined = process.env.BUILD_AT): string {
  const prerendered =
    buildAt === undefined || place.createdAt === undefined || Date.parse(place.createdAt) <= Date.parse(buildAt);
  return prerendered ? `/og/place/${place.id}` : "/opengraph-image";
}

/** "서초구" · "부산 수영구" — `Place.gu`는 서울이면 구 이름만, 밖이면 "수영구(부산)"(decisions 2026-09-04). 검색 제목엔 시도를 앞에 */
export function guFullLabel(gu: string): string {
  const open = gu.indexOf("(");
  if (open === -1 || !gu.endsWith(")")) return gu;
  return `${gu.slice(open + 1, -1)} ${gu.slice(0, open)}`;
}

/** 검색 결과 제목 "풍천가 서초직영점 · 서초구 새우구이" — 지역·카테고리 키워드(네이버). og:title은 상호만(카톡 카드) */
export function placeTitle(place: Place): string {
  return `${place.name} · ${guFullLabel(place.gu)} ${TAG_LABELS[markerCategory(place.tags)]}`;
}

export function placeMeta(place: Place, now: string): Metadata {
  const description = placeDescription(place, now);
  const path = placePath(place);
  return {
    title: placeTitle(place),
    description,
    alternates: { canonical: path },
    openGraph: {
      title: place.name,
      description,
      url: path,
      ...OG_BASE,
      images: [{ url: placeOgImagePath(place), width: 1200, height: 630, alt: `${place.name} 공유 카드` }],
    },
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
      ...OG_BASE,
      // 파일 컨벤션 대신 명시 — 한글 세그먼트의 프리렌더 이미지가 정적 서빙에서 404였다 (decisions 2026-09-07)
      ...(image && { images: [{ url: image, width: 1200, height: 630, alt: `${name} 새우구이 공유 카드` }] }),
    },
  };
}

/* ── 까주기 테스트 (spec 8 · design 화면 11) ─────────────────────────────── */

/**
 * 테스트 공유 카드 — 한 라우트가 `intro`·유형·`with-유형`·`유형-유형` 25장을 빌드 시 굽는다
 * (app/og/test/[slug]/route.tsx, decisions 2026-09-09).
 */
export function peelOgImagePath(slug: string): string {
  return `/og/test/${slug}`;
}

function peelOgImage(slug: string, alt: string) {
  return { images: [{ url: peelOgImagePath(slug), width: 1200, height: 630, alt }] };
}

export function peelTestMeta(content: PeelTest): Metadata {
  const description = `${content.subtitle}. ${content.duration}`;
  return {
    title: content.title,
    description,
    alternates: { canonical: "/test" },
    openGraph: {
      title: content.title,
      description,
      url: "/test",
      ...OG_BASE,
      ...peelOgImage("intro", `${content.title} 공유 카드`),
    },
  };
}

export function peelTypeMeta(type: PeelType): Metadata {
  const description = `${type.tagline}. ${type.description}`;
  const path = peelTypePath(type.slug);
  return {
    title: type.name,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: type.name,
      description,
      url: path,
      ...OG_BASE,
      ...peelOgImage(type.slug, `${type.name} 공유 카드`),
    },
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
    openGraph: {
      title,
      description,
      url: peelInvitePath(type.slug),
      ...OG_BASE,
      ...peelOgImage(`with-${type.slug}`, `${type.name} 궁합 신청 카드`),
    },
  };
}

export function peelMatchMeta(a: PeelType, b: PeelType, match: PeelMatch): Metadata {
  const title = `${a.name}과 ${b.name}의 궁합 ${match.score}`;
  const description = `${match.title}. ${match.description}`;
  return {
    title,
    description,
    robots: { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: peelMatchPath(a.slug, b.slug),
      ...OG_BASE,
      ...peelOgImage(`${a.slug}-${b.slug}`, "궁합 공유 카드"),
    },
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
    // 까주기 테스트 표지 + 유형 결과 4장. 초대·궁합 20개는 공유 링크로만 사는 얇은 페이지라 뺀다(noindex)
    { url: at("/test"), lastModified: new Date(now), changeFrequency: "monthly" as const, priority: 0.5 },
    ...PEEL_SLUGS.map((slug) => ({
      url: at(peelTypePath(slug)),
      lastModified: new Date(now),
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
    // 약관·방침 — 시행일이 곧 갱신일(design 화면 12 (b))
    ...LEGAL_PATHS.map((path) => ({
      url: at(path),
      lastModified: new Date(LEGAL_EFFECTIVE_DATE),
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];
}

const LEGAL_PATHS = ["/privacy", "/terms"] as const;

/** 약관·방침 메타 — 제목은 루트 템플릿(`%s | 새우맵`)이 붙인다. OG 카드는 루트 카드를 **명시**(파일 컨벤션은 여기 `openGraph`에 덮여 안 붙었다, prod 실측 2026-09-25) */
export function legalMeta(path: (typeof LEGAL_PATHS)[number], title: string, description: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...OG_BASE, title, description, url: path, images: [ROOT_OG_IMAGE] },
  };
}
