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

export interface Photo {
  /** 목 단계에서는 `{placeId}-p{n}` 파생. Phase 6에서 DB uuid로 바뀐다 — 신고가 이 값을 보낸다. */
  id: string;
  /** 우리 스토리지 경로만(규칙 3). */
  url: string;
  /** 업로드 시각(UTC ISO). 뷰어 하단에 "2026.09.03"으로 찍힌다. */
  uploadedAt: string;
  /**
   * 올린 사람 — 탈퇴하면 사진은 남기고 이 값만 뗀다(제보 가게의 `reporterId`와 같은 규칙, spec 5).
   * 시드 사진에는 없다. Phase 6에서는 신고된 사진의 업로더 추적·속도 제한이 이 값을 쓴다.
   */
  uploaderId?: string;
}

/**
 * 가장 가까운 지하철역 (OSM에서 시드 시점에 구움 — scripts/add_nearest_station.py).
 * 거리는 역 중심이 아니라 **가장 가까운 출구까지의 직선거리**다(중앙값 53m 짧다).
 * 도보 경로가 아니므로 실제로 걷는 거리는 이보다 길다 — 표시는 10m 반올림.
 */
export interface NearestStation {
  /** "가락시장역" — 접미사 "역"까지 포함한 표시 이름. */
  name: string;
  /** "2" · "2-1". 출구 데이터가 없으면 null이고 이때 distanceM은 역 중심까지다. */
  exit: string | null;
  distanceM: number;
  /** 배지로 그릴 수 있는 건 숫자 호선뿐. 숫자가 없으면 ["수인·분당"]처럼 이름이 들어온다. */
  lines: string[];
}

export interface Place {
  id: string;
  name: string;
  gu: string;
  /** 도로명 주소. 제보 핀은 주소를 저장하지 않아 null(규칙 2) → 상세에 "주소를 알려주세요" 입구. */
  addressRoad: string | null;
  addressJibun: string | null;
  lat: number;
  lng: number;
  /** STATION_NEARBY_MAX_M 밖이면 null — 상세는 그 줄을 안 그리고 주소만 보여준다. */
  nearestStation: NearestStation | null;
  tags: PlaceTag[];
  specialist: boolean;
  naverPlaceUrl: string | null;
  /** 가게 사진 전부(제보·업로드 순, 최대 MAX_PLACE_PHOTOS장). 상세가 이 순서로 가로 스트립을 그린다. */
  photos: Photo[];
  /** 대표 = photos[0].url. 카드·마커가 쓴다. 없으면 null → 마커는 플레이스홀더. */
  thumbnailUrl: string | null;
  /** 영업시간 메모(제보 자유 입력, spec 4.3-4). 없으면 null → 상세에 "영업시간을 알려주세요" 입구. "영업 중" 판정은 하지 않는다(2026-09-02). */
  hoursNote: string | null;
  menus: Menu[];
  sides: Sides;
  source: "seed" | "report";
  /**
   * 운영자가 사후 확인한 시각(UTC ISO, spec 4.4·4.5). **배지일 뿐 사용자 화면을 바꾸지 않는다** —
   * 카드·마커의 "새로 제보됨"은 7일 타이머(`isNew`)이고 "새로 생겼다"는 정보지 "검증했다"가 아니다.
   */
  verifiedAt?: string;
  /**
   * 숨긴 시각(UTC ISO). 신고 3회 자동 숨김 또는 운영자 조작 — **삭제가 아니라 숨김이라 복구된다**(spec 5).
   * 사용자 읽기에서는 빠지고 관리자 화면에만 보인다.
   */
  hiddenAt?: string;
  /** 사장님 요청으로 내렸다 — 재제보 시 관리자에게 경고를 띄우는 근거(spec 5). */
  removedByOwner?: boolean;
  needsReview: boolean;
  lastCheckedAt: string;
  checkCount: number;
  isNew: boolean;
  createdAt?: string;
  /**
   * 카드·마커가 쓰는 평점 요약 — **리뷰 3개 이상일 때만** 채워진다(spec 4.2-9 "3개 미만 평균 숨김").
   * 집계는 lib/data.ts가 한다(규칙 1) — Phase 6에서 그 함수만 SQL 집계로 바뀐다.
   */
  rating?: { count: number; average: number };
  /** 제보 2단계 중복 의심에 "다른 가게예요"로 답하고 등록된 경우 그 후보 id — 관리자 큐 표시용, UI에는 안 보인다(spec 4.3-2). */
  duplicateSuspectOf?: string;
  /** 제보한 세션 userId — 내 활동 > 내 제보(spec 5). 시드는 없다. */
  reporterId?: string;
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

/** 지도 메인 토글 칩 — 사이드 3종 + 찜한 곳 = 4개 (spec 4.1 상한 5개 중, 2026-09-05 신규 칩 제거) */
/**
 * 목록·마커를 좁히는 필터. `new`는 칩 행이 아니라 **시즌 카운터의 "새로 들어온 집 N곳"**이 켠다
 * (칩 5개 상한을 안 건드리고, 숫자를 약속한 자리가 곧 그리로 가는 입구다 — 2026-09-09).
 */
export type ChipKey = keyof Sides | "bookmarked" | "new";

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
  /** 등록 7일 이내(= isNew) 가게 수 — 데스크탑 카운터 캡션의 셋째 조각 (design 화면 6 v3) */
  newPlaceCount: number;
}

