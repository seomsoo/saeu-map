import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { OG_SIZE, ShareCard } from "@/components/og/share-card";
import { getPlaces } from "@/lib/data";
import { ogFonts } from "@/lib/og/font";

export const alt = "새우맵 — 서울 새우구이 지도";
export const size = OG_SIZE;
export const contentType = "image/png";

/** 홈 공유 카드 — 지금 가게 수. 요청 시 렌더(수가 빌드에 얼어붙지 않게) */
export default async function Image() {
  await connection();
  const now = new Date().toISOString();
  const [places, fonts] = await Promise.all([getPlaces({}, now), ogFonts()]);
  return new ImageResponse(<ShareCard variant="root" count={places.length} />, { ...size, fonts });
}
