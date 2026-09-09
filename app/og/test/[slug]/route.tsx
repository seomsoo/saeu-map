import { ImageResponse } from "next/og";
import { OG_SIZE, ShareCard, type ShareCardProps } from "@/components/og/share-card";
import { getPeelTest } from "@/lib/data";
import { ogArt, shrimpPotArt } from "@/lib/og/art";
import { ogFonts } from "@/lib/og/font";
import { PEEL_SLUGS, isPeelSlug, matchKey, typeOgArtFile } from "@/lib/peel-test";
import type { PeelTest } from "@/lib/types";

/** 슬러그 25개 밖은 렌더하지 않고 404 — 런타임 satori 경로를 남기지 않는다 */
export const dynamicParams = false;

/**
 * 표지 1 + 유형 4 + 궁합 초대 4 + 궁합 결과 16 = **25장을 빌드 시 생성**한다.
 * 구별 카드와 같은 이유(Workers Free는 요청당 CPU 10ms — decisions 2026-09-07).
 */
export function generateStaticParams() {
  return [
    { slug: "intro" },
    ...PEEL_SLUGS.map((slug) => ({ slug })),
    ...PEEL_SLUGS.map((slug) => ({ slug: `with-${slug}` })),
    ...PEEL_SLUGS.flatMap((a) => PEEL_SLUGS.map((b) => ({ slug: `${a}-${b}` }))),
  ];
}

/**
 * 아트를 뺀 카드 — 슬러그 판정이 폰트·아트 로드보다 먼저다(security-reviewer 2026-09-09).
 * `artFile`은 그 카드가 쓸 PNG(유형 카드는 그 유형의 캐릭터, 표지·궁합은 냄비 새우).
 */
type TestCard = Omit<Extract<ShareCardProps, { variant: "test" }>, "art"> & { artFile?: string };

/** `intro` · `jipge` · `with-jipge` · `jipge-wansik` 네 모양을 한 라우트가 받는다. 유형 슬러그에는 `-`가 없다. */
function cardFor(content: PeelTest, slug: string): TestCard | null {
  const typeOf = (value: string) =>
    isPeelSlug(value) ? (content.types.find((t) => t.slug === value) ?? null) : null;

  if (slug === "intro") {
    return {
      variant: "test",
      eyebrow: content.title,
      title: content.ogIntroTitle,
      sub: `${content.subtitle}. ${content.duration}`,
    };
  }

  const invited = slug.startsWith("with-") ? typeOf(slug.slice("with-".length)) : null;
  if (invited) {
    return {
      variant: "test",
      eyebrow: content.invite.ogEyebrow,
      title: invited.name,
      sub: content.invite.subtitle,
      artFile: typeOgArtFile(invited.slug),
    };
  }

  const [first, second] = slug.split("-");
  if (first && second) {
    const mine = typeOf(first);
    const partner = typeOf(second);
    if (!mine || !partner) return null;
    const match = content.matches.find((m) => m.key === matchKey(mine, partner));
    if (!match) return null;
    return {
      variant: "test",
      eyebrow: content.title,
      title: match.title,
      sub: `${mine.name}과 ${partner.name}`,
      score: match.score,
    };
  }

  const type = typeOf(slug);
  return type
    ? {
        variant: "test",
        eyebrow: content.title,
        title: type.name,
        sub: type.tagline,
        artFile: typeOgArtFile(type.slug),
      }
    : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // 슬러그부터 판정한다(구 카드 라우트와 같은 순서) — 모르는 슬러그에 폰트·아트를 태우지 않는다
  const card = cardFor(await getPeelTest(), slug);
  if (!card) return new Response("Not found", { status: 404 });
  const { artFile, ...props } = card;
  const [fonts, art] = await Promise.all([
    ogFonts(),
    artFile ? ogArt(artFile) : shrimpPotArt(),
  ]);
  return new ImageResponse(<ShareCard {...props} art={art} />, { ...OG_SIZE, fonts });
}
