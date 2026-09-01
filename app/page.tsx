import { connection } from "next/server";
import MapScreen from "@/components/map-screen/map-screen";
import {
  getBookmarkedPlaceIds,
  getEventCard,
  getPlaces,
  getSeasonStats,
} from "@/lib/data";

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  // 요청 시 렌더: "오늘"·"이번 주"·"○일 전"이 빌드 시각에 얼어붙지 않게 (decisions.md 2026-09-01)
  await connection();
  const now = new Date().toISOString();

  // dev 전용: 라우트 에러 상태(app/error.tsx) 확인용 — ?mock=error
  const params = await searchParams;
  if (process.env.NODE_ENV !== "production" && params["mock"] === "error") {
    throw new Error("mock error (dev only)");
  }

  const [places, stats, eventCard, bookmarkedIds] = await Promise.all([
    getPlaces({}, now),
    getSeasonStats(now),
    getEventCard(now),
    getBookmarkedPlaceIds(),
  ]);

  return (
    <MapScreen
      now={now}
      places={places}
      stats={stats}
      eventCard={eventCard}
      bookmarkedIds={bookmarkedIds}
    />
  );
}
