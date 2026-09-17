import { ImageResponse } from "next/og";
import { OG_SIZE, ShareCard } from "@/components/og/share-card";
import { getPlaceDetail, getPlaces } from "@/lib/data";
import { ogFonts } from "@/lib/og/font";
import { markerCategory, primaryMenuLine, TAG_LABELS } from "@/lib/places";

/** 빌드 때 있던 가게 밖은 렌더하지 않고 404 — 런타임 satori 호출 경로를 남기지 않는다 */
export const dynamicParams = false;

/** 가게 전부를 빌드 시 생성(spec 4.6 핀 공유 카드). DB에서 id 목록을 읽는다 */
export async function generateStaticParams() {
  const places = await getPlaces();
  return places.map((place) => ({ id: place.id }));
}

/**
 * 핀 공유 카드 `/og/place/<uuid>` — **빌드 시 생성**. Workers Free는 요청당 CPU 10ms라 요청마다 그릴 수 없다(decisions 2026-09-07).
 * 그래서 "어제 확인" 같은 상대 시간은 넣지 않는다(배포 뒤 거짓이 된다) — 구·카테고리·상호·대표 메뉴만.
 * `place/[id]/opengraph-image` 파일 컨벤션 대신 라우트인 이유: 파일 컨벤션은 og:image를 늘 자기 세그먼트로 박아 **배포 뒤 생긴 핀은 404**가 된다.
 * `lib/seo.ts placeOgImagePath`가 빌드 시각(BUILD_AT) 뒤의 핀은 루트 카드로 보낸다(plan 결정 18, 갭 스윕 2026-09-16 #7).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getPlaceDetail(id, new Date().toISOString());
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
    { ...OG_SIZE, fonts },
  );
}