export interface Review {
  /** 목 단계 "rv001"·"rv-local-1". Phase 6에서 DB uuid — 수정·삭제가 이 값을 보낸다. */
  id: string;
  placeId: string;
  /** 작성자 세션 userId — 본인 [수정][삭제] 판정(spec 5). 화면에는 안 보인다. */
  authorId: string;
  rating: number;
  text: string;
  nickname: string;
  at: string;
  /** 수정한 시각(UTC ISO). 화면에는 "수정됨"만 (spec 5). */
  editedAt?: string;
  /** 리뷰 사진. 우리 스토리지 경로만(규칙 3). 목 단계 폼은 파일을 버린다(저장소 Phase 6). */
  photoUrl?: string;
}

/** 내 활동 > 내 리뷰 행 — 리뷰 + 가게명(누르면 그 가게 상세). */
export interface MyReview extends Review {
  placeName: string;
}

export type AuthProvider = "anonymous" | "kakao";

/**
 * 세션 (spec 5 로그인). 익명이 기본이고 카카오는 선택 — 목 단계는 lib/data.ts 메모리(탭 단위, 규칙 4).
 * 익명 가능 = 다녀왔어요·제보·찜(기기 한정) / 카카오 필요 = 리뷰·내 활동.
 */
export interface Session {
  userId: string;
  provider: AuthProvider;
  /** 카카오 프로필 기본, 수정 가능. 익명은 null. */
  nickname: string | null;
  /**
   * 관리자인가 (spec 4.5 `profiles.is_admin`). 목 단계는 dev 전용 토글이고 **URL 쿼리로는 켜지 않는다** —
   * 프로덕션에서 열리면 안 된다. 프론트 체크는 장식이고 진짜 판정은 Phase 6 서버·RLS다.
   */
  isAdmin?: boolean;
}

/** 신규 패널 [정보가 달라요] 사유 — 사유 시트 4행과 1:1 (design 화면 4 변형 (a)). */
export type PlaceFlagReason = "location" | "menu" | "closed" | "other";

/** 상세의 값 제안 입구 — 필드별 수정. 즉시 반영되고 운영자가 사후에 확인한다(spec 4.2, 2026-09-08). */
export type SuggestField = "hours" | "address" | "menus" | "sides";

/**
 * 가게 신고 사유 — **이 등록 자체가 잘못됐다**(spec 5 "신고 3회 → 자동 숨김").
 * 값이 틀린 건 `PlaceFlagReason`(정보 수정 제안)이 받는다 — 그래서 "문 닫았어요"가 여기 없다.
 */
export type PlaceReportReason = "not_shrimp" | "fake" | "duplicate" | "other";

/** 사장님 요청 종류 — 게재 삭제는 1회 요청으로 즉시 처리(spec 5). */
export type OwnerRequestKind = "edit" | "remove";

/**
 * 관리자 "신고·요청" 탭에 모이는 것들 (design 화면 10-2). 넷 다 **사용자가 알려온 일감**이고
 * "열림 → 처리함/무시함"으로 흐름이 같아 한 테이블·한 탭이다(spec 6 스키마도 `reports` 하나다).
 */
export type ReportKind = "place_flag" | "place_report" | "photo_report" | "owner_request";
export type ReportStatus = "open" | "done" | "dismissed";

