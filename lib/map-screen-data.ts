import {
  getBookmarkedPlaceIds,
  getEventCard,
  getPlaces,
  getSeasonStats,
  getSession,
} from "./data";
import type { EventCard, PlaceSummary, SeasonStats, Session } from "./types";

export interface MapScreenData {
  /** 목록 요약 — 상세 전용 필드는 없다(plan perf-diet B1). 상세는 `getPlaceDetail` */
  places: PlaceSummary[];
  stats: SeasonStats;
  eventCard: EventCard | null;
  bookmarkedIds: string[];
  /** 요청의 쿠키로 읽은 세션 — SessionProvider의 초기값. 첫 로드의 `POST /`(세션 부트스트랩) 한 번이 사라진다(plan perf-diet A3) */
  session: Session;
}

/**
 * 지도 화면 서버 로더 — `/`·`/place/[id]`·`/gu/[name]`이 같은 데이터를 쓴다 (app→app import는 boundaries가 막으므로 lib에).
 * 세션은 찜 목록과 같은 쿠키(요청마다 클라이언트 인스턴스는 각각)로 병렬로 읽어 TTFB에 붙지 않는다.
 */
export async function loadMapScreenData(now: string): Promise<MapScreenData> {
  const [places, stats, eventCard, bookmarkedIds, session] = await Promise.all([
    getPlaces({}, now),
    getSeasonStats(now),
    getEventCard(now),
    getBookmarkedPlaceIds(),
    getSession(),
  ]);
  return { places, stats, eventCard, bookmarkedIds, session };
}
