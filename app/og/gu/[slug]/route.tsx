import { ImageResponse } from "next/og";
import { OG_SIZE, ShareCard } from "@/components/og/share-card";
import { getPlaces } from "@/lib/data";
import { GU_SLUGS, guFromSlug } from "@/lib/gu";
import { ogFonts } from "@/lib/og/font";

/** 슬러그 25개 밖은 렌더하지 않고 404 — 런타임 satori 경로를 남기지 않는다 */
export const dynamicParams = false;

/** 25구 전부 빌드 시 생성 (spec 4.6 "구별 카드 25장") */
export function generateStaticParams() {
  return Object.values(GU_SLUGS).map((slug) => ({ slug }));
}

/**
 * 구별 공유 카드 `/og/gu/mapo` — **빌드 시 생성**(Workers Free CPU 10ms/요청). `gu/[name]/opengraph-image` 파일 컨벤션은
 * 프리렌더 키(디코딩 한글)와 요청 경로(퍼센트 인코딩)가 어긋나 정적 서빙에서 404라 ASCII 슬러그 라우트로 두고
 * `lib/seo.ts guMeta`가 og:image로 가리킨다 (decisions 2026-09-07). 가게 수·상호는 배포 시점 값.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gu = guFromSlug(slug);
  if (!gu) return new Response("Not found", { status: 404 });
  const [places, fonts] = await Promise.all([getPlaces({ gu }), ogFonts()]);
  const names =
    places.length === 0
      ? null
      : [...places]
          .sort((a, b) => b.checkCount - a.checkCount || a.name.localeCompare(b.name, "ko"))
          .slice(0, 3)
          .map((p) => p.name)
          .join(", ");
  return new ImageResponse(
    <ShareCard variant="gu" name={gu} count={places.length} names={names} />,
    { ...OG_SIZE, fonts },
  );
}
