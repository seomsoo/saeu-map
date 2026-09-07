import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import MapScreen from "@/components/map-screen/map-screen";
import { getPlaceDetail } from "@/lib/data";
import { loadMapScreenData } from "@/lib/map-screen-data";
import { placeMeta } from "@/lib/seo";

interface PlacePageProps {
  // Next 16: params는 Promise. 생성형 PageProps 헬퍼는 .next/ 산출물이라 CI typecheck(빌드 전)에서 못 쓴다.
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PlacePageProps): Promise<Metadata> {
  await connection();
  const now = new Date().toISOString();
  const { id } = await params;
  const detail = await getPlaceDetail(id, now);
  if (!detail) return { title: "가게를 찾을 수 없어요", robots: { index: false } };
  return placeMeta(detail.place, now);
}

/**
 * /place/[id] — 같은 지도 화면을 해당 가게가 열린 상태로 렌더 (공유 링크 → 핀 열림, CLAUDE.md UI 완성 기준).
 * SSR 메타·OG는 generateMetadata·opengraph-image.tsx. **없는 id는 진짜 404** — 이 세그먼트엔 loading.tsx(Suspense)가 없어
 * notFound()가 스트리밍 전에 던져진다(홈의 로딩 스켈레톤은 route group `(home)`에 있다 — decisions 2026-09-07).
 */
export default async function PlacePage({ params }: PlacePageProps) {
  await connection();
  const now = new Date().toISOString();
  const { id } = await params;

  const detail = await getPlaceDetail(id, now);
  if (!detail) notFound();

  const data = await loadMapScreenData(now);
  return <MapScreen now={now} {...data} initialPlaceId={detail.place.id} initialDetail={detail} />;
}
