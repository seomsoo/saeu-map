import { ImageResponse } from "next/og";
import { OG_SIZE, ShareCard } from "@/components/og/share-card";
import { getPlaceDetail, getPlaces } from "@/lib/data";
import { ogFonts } from "@/lib/og/font";
import { markerCategory, primaryMenuLine, TAG_LABELS } from "@/lib/places";

export const alt = "새우맵 가게 공유 카드";
export const size = OG_SIZE;
export const contentType = "image/png";
/** 목록에 없는 id는 렌더하지 않고 404 — 런타임 satori 호출 경로를 남기지 않는다 */
export const dynamicParams = false;

/** 가게 전부를 빌드 시 생성(spec 4.6 핀 공유 카드). Phase 6엔 DB에서 id 목록을 읽는다 */
export async function generateStaticParams() {
  const places = await getPlaces();
  return places.map((place) => ({ id: place.id }));
}

/**
 * 핀 공유 카드 — **빌드 시 생성**. Workers Free는 요청당 CPU 10ms라 요청마다 그릴 수 없다(decisions 2026-09-07).
 * 그래서 "어제 확인" 같은 상대 시간은 넣지 않는다(배포 뒤 거짓이 된다) — 구·카테고리·상호·대표 메뉴만.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getPlaceDetail(id, Date.now());
  if (!detail) return new Response("Not found", { status: 404 });
  const { place } = detail;
  const fonts = await ogFonts();
  return new ImageResponse(
    (
      <ShareCard
        variant="place"
        name={place.name}
        meta={[place.gu, ...place.tags.map((tag) => TAG_LABELS[tag])].join(" · ")}
        menu={primaryMenuLine(place)}
        category={markerCategory(place.tags)}
      />
    ),
    { ...size, fonts },
  );
}
