import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { OG_SIZE, ShareCard } from "@/components/og/share-card";
import { getPlaces } from "@/lib/data";
import { isSeoulGu } from "@/lib/gu";
import { ogFonts } from "@/lib/og/font";

export const alt = "새우맵 구별 공유 카드";
export const size = OG_SIZE;
export const contentType = "image/png";

/** 구별 카드 (spec 4.6 "구별 카드 25장"). 서울 25구 밖은 404 */
export default async function Image({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  let gu: string;
  try {
    gu = decodeURIComponent(name);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!isSeoulGu(gu)) return new Response("Not found", { status: 404 });
  await connection();
  const now = new Date().toISOString();
  const [places, fonts] = await Promise.all([getPlaces({ gu }, now), ogFonts()]);
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
    { ...size, fonts },
  );
}
