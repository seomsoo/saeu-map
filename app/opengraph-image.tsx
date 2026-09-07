import { ImageResponse } from "next/og";
import { OG_SIZE, ShareCard } from "@/components/og/share-card";
import { getPlaces } from "@/lib/data";
import { ogFonts } from "@/lib/og/font";

export const alt = "새우맵 — 서울 새우구이 지도";
export const size = OG_SIZE;
export const contentType = "image/png";

/**
 * 홈 공유 카드 — **빌드 시 생성**(요청 API 없음). Workers Free는 요청당 CPU 10ms라 satori+resvg를 매 요청 돌릴 수 없다
 * (decisions 2026-09-07). 가게 수는 배포 시점 값이다.
 */
export default async function Image() {
  const [places, fonts] = await Promise.all([getPlaces(), ogFonts()]);
  return new ImageResponse(<ShareCard variant="root" count={places.length} />, { ...size, fonts });
}
