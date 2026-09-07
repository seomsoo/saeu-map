import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import MapScreen from "@/components/map-screen/map-screen";
import { getGuCenter, getPlaces } from "@/lib/data";
import { SEOUL_CENTER } from "@/lib/geo";
import { isSeoulGu } from "@/lib/gu";
import { loadMapScreenData } from "@/lib/map-screen-data";
import { guMeta } from "@/lib/seo";

interface GuPageProps {
  params: Promise<{ name: string }>;
}

/** URL 세그먼트(퍼센트 인코딩된 한글) → 서울 25구 이름. 그 밖(비서울·오타·깨진 인코딩)은 null → 404 */
function decodeGu(raw: string): string | null {
  try {
    const name = decodeURIComponent(raw);
    return isSeoulGu(name) ? name : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: GuPageProps): Promise<Metadata> {
  const { name } = await params;
  const gu = decodeGu(name);
  if (!gu) return { title: "찾을 수 없는 지역이에요", robots: { index: false } };
  await connection();
  const now = new Date().toISOString();
  return guMeta(gu, await getPlaces({ gu }, now));
}

/**
 * /gu/[name] — 서울 25구 SSR 페이지(spec 4.6). 별도 화면이 아니라 같은 지도 화면을 그 구에 맞춰 연다:
 * 지도는 그 구 가게로 fitBounds(0곳이면 구 중심), 목록은 서버가 그 구 가게를 미리 채운다(크롤러가 상호를 읽는다).
 * 지도가 첫 idle을 보고하면 뷰포트 기준으로 자연히 전환된다. 서울 밖은 404 (decisions 2026-09-07).
 */
export default async function GuPage({ params }: GuPageProps) {
  const { name } = await params;
  const gu = decodeGu(name);
  if (!gu) notFound();
  await connection();
  const now = new Date().toISOString();
  const [data, center] = await Promise.all([loadMapScreenData(now), getGuCenter(gu)]);
  return <MapScreen now={now} {...data} initialGu={{ name: gu, center: center ?? SEOUL_CENTER }} />;
}
