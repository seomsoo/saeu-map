import { notFound } from "next/navigation";
import { connection } from "next/server";
import MapScreen from "@/components/map-screen/map-screen";
import { getPlaceDetail } from "@/lib/data";
import { loadMapScreenData } from "@/lib/map-screen-data";

interface PlacePageProps {
  // Next 16: params는 Promise. 생성형 PageProps 헬퍼는 .next/ 산출물이라 CI typecheck(빌드 전)에서 못 쓴다.
  params: Promise<{ id: string }>;
}

/**
 * 얕은 /place/[id] — 같은 지도 화면을 해당 가게가 열린 상태로 렌더 (공유 링크 → 핀 열림, CLAUDE.md UI 완성 기준).
 * SSR 메타·OG·진짜 404는 Phase 5. 없는 id는 루트 loading.tsx 스트리밍 때문에 200 + not-found UI + noindex (decisions 2026-09-02).
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
