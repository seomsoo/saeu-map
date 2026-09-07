import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { OG_SIZE, ShareCard } from "@/components/og/share-card";
import { getPlaceDetail } from "@/lib/data";
import { ogFonts } from "@/lib/og/font";
import { markerCategory, primaryMenuLine, TAG_LABELS } from "@/lib/places";
import { relativeCheckLabel } from "@/lib/time";

export const alt = "새우맵 가게 공유 카드";
export const size = OG_SIZE;
export const contentType = "image/png";

/** 핀 공유 카드 (spec 4.6). 없는 id는 404 — 페이지와 같은 판정 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const now = new Date().toISOString();
  const { id } = await params;
  const detail = await getPlaceDetail(id, now);
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
        freshness={`${relativeCheckLabel(place.lastCheckedAt, now)} · 확인 ${place.checkCount}회`}
        category={markerCategory(place.tags)}
      />
    ),
    { ...size, fonts },
  );
}
