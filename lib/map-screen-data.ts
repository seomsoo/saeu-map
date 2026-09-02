import {
  getBookmarkedPlaceIds,
  getEventCard,
  getPlaces,
  getSeasonStats,
} from "./data";
import type { EventCard, Place, SeasonStats } from "./types";

export interface MapScreenData {
  places: Place[];
  stats: SeasonStats;
  eventCard: EventCard | null;
  bookmarkedIds: string[];
}

/** 지도 화면 서버 로더 — `/`와 `/place/[id]`가 같은 데이터를 쓴다 (app→app import는 boundaries가 막으므로 lib에). */
export async function loadMapScreenData(now: string): Promise<MapScreenData> {
  const [places, stats, eventCard, bookmarkedIds] = await Promise.all([
    getPlaces({}, now),
    getSeasonStats(now),
    getEventCard(now),
    getBookmarkedPlaceIds(),
  ]);
  return { places, stats, eventCard, bookmarkedIds };
}