export interface Report {
  id: string;
  kind: ReportKind;
  placeId: string;
  /** 사진 신고만 */
  photoId?: string;
  /** 신고·제안 사유 (`PlaceFlagReason` | `PlaceReportReason` | `PhotoReportReason`) */
  reason?: string;
  /** 사장님 요청만 — 요청 종류·연락처·내용 */
  ownerKind?: OwnerRequestKind;
  contact?: string;
  message?: string;
  at: string;
  /** 낸 사람(익명 id 포함). 탈퇴하면 뗀다 — 다른 기록과 같은 규칙 */
  actor?: string;
  status: ReportStatus;
}

/**
 * 정보 수정 이력 — 영업시간·주소·메뉴·사이드는 **즉시 반영**하고 운영자가 사후에 확인한다
 * (제보의 "즉시 노출 + 24시간 내 사후 확인"과 같은 모델, decisions 2026-09-08).
 * 즉시 반영의 전제가 되돌리기라서 **바뀌기 직전 값을 통째로** 들고 있는다 — Phase 6에선 `place_edits` 테이블이다.
 */
export interface PlaceEdit {
  id: string;
  placeId: string;
  /** 반영 시각(UTC ISO) */
  at: string;
  /** 고친 사람(익명 id 포함). 탈퇴하면 뗀다 — 다른 기록과 같은 규칙 */
  actor?: string;
  /** 무엇을 고쳤나 — /admin 사후 확인 탭이 이걸 읽어 사람 문장으로 만든다 */
  field: SuggestField;
  /** 되돌리기용: 바뀌기 직전의 네 필드 */
  before: Pick<Place, "hoursNote" | "addressRoad" | "menus" | "sides">;
}

/** 상세 화면 데이터 묶음 — 가게 + 그 가게 리뷰(최신순). */
export interface PlaceDetail {
  place: Place;
  reviews: Review[];
}

/** 관리자 통계 (design 화면 10-5) — **우리 DB로 셀 수 있는 것만**. 방문자·페이지뷰는 Cloudflare가 본다. */
export interface AdminDayCount {
  /** KST 날짜 "2026.09.08" (`formatKstDate`) */
  date: string;
  reports: number;
  checkins: number;
  reviews: number;
  edits: number;
}

export interface AdminStats {
  /** 탭 배지가 읽는 숙제 수 */
  openReports: number;
  unverified: number;
  /** 오늘(KST) */
  today: AdminDayCount;
  /** 최근 14일, 오래된 날부터 */
  daily: AdminDayCount[];
  /** 참여한 사람의 종류 — actor id 접두어로 가른다(익명은 `anon-`) */
  participants: { anonymous: number; kakao: number };
  /** 확인이 많은 상위 가게 10 */
  topPlaces: { placeId: string; name: string; checkCount: number }[];
}


/* ── 까주기 테스트 (spec 8 · design 화면 11) ─────────────────────────────── */

/** 축 A 까준다↔받는다. 축 B는 `PlaceTag`와 같은 값이라(구이·회) 따로 만들지 않는다. */
export type PeelRole = "peel" | "served";
export type PeelSlug = "jipge" | "sonjil" | "wansik" | "chojang";
/** 궁합 4종 — 두 유형의 축에서 도출한다(decisions 2026-09-09). 조합 16벌 카피를 쓰지 않는다. */
export type PeelMatchKey = "R1" | "R2" | "R3" | "R4";

export interface PeelQuestion {
  id: string;
  /** 이 문항이 재는 축. 축당 3문항이라 동점이 없다. */
  axis: "role" | "taste";
  text: string;
  /** [0]이 앞쪽 값(까준다·새우구이), [1]이 뒤쪽 값(받는다·생새우회)을 민다. 짧게 — 고민이 길면 이탈한다. */
  choices: [string, string];
}

export interface PeelType {
  slug: PeelSlug;
  role: PeelRole;
  taste: PlaceTag;
  /** "묵묵히 까주는 집게형" */
  name: string;
  /** 이름 아래 한 줄 */
  tagline: string;
  description: string;
  /** 둘째 문단 — "조심할 점" */
  caution: string;
  /** 잘 맞는 유형(결과의 미니 카드) */
  partner: PeelSlug;
}

export interface PeelMatch {
  key: PeelMatchKey;
  /** 0~100. 네 단계 고정값이라 가짜 정밀도가 없다. */
  score: number;
  title: string;
  description: string;
}

/** 테스트 콘텐츠 전체 — `lib/mock/peel-test.json`이 원본이라 카피 수정이 코드 수정이 아니다. */
export interface PeelTest {
  title: string;
  subtitle: string;
  /** "20초면 끝나요" */
  duration: string;
  questions: PeelQuestion[];
  types: PeelType[];
  matches: PeelMatch[];
}
