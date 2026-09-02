export interface Menu {
  raw: string;
  name: string;
  price: number | null;
  unit: "kg" | "g" | "pan" | "count" | "size" | "serving" | "none";
  unit_raw: string | null;
}

export interface Sides {
  headButter: boolean;
  ramen: boolean;
  friedRice: boolean;
}

export type PlaceTag = "grill" | "raw";

export interface Place {
  id: string;
  name: string;
  gu: string;
  addressRoad: string;
  addressJibun: string | null;
  lat: number;
  lng: number;
  tags: PlaceTag[];
  specialist: boolean;
  naverPlaceUrl: string | null;
  /** 가게 사진 전부(제보·업로드 순). 우리 스토리지 경로만(규칙 3). 상세가 이 순서로 가로 스트립을 그린다. */
  photoUrls: string[];
  /** 대표 = photoUrls[0]. 카드·마커가 쓴다. 없으면 null → 마커는 플레이스홀더. */
  thumbnailUrl: string | null;
  /** 영업시간 메모(제보 자유 입력, spec 4.3-4). 없으면 null → 상세에 "영업시간을 알려주세요" 입구. "영업 중" 판정은 하지 않는다(2026-09-02). */
  hoursNote: string | null;
  menus: Menu[];
  sides: Sides;
  source: "seed" | "report";
  needsReview: boolean;
  lastCheckedAt: string;
  checkCount: number;
  isNew: boolean;
  createdAt?: string;
}

export interface Checkin {
  placeId: string;
  type: "visited" | "menu_verified";
  at: string;
  actor: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface BoundsLiteral {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** 지도 카메라 상태 (naver 객체가 아닌 plain literal — lib·테스트에서 그대로 사용). */
export interface Viewport {
  bounds: BoundsLiteral;
  zoom: number;
  center: LatLng;
}

/** 지도 메인 탭: 다중 태그 매칭 */
export type TabKey = "all" | "grill" | "raw";

/** 지도 메인 토글 칩 — 사이드 3종 + 새로 들어온 집 + 찜한 곳 = 5개 (spec 4.1 상한) */
export type ChipKey = keyof Sides | "new" | "bookmarked";

/** 정렬: 가까운순(기본) / 최근 확인순 / 확인 많은 순 */
export type SortKey = "distance" | "recent" | "checks";

/** 이벤트 카드 슬롯 설정값 (spec 4.1: 제목·링크·기간을 설정값으로) */
export interface EventCard {
  id: string;
  title: string;
  /** 제목 아래 한 줄(설정값). 없으면 제목만 */
  description: string | null;
  href: string | null;
  startsAt: string;
  endsAt: string;
}

/** 시즌 카운터 (checkins 이벤트에서 계산) */
export interface SeasonStats {
  /** 이번 주(월 00:00 KST~) 확인이 있었던 가게 수 */
  weekPlaceCount: number;
  /** 오늘(KST) 확인 건수 */
  todayCheckinCount: number;
  /** 이번 주 최다 확인 가게 (없으면 null) */
  topPlace: { id: string; name: string; count: number } | null;
}

export interface Review {
  placeId: string;
  rating: number;
  text: string;
  nickname: string;
  at: string;
  /** 리뷰 사진. 우리 스토리지 경로만(규칙 3). 업로드는 Phase 4 리뷰 폼에서. */
  photoUrl?: string;
}

/** 상세 화면 데이터 묶음 — 가게 + 그 가게 리뷰(최신순). */
export interface PlaceDetail {
  place: Place;
  reviews: Review[];
}
