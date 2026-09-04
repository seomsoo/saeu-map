import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { makeMenu, makePlace } from "@/lib/__tests__/fixtures";
import type { Place } from "@/lib/types";
import type { ReportInput } from "@/lib/data";
import MapScreen from "../map-screen";

/* ── react-naver-maps 전체를 가짜로. 지도 SDK 없이 화면 동작만 검증한다. ── */
const fake = vi.hoisted(() => {
  class LatLng {
    constructor(
      private readonly _lat: number,
      private readonly _lng: number,
    ) {}
    lat() {
      return this._lat;
    }
    lng() {
      return this._lng;
    }
    get x() {
      return this._lng;
    }
    get y() {
      return this._lat;
    }
  }
  class LatLngBounds {
    constructor(
      private readonly sw: LatLng,
      private readonly ne: LatLng,
    ) {}
    getNE() {
      return this.ne;
    }
    getSW() {
      return this.sw;
    }
  }
  class Size {
    constructor(
      public width: number,
      public height: number,
    ) {}
  }
  class Point {
    constructor(
      public x: number,
      public y: number,
    ) {}
  }
  /* 지오코더 서브모듈 — 테스트가 geocode.mockImplementation으로 응답을 정한다 */
  const Service = { Status: { OK: 200, ERROR: 500 }, geocode: vi.fn() };
  const navermaps = { LatLng, LatLngBounds, Size, Point, Service };
  /* useListener로 단 핸들러 — 테스트가 지도 이벤트(click 등)를 직접 쏜다 */
  const listeners: Record<string, (e: unknown) => void> = {};
  const map = {
    getBounds: () => new LatLngBounds(new LatLng(37.4, 126.8), new LatLng(37.7, 127.2)),
    getZoom: () => 12,
    getCenter: () => new LatLng(37.55, 127.0),
    panTo: vi.fn(),
    morph: vi.fn(),
    fitBounds: vi.fn(),
    setZoom: vi.fn(),
    getSize: () => new Size(390, 844),
    getProjection: () => ({
      fromCoordToOffset: () => new Point(195, 400),
      fromOffsetToCoord: (p: Point) => new LatLng(p.y, p.x),
    }),
  };
  return { navermaps, map, listeners };
});

// lib/data는 진짜(찜 토글은 클라이언트 메모리)지만, 쓰기 checkIn만 가짜 — 시드 가게는 목 JSON에 없다
const dataMocks = vi.hoisted(() => ({
  checkIn: vi.fn<(id: string, now: string) => Promise<Place>>(),
  submitReport: vi.fn<(input: unknown, now: string) => Promise<Place>>(),
}));
vi.mock("@/lib/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data")>()),
  checkIn: dataMocks.checkIn,
  submitReport: dataMocks.submitReport,
}));

vi.mock("react-naver-maps", () => ({
  NavermapsProvider: ({ children }: { children: ReactNode }) => children,
  Container: ({ children }: { children: ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  NaverMap: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Marker: ({
    title,
    onClick,
    position,
    defaultPosition,
  }: {
    title: string;
    onClick?: () => void;
    position?: { lat: number; lng: number };
    defaultPosition?: { lat: number; lng: number };
  }) => (
    <button
      type="button"
      data-testid="marker"
      data-lat={(position ?? defaultPosition)?.lat}
      data-lng={(position ?? defaultPosition)?.lng}
      onClick={onClick}
    >
      {title}
    </button>
  ),
  useMap: () => fake.map,
  useNavermaps: () => fake.navermaps,
  useListener: (_target: unknown, event: string, handler: (e: unknown) => void) => {
    fake.listeners[event] = handler;
  },
}));

const NOW = "2026-09-01T12:00:00+09:00";
const day = (d: number) => new Date(Date.parse(NOW) - d * 86_400_000).toISOString();

function seed(): Place[] {
  return [
    makePlace({
      id: "nara",
      name: "나라수산",
      gu: "마포구",
      lat: 37.54,
      lng: 126.95,
      tags: ["grill", "raw"],
      lastCheckedAt: day(1),
      checkCount: 3,
      sides: { headButter: true, ramen: true, friedRice: false },
      menus: [makeMenu({ name: "생새우소금구이", price: 60000, unit: "kg", unit_raw: "1" })],
    }),
    makePlace({
      id: "changwoo",
      name: "365활새우 창우수산",
      gu: "영등포구",
      lat: 37.52,
      lng: 126.9,
      tags: ["grill"],
      lastCheckedAt: day(21),
      checkCount: 0,
    }),
    makePlace({
      id: "suseong",
      name: "수성2호왕새우소금구이",
      gu: "관악구",
      lat: 37.48,
      lng: 126.95,
      tags: ["grill"],
      isNew: true,
      createdAt: day(2),
      lastCheckedAt: day(2),
      checkCount: 0,
    }),
    makePlace({
      id: "hana",
      name: "노량진수산시장 하나수산",
      gu: "동작구",
      addressJibun: "서울 동작구 노량진동 13-8",
      lat: 37.51,
      lng: 126.94,
      tags: ["raw"],
      lastCheckedAt: day(14),
      checkCount: 1,
      sides: { headButter: false, ramen: true, friedRice: false },
    }),
    // 지도 밖 (bounds 북쪽) — "지도 내 N곳"에 안 들어가야 함
    makePlace({ id: "outside", name: "의정부새우", gu: "의정부시", lat: 37.9, lng: 127.05 }),
  ];
}

const stats = {
  weekPlaceCount: 47,
  todayCheckinCount: 12,
  topPlace: { id: "nara", name: "나라수산", count: 3 },
};
const eventCard = {
  id: "ev",
  title: "새우 까주기 테스트",
  description: "당신은 까주는 쪽?",
  href: "/test",
  startsAt: "2026-08-01T00:00:00+09:00",
  endsAt: "2026-12-31T23:59:59+09:00",
};

function renderScreen(props: Partial<Parameters<typeof MapScreen>[0]> = {}) {
  return render(
    <MapScreen
      now={NOW}
      places={seed()}
      stats={stats}
      eventCard={eventCard}
      bookmarkedIds={[]}
      {...props}
    />,
  );
}

const listCards = () =>
  within(screen.getByRole("list", { name: "가게 목록" })).getAllByRole("heading", {
    level: 3,
  });

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_NCP_CLIENT_ID", "test-key");
  fake.map.panTo.mockClear();
  fake.map.morph.mockClear();
  fake.map.fitBounds.mockClear();
  fake.map.setZoom.mockClear();
  fake.navermaps.Service.geocode.mockReset();
});

describe("MapScreen — design 화면 1의 1~8", () => {
  it("검색·카테고리 드롭다운·칩·FAB(내 위치·제보)·시트 헤더(지역 N곳 + 정렬 + 시즌 카운터)·이벤트 배너가 모두 있다", async () => {
    renderScreen();
    // 워드마크는 화면에서 뺐지만 문서 제목(h1)은 남긴다
    expect(screen.getByRole("heading", { level: 1, name: "새우맵" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "제보" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "내 위치" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "가게·동네 검색" })).toBeInTheDocument();
    const counter = screen.getByLabelText("시즌 카운터");
    expect(counter).toHaveTextContent(/오늘 12건 ?확인됐어요/);
    expect(counter).toHaveTextContent(/이번 주 47곳/);
    expect(counter).not.toHaveTextContent("최다 확인");
    const event = screen.getByLabelText("이벤트");
    expect(event).toHaveTextContent("새우 까주기 테스트");
    expect(event).toHaveTextContent("당신은 까주는 쪽?");
    expect(within(event).getByRole("link")).toHaveAttribute("href", "/test");
    const category = screen.getByRole("button", { name: "카테고리: 전체" });
    expect(category).toHaveAttribute("aria-haspopup", "listbox");
    const chips = within(screen.getByRole("group", { name: "필터" })).getAllByRole("button");
    expect(chips.map((c) => c.textContent)).toEqual([
      "머리버터구이",
      "라면",
      "볶음밥",
      "새로 들어온 집",
      "찜한 곳",
    ]);
    expect(screen.getByRole("region", { name: "가게 목록" })).toBeInTheDocument();
    // 뷰포트 보고 후 "{지역} N곳" — 밖의 1곳은 제외. 시드 5곳 중 4곳(80%)이 보이므로 "서울 전체"
    expect(await screen.findByRole("heading", { name: "서울 전체 4곳" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "정렬: 가까운순" })).toHaveAttribute(
      "aria-haspopup",
      "listbox",
    );
    expect(listCards()).toHaveLength(4);
  });

  it("마커: 지도 안 가게가 마커로 그려지고, 마커 탭 → 카드 선택", async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "서울 전체 4곳" });
    const markers = screen.getAllByTestId("marker");
    expect(markers.length).toBeGreaterThan(0);
    const nara = markers.find((m) => m.textContent === "나라수산");
    if (!nara) throw new Error("marker expected");
    vi.spyOn(window.history, "pushState").mockImplementation(() => {});
    fireEvent.click(nara);
    // 마커 탭 = 상세 열기 (화면 2). 닫으면 카드가 선택 상태로 남는다
    expect(screen.getByRole("article", { name: "나라수산 상세" })).toBeInTheDocument();
    vi.spyOn(window.history, "back").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "상세 닫기" }));
    expect(screen.getByRole("button", { name: /나라수산, 마포구/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    vi.restoreAllMocks();
  });

  it("카드 탭 → 선택 + 지도 이동(panTo)", async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "서울 전체 4곳" });
    fireEvent.click(screen.getByRole("button", { name: /나라수산, 마포구/ }));
    expect(fake.map.panTo).toHaveBeenCalledTimes(1);
  });

  it("카테고리 드롭다운: '생새우회' → 회 태그 가게만, 구이+회 가게는 양쪽에", async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "서울 전체 4곳" });

    fireEvent.click(screen.getByRole("button", { name: "카테고리: 전체" }));
    const options = within(screen.getByRole("listbox", { name: "카테고리" })).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["전체", "새우구이", "생새우회"]);
    fireEvent.click(screen.getByRole("option", { name: "생새우회" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "카테고리: 생새우회" })).toBeInTheDocument();
    // 회: 나라수산(마포구)·하나수산(동작구) — 동률이라 가나다순 첫 구
    expect(await screen.findByRole("heading", { name: "동작구 일대 2곳" })).toBeInTheDocument();
    expect(listCards().map((h) => h.textContent).sort()).toEqual(
      ["나라수산", "노량진수산시장 하나수산"].sort(),
    );

    fireEvent.click(screen.getByRole("button", { name: "카테고리: 생새우회" }));
    fireEvent.click(screen.getByRole("option", { name: "새우구이" }));
    expect(await screen.findByRole("heading", { name: "서울 전체 3곳" })).toBeInTheDocument(); // 3/5 = 60%
  });

  it("칩 '새로 들어온 집' → 신규만, '찜한 곳' → 빈 상태", async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "서울 전체 4곳" });
    fireEvent.click(screen.getByRole("button", { name: "새로 들어온 집" }));
    expect(await screen.findByRole("heading", { name: "관악구 1곳" })).toBeInTheDocument();
    expect(listCards()[0]).toHaveTextContent("수성2호왕새우소금구이");
    expect(screen.getByText("새로 제보됨")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "새로 들어온 집" }));
    fireEvent.click(screen.getByRole("button", { name: "찜한 곳" }));
    expect(await screen.findByText("아직 찜한 곳이 없어요")).toBeInTheDocument();
  });

  it("사이드 칩: 라면 → 라면 되는 집만(AND), 볶음밥 → 필터 빈 상태 + [필터 해제]", async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "서울 전체 4곳" });

    fireEvent.click(screen.getByRole("button", { name: "라면" }));
    // 라면: 나라수산(마포구)·하나수산(동작구) — 동률이라 가나다순 첫 구
    expect(await screen.findByRole("heading", { name: "동작구 일대 2곳" })).toBeInTheDocument();
    expect(listCards().map((h) => h.textContent).sort()).toEqual(
      ["나라수산", "노량진수산시장 하나수산"].sort(),
    );
    fireEvent.click(screen.getByRole("button", { name: "머리버터구이" }));
    expect(await screen.findByRole("heading", { name: "마포구 1곳" })).toBeInTheDocument();

    // 볶음밥 되는 집은 시드에 없음 → "제보" 유도가 아니라 필터 해제 유도
    fireEvent.click(screen.getByRole("button", { name: "볶음밥" }));
    expect(await screen.findByText("조건에 맞는 집이 없어요")).toBeInTheDocument();
    expect(screen.queryByText("이 동네엔 아직 없어요")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "필터 해제" }));
    expect(await screen.findByRole("heading", { name: "서울 전체 4곳" })).toBeInTheDocument();
    for (const name of ["라면", "머리버터구이", "볶음밥"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("검색: 동네·상호 필터, 없는 동네는 빈 상태 + 제보, Enter로 지도 fitBounds", async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "서울 전체 4곳" });
    const input = screen.getByRole("searchbox", { name: "가게·동네 검색" });

    fireEvent.change(input, { target: { value: "노량진" } });
    expect(await screen.findByRole("heading", { name: "동작구 1곳" })).toBeInTheDocument();
    expect(listCards()[0]).toHaveTextContent("노량진수산시장 하나수산");

    fireEvent.submit(screen.getByRole("search"));
    expect(fake.map.fitBounds).toHaveBeenCalledTimes(1);

    fireEvent.change(input, { target: { value: "없는동네" } });
    expect(await screen.findByText("이 동네엔 아직 없어요")).toBeInTheDocument();
    expect(within(screen.getByRole("status")).getByRole("button", { name: "제보" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "검색어 지우기" }));
    expect(await screen.findByRole("heading", { name: "서울 전체 4곳" })).toBeInTheDocument();
  });

  it("정렬 3종(헤더 트리거): 기본 가까운순, 최근 확인순·확인 많은 순으로 바뀐다", async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "서울 전체 4곳" });

    fireEvent.click(screen.getByRole("button", { name: "정렬: 가까운순" }));
    const options = within(screen.getByRole("listbox", { name: "정렬" })).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["가까운순", "최근 확인순", "확인 많은 순"]);
    fireEvent.click(screen.getByRole("option", { name: "최근 확인순" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "정렬: 최근 확인순" })).toBeInTheDocument();
    expect(listCards()[0]).toHaveTextContent("나라수산"); // 1일 전이 가장 최근

    fireEvent.click(screen.getByRole("button", { name: "정렬: 최근 확인순" }));
    fireEvent.click(screen.getByRole("option", { name: "확인 많은 순" }));
    const names = listCards().map((h) => h.textContent);
    expect(names.slice(0, 2)).toEqual(["나라수산", "노량진수산시장 하나수산"]); // 3회, 1회
  });

  it("내 위치: geolocation 없음(jsdom) → 안내, 지도는 안 움직임", async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "서울 전체 4곳" });
    fireEvent.click(screen.getByRole("button", { name: "내 위치" }));
    expect(await screen.findByRole("status")).toHaveTextContent("위치를 가져올 수 없어요");
    expect(fake.map.morph).not.toHaveBeenCalled();
  });

  it("이벤트 카드 닫기 → 사라짐 (메모리 상태)", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "이벤트 카드 닫기" }));
    expect(screen.queryByLabelText("이벤트")).not.toBeInTheDocument();
  });

  it("이벤트 카드가 null이면 슬롯이 비어 있다", () => {
    renderScreen({ eventCard: null });
    expect(screen.queryByLabelText("이벤트")).not.toBeInTheDocument();
  });

  it("NCP 인증 실패(navermap_authFailure) → 지도 자리와 시트 모두 에러 상태", async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "서울 전체 4곳" });
    const w = window as Window & { navermap_authFailure?: () => void };
    expect(typeof w.navermap_authFailure).toBe("function");
    act(() => {
      w.navermap_authFailure?.();
    });
    const alerts = await screen.findAllByRole("alert");
    expect(alerts).toHaveLength(2);
    for (const alert of alerts) expect(alert).toHaveTextContent("지도를 불러오지 못했어요");
    expect(screen.getAllByRole("button", { name: "다시 시도" })).toHaveLength(2);
    // 지도는 언마운트하지 않는다 (인증 실패 뒤 SDK destroy()가 throw → 라우트 에러로 번짐)
    expect(screen.getByTestId("map")).toBeInTheDocument();
  });

  it("NEXT_PUBLIC_NCP_CLIENT_ID가 없으면 로딩에 갇히지 않고 설정 에러 상태", async () => {
    vi.stubEnv("NEXT_PUBLIC_NCP_CLIENT_ID", "");
    renderScreen();
    expect(await screen.findByText("지도 설정이 없어요")).toBeInTheDocument();
    expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole("list", { name: "가게 목록 불러오는 중" })).not.toBeInTheDocument();
  });

  it("위치 권한 없음(jsdom 기본) → 지도 중심 기준 거리가 카드에 보인다", async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "서울 전체 4곳" });
    // 가짜 지도 중심 (37.55, 127.0) ↔ 나라수산 (37.54, 126.95) ≈ 4.5km
    expect(screen.getByRole("button", { name: /나라수산, 마포구/ })).toHaveTextContent(/\d(\.\d)?km · 마포구/);
  });
});

describe("MapScreen — 화면 2 상세 열기/닫기·URL 동기화", () => {
  const openNara = async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "서울 전체 4곳" });
    fireEvent.click(screen.getByRole("button", { name: /나라수산, 마포구/ }));
  };

  const history = { pushState: vi.fn(), replaceState: vi.fn(), back: vi.fn() };

  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    history.pushState = vi.spyOn(window.history, "pushState");
    history.replaceState = vi.spyOn(window.history, "replaceState");
    history.back = vi.spyOn(window.history, "back").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("카드 탭 → 같은 시트가 상세 요약으로, FAB 숨김, URL /place/[id] push, 지도 이동", async () => {
    await openNara();
    const sheet = screen.getByRole("region", { name: "가게 상세" });
    expect(sheet).toHaveAttribute("data-mode", "detail");
    expect(sheet).toHaveAttribute("data-snap", "half");
    expect(screen.getByRole("article", { name: "나라수산 상세" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "제보" })).toBeNull();
    expect(screen.queryByRole("list", { name: "가게 목록" })).toBeNull(); // hidden으로 유지
    expect(history.pushState).toHaveBeenCalledWith({ saeuDetail: true }, "", "/place/nara");
    expect(fake.map.panTo).toHaveBeenCalledTimes(1);
  });

  it("× 닫기 → 목록 복귀(history.back), 마커 탭도 상세를 연다", async () => {
    await openNara();
    fireEvent.click(screen.getByRole("button", { name: "상세 닫기" }));
    expect(screen.getByRole("region", { name: "가게 목록" })).toHaveAttribute("data-mode", "list");
    expect(screen.getByRole("list", { name: "가게 목록" })).toBeInTheDocument();
    expect(history.back).toHaveBeenCalledTimes(1);

    const marker = screen.getAllByTestId("marker").find((m) => m.textContent === "노량진수산시장 하나수산");
    if (!marker) throw new Error("marker expected");
    fireEvent.click(marker);
    expect(screen.getByRole("article", { name: "노량진수산시장 하나수산 상세" })).toBeInTheDocument();
    expect(history.pushState).toHaveBeenLastCalledWith({ saeuDetail: true }, "", "/place/hana");
  });

  it("initialPlaceId → 처음부터 상세, 닫으면 replaceState('/') (직접 진입은 뒤로 갈 곳이 없다)", () => {
    window.history.replaceState(null, "", "/place/nara");
    renderScreen({ initialPlaceId: "nara" });
    expect(screen.getByRole("article", { name: "나라수산 상세" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "상세 닫기" }));
    expect(history.replaceState).toHaveBeenLastCalledWith(null, "", "/");
    expect(history.back).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "가게 목록" })).toBeInTheDocument();
  });

  it("initialPlaceId → 지도가 뜨면 핀을 요약 시트 위 가시 영역으로 panTo 1회 (공유 링크로 핀이 보인다)", async () => {
    window.history.replaceState(null, "", "/place/nara");
    renderScreen({ initialPlaceId: "nara" });
    await waitFor(() => {
      expect(fake.map.panTo).toHaveBeenCalledTimes(1);
    });
    expect(fake.map.morph).not.toHaveBeenCalled();
  });

  it("상세 A가 열린 채 마커 B 탭 → 엔트리 교체(replaceState), 닫기는 back 1회로 목록 (Codex #4)", async () => {
    await openNara();
    const hana = screen.getAllByTestId("marker").find((m) => m.textContent === "노량진수산시장 하나수산");
    if (!hana) throw new Error("marker expected");
    fireEvent.click(hana);
    expect(screen.getByRole("article", { name: "노량진수산시장 하나수산 상세" })).toBeInTheDocument();
    expect(history.pushState).toHaveBeenCalledTimes(1);
    expect(history.replaceState).toHaveBeenLastCalledWith({ saeuDetail: true }, "", "/place/hana");
    fireEvent.click(screen.getByRole("button", { name: "상세 닫기" }));
    expect(history.back).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("list", { name: "가게 목록" })).toBeInTheDocument();
  });

  it("상세가 열린 채 칩으로 그 가게를 걸러내도 핀은 남는다 (Codex #4)", async () => {
    await openNara();
    fireEvent.click(screen.getByRole("button", { name: /새로 들어온 집/ }));
    expect(screen.getByRole("article", { name: "나라수산 상세" })).toBeInTheDocument();
    expect(screen.getAllByTestId("marker").some((m) => m.textContent === "나라수산")).toBe(true);
  });

  it("popstate: 경로가 /place/[id]면 열고, /면 닫는다", async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "서울 전체 4곳" });
    window.history.replaceState(null, "", "/place/suseong");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByRole("article", { name: "수성2호왕새우소금구이 상세" })).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("새로 제보된 곳이에요");
    expect(history.pushState).not.toHaveBeenCalled();

    window.history.replaceState(null, "", "/");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.getByRole("list", { name: "가게 목록" })).toBeInTheDocument();
  });

  it("popstate: 이미 열린 그 가게면 아무것도 하지 않는다 (사진 뷰어가 URL 그대로 엔트리를 쌓는다)", async () => {
    await openNara();
    expect(fake.map.panTo).toHaveBeenCalledTimes(1);
    // 뷰어를 닫는 뒤로가기 — 경로는 /place/nara 그대로다
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByRole("article", { name: "나라수산 상세" })).toBeInTheDocument();
    // 시트 높이(펼침)도 지도도 건드리지 않는다 — 여기서 setSnap("half")가 돌면 펼친 시트가 요약으로 튄다
    expect(screen.getByRole("region", { name: "가게 상세" })).toHaveAttribute("data-snap", "half");
    expect(fake.map.panTo).toHaveBeenCalledTimes(1);
  });

  it("찜 → '찜한 곳' 칩 필터에 바로 반영 (목: 클라이언트 메모리)", async () => {
    await openNara();
    fireEvent.click(screen.getByRole("button", { name: "찜" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "찜" })).toHaveAttribute("aria-pressed", "true");
    });
    fireEvent.click(screen.getByRole("button", { name: "상세 닫기" }));
    fireEvent.click(screen.getByRole("button", { name: "찜한 곳" }));
    expect(await screen.findByRole("heading", { name: "마포구 1곳" })).toBeInTheDocument();
    expect(listCards()[0]).toHaveTextContent("나라수산");
    // 다음 테스트를 위해 원복 (모듈 메모리)
    fireEvent.click(screen.getByRole("button", { name: /나라수산, 마포구/ }));
    fireEvent.click(await screen.findByRole("button", { name: "찜" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "찜" })).toHaveAttribute("aria-pressed", "false");
    });
  });

  it("다녀왔다면 성공 → 닫은 뒤 카드도 '오늘 확인'·확인 수 반영", async () => {
    const naraSeed = seed().find((p) => p.id === "nara");
    if (!naraSeed) throw new Error("seed expected");
    dataMocks.checkIn.mockImplementation(
      (id, now) =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({ ...naraSeed, id, checkCount: naraSeed.checkCount + 1, lastCheckedAt: now });
          }, 400);
        }),
    );
    await openNara();
    fireEvent.click(screen.getByRole("button", { name: "다녀왔어요" }));
    expect(screen.getByText("확인 4회")).toBeInTheDocument(); // 3 + 1 낙관
    expect(screen.getByText("확인했어요")).toBeInTheDocument();
    // 목 쓰기 지연(400ms)이 끝나야 부모 places에 확정된다
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 450)));
    fireEvent.click(screen.getByRole("button", { name: "상세 닫기" }));
    const card = screen.getByRole("button", { name: /나라수산, 마포구/ });
    expect(card).toHaveTextContent("오늘 확인");
    await waitFor(() => {
      expect(card).toHaveTextContent("오늘 확인");
    });
  });
});

describe("MapScreen — 화면 3 제보 플로우 진입·히스토리", () => {
  const history = { pushState: vi.fn(), replaceState: vi.fn(), back: vi.fn() };

  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    history.pushState = vi.spyOn(window.history, "pushState");
    history.replaceState = vi.spyOn(window.history, "replaceState");
    history.back = vi.spyOn(window.history, "back").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const openReport = async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "서울 전체 4곳" });
    fireEvent.click(screen.getByRole("button", { name: "제보" }));
  };
  const popstate = () => {
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
  };

  it("[+ 제보] → 같은 시트가 제보 모드(전체)로: 1단계 제목·입력 포커스, FAB·검색바는 숨고 엔트리 하나 push", async () => {
    await openReport();
    const sheet = screen.getByRole("region", { name: "가게 제보" });
    expect(sheet).toHaveAttribute("data-mode", "report");
    expect(sheet).toHaveAttribute("data-snap", "full");
    expect(screen.getByRole("heading", { name: "가게 이름을 검색해주세요" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "가게 이름" })).toHaveFocus();
    expect(screen.getByRole("progressbar", { name: "제보 진행" })).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByRole("button", { name: "새로 등록하기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "제보" })).toBeNull();
    expect(screen.queryByRole("searchbox", { name: "가게·동네 검색" })).toBeNull();
    expect(screen.queryByRole("list", { name: "가게 목록" })).toBeNull();
    expect(history.pushState).toHaveBeenCalledTimes(1);
    expect(history.pushState).toHaveBeenCalledWith({ saeuReport: true }, "");
  });

  it("헤더 ✕(제보 그만두기) → history.back, popstate가 닫아 목록·원래 스냅으로", async () => {
    await openReport();
    fireEvent.click(screen.getByRole("button", { name: "제보 그만두기" }));
    expect(history.back).toHaveBeenCalledTimes(1);
    popstate();
    const sheet = screen.getByRole("region", { name: "가게 목록" });
    expect(sheet).toHaveAttribute("data-mode", "list");
    expect(sheet).toHaveAttribute("data-snap", "half");
    expect(screen.getByRole("button", { name: "제보" })).toBeInTheDocument();
  });

  it("1단계: 두 글자부터 '이미 있어요' 매치, 탭하면 플로우가 닫히고 그 상세로 (제보 엔트리를 상세로 교체)", async () => {
    await openReport();
    const input = screen.getByRole("textbox", { name: "가게 이름" });
    fireEvent.change(input, { target: { value: "나" } });
    expect(screen.queryByRole("list", { name: "이미 있는 가게" })).toBeNull();
    fireEvent.change(input, { target: { value: "나라" } });
    const row = within(screen.getByRole("list", { name: "이미 있는 가게" })).getByRole("button", {
      name: /나라수산/,
    });
    expect(row).toHaveTextContent("이미 있어요");
    expect(row).toHaveTextContent("마포구 · 새우구이 · 생새우회");
    fireEvent.click(row);
    expect(screen.getByRole("article", { name: "나라수산 상세" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "가게 상세" })).toHaveAttribute("data-mode", "detail");
    expect(history.replaceState).toHaveBeenLastCalledWith({ saeuDetail: true }, "", "/place/nara");
    expect(history.pushState).toHaveBeenCalledTimes(1); // 제보 엔트리뿐
    // 상세 닫기 → back 한 번에 목록
    fireEvent.click(screen.getByRole("button", { name: "상세 닫기" }));
    expect(history.back).toHaveBeenCalledTimes(1);
  });

  it("빈 이름으로 [새로 등록하기] → 오류 한 줄, 1단계 유지", async () => {
    await openReport();
    fireEvent.click(screen.getByRole("button", { name: "새로 등록하기" }));
    expect(screen.getByRole("alert")).toHaveTextContent("가게 이름을 입력해주세요");
    expect(screen.getByRole("heading", { name: "가게 이름을 검색해주세요" })).toBeInTheDocument();
  });

  it("2단계 진입: 시트 요약 + 핀 마커 + 줌 17 focus. 뒤로가기(popstate) → 1단계로 돌아오고 엔트리 재장전, 입력값 유지", async () => {
    await openReport();
    fireEvent.change(screen.getByRole("textbox", { name: "가게 이름" }), { target: { value: "나라새우집" } });
    fireEvent.click(screen.getByRole("button", { name: "새로 등록하기" }));
    expect(screen.getByRole("heading", { name: "핀을 가게 위치로 옮겨주세요" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "가게 제보" })).toHaveAttribute("data-snap", "half");
    expect(screen.getByRole("button", { name: "제보 위치" })).toBeInTheDocument(); // 끌 수 있는 핀
    expect(fake.map.setZoom).toHaveBeenCalledWith(17, false);
    expect(fake.map.panTo).toHaveBeenCalled();
    expect(screen.getByRole("progressbar", { name: "제보 진행" })).toHaveAttribute("aria-valuenow", "2");

    popstate();
    expect(screen.getByRole("heading", { name: "가게 이름을 검색해주세요" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "가게 이름" })).toHaveValue("나라새우집");
    expect(screen.queryByRole("button", { name: "제보 위치" })).toBeNull();
    expect(history.pushState).toHaveBeenCalledTimes(2);
    expect(history.pushState).toHaveBeenLastCalledWith({ saeuReport: true }, "");
    // 1단계에서 한 번 더 뒤로 → 닫힘
    popstate();
    expect(screen.getByRole("region", { name: "가게 목록" })).toBeInTheDocument();
  });

  it("2단계: 주소 검색 → 행 탭이면 핀 이동(focus). 확정 → 시드 근처 같은 상호면 중복 패널 + fitBounds → [이 가게예요]는 상세로", async () => {
    fake.navermaps.Service.geocode.mockImplementation(
      (_opts: unknown, cb: (status: number, res: unknown) => void) => {
        cb(200, {
          v2: {
            addresses: [
              { roadAddress: "서울 마포구 마포대로 1", jibunAddress: "서울 마포구 도화동 1", x: "126.95", y: "37.54" },
            ],
          },
        });
      },
    );
    await openReport();
    fireEvent.change(screen.getByRole("textbox", { name: "가게 이름" }), { target: { value: "나라수산 본점" } });
    fireEvent.click(screen.getByRole("button", { name: "새로 등록하기" }));
    fake.map.setZoom.mockClear();
    fake.map.panTo.mockClear();

    fireEvent.change(screen.getByRole("searchbox", { name: "도로명 주소" }), { target: { value: "마포대로 1" } });
    fireEvent.submit(screen.getByRole("search", { name: "도로명 주소 검색" }));
    const row = await screen.findByRole("button", { name: /마포대로 1/ });
    expect(fake.navermaps.Service.geocode).toHaveBeenCalledWith(
      expect.objectContaining({ query: "마포대로 1", count: 5 }),
      expect.any(Function),
    );
    fireEvent.click(row);
    expect(fake.map.setZoom).toHaveBeenCalledWith(17, false);
    expect(fake.map.panTo).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "여기가 맞아요" }));
    expect(await screen.findByRole("heading", { name: "150m 안에 비슷한 가게가 있어요" })).toBeInTheDocument();
    expect(fake.map.fitBounds).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "이 가게예요" }));
    expect(screen.getByRole("article", { name: "나라수산 상세" })).toBeInTheDocument();
    expect(history.replaceState).toHaveBeenLastCalledWith({ saeuDetail: true }, "", "/place/nara");
  });

  it("2단계: 지오코더 응답이 OK가 아니면 '주소를 찾지 못했어요'", async () => {
    fake.navermaps.Service.geocode.mockImplementation(
      (_opts: unknown, cb: (status: number, res: unknown) => void) => {
        cb(500, { v2: { addresses: [] } });
      },
    );
    await openReport();
    fireEvent.change(screen.getByRole("textbox", { name: "가게 이름" }), { target: { value: "나라새우집" } });
    fireEvent.click(screen.getByRole("button", { name: "새로 등록하기" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "도로명 주소" }), { target: { value: "없는 주소" } });
    fireEvent.submit(screen.getByRole("search", { name: "도로명 주소 검색" }));
    expect(await screen.findByRole("status")).toHaveTextContent("주소를 찾지 못했어요");
  });

  it("끝까지: 이름 → 핀 확정 → 메뉴 → 건너뛰고 등록 → 완료 → [내 핀 보러가기] = 새 가게 상세(신규 배너) + 목록·마커에 추가", async () => {
    dataMocks.submitReport.mockImplementation((input) =>
      Promise.resolve(
        makePlace({
          id: "r001",
          name: (input as ReportInput).name,
          menus: (input as ReportInput).menus.map((m) =>
            makeMenu({ raw: m.name, name: m.name, price: m.price, unit: m.unit, unit_raw: m.unitRaw }),
          ),
          gu: "성동구",
          lat: 37.55,
          lng: 127.0,
          addressRoad: null,
          source: "report",
          isNew: true,
          createdAt: NOW,
          lastCheckedAt: NOW,
        }),
      ),
    );
    await openReport();
    fireEvent.change(screen.getByRole("textbox", { name: "가게 이름" }), { target: { value: "완전 새로운 새우집" } });
    fireEvent.click(screen.getByRole("button", { name: "새로 등록하기" }));
    // 2단계: 핀은 보던 지도 중심(37.55, 127.0 — 서울 안), 중복 없음 → 3단계
    fireEvent.click(screen.getByRole("button", { name: "여기가 맞아요" }));
    await screen.findByRole("heading", { name: "메뉴와 가격을 알려주세요" });
    fireEvent.change(screen.getByRole("textbox", { name: "메뉴명" }), { target: { value: "왕새우 소금구이" } });
    fireEvent.change(screen.getByRole("textbox", { name: "가격" }), { target: { value: "35000" } });
    fireEvent.click(screen.getByRole("button", { name: "한판" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByRole("heading", { name: "더 알려주실 게 있나요?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "건너뛰고 등록" }));
    await screen.findByRole("heading", { name: "등록됐어요!" });
    expect(dataMocks.submitReport).toHaveBeenCalledWith(
      expect.objectContaining({ name: "완전 새로운 새우집", lat: 37.55, lng: 127.0, duplicateOf: null }),
      NOW,
    );
    expect(screen.getByLabelText("등록한 가게")).toHaveTextContent("왕새우 소금구이 한판 35,000원");
    expect(screen.getByRole("region", { name: "가게 제보" })).toHaveAttribute("data-snap", "full");

    fireEvent.click(screen.getByRole("button", { name: "내 핀 보러가기" }));
    expect(screen.getByRole("article", { name: "완전 새로운 새우집 상세" })).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("새로 제보된 곳이에요");
    expect(screen.getByRole("button", { name: "주소를 알려주세요" })).toBeInTheDocument();
    expect(history.replaceState).toHaveBeenLastCalledWith({ saeuDetail: true }, "", "/place/r001");
    expect(screen.getAllByRole("button", { name: "완전 새로운 새우집" })).not.toHaveLength(0); // 마커
    // 상세 닫기(back은 가짜라 URL은 그대로 — popstate까지 흉내 내면 경로 /place/r001로 다시 열린다) → 목록에 새 가게
    fireEvent.click(screen.getByRole("button", { name: "상세 닫기" }));
    expect(
      within(screen.getByRole("list", { name: "가게 목록" })).getByRole("heading", { name: "완전 새로운 새우집" }),
    ).toBeInTheDocument();
  });

  it("패널의 ‹ 는 history.back과 같은 길", async () => {
    await openReport();
    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    expect(history.back).toHaveBeenCalledTimes(1);
  });

  it("제보 중엔 칩 필터와 무관하게 전부 마커로 보인다 (중복 후보가 필터에 가려지면 안 된다)", async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "서울 전체 4곳" });
    fireEvent.click(screen.getByRole("button", { name: "볶음밥" })); // 시드에 볶음밥 되는 집 없음 → 마커 0
    expect(screen.queryByRole("button", { name: "나라수산" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "제보" }));
    expect(screen.getByRole("button", { name: "나라수산" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "수성2호왕새우소금구이" })).toBeInTheDocument();
  });

  it("1단계에서 마커를 탭해도 상세가 열리지 않는다 (기존 마커는 보이기만)", async () => {
    await openReport();
    fireEvent.click(screen.getByRole("button", { name: "나라수산" }));
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.getByRole("region", { name: "가게 제보" })).toBeInTheDocument();
  });

  it("2단계: 지도 빈 곳 탭(click 리스너) → 핀이 그 자리로, 지도는 안 움직인다. 1단계 탭은 무시", async () => {
    await openReport();
    act(() => {
      fake.listeners["click"]?.({ coord: new fake.navermaps.LatLng(37.56, 127.01) });
    });
    expect(screen.queryByRole("button", { name: "제보 위치" })).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "가게 이름" }), { target: { value: "탭 새우집" } });
    fireEvent.click(screen.getByRole("button", { name: "새로 등록하기" }));
    const pin = screen.getByRole("button", { name: "제보 위치" });
    expect(pin).toHaveAttribute("data-lat", "37.55"); // 보던 지도 중심에서 시작
    const zooms = fake.map.setZoom.mock.calls.length;
    const pans = fake.map.panTo.mock.calls.length;
    act(() => {
      fake.listeners["click"]?.({ coord: new fake.navermaps.LatLng(37.56, 127.01) });
    });
    expect(screen.getByRole("button", { name: "제보 위치" })).toHaveAttribute("data-lat", "37.56");
    expect(fake.map.setZoom).toHaveBeenCalledTimes(zooms);
    expect(fake.map.panTo).toHaveBeenCalledTimes(pans);
  });

  it("2단계: 기존 마커를 탭하면 그 가게로 '이미 등록된 가게예요' 패널 + fitBounds, [이 가게예요]는 상세로", async () => {
    await openReport();
    fireEvent.change(screen.getByRole("textbox", { name: "가게 이름" }), { target: { value: "탭 새우집" } });
    fireEvent.click(screen.getByRole("button", { name: "새로 등록하기" }));
    fireEvent.click(screen.getByRole("button", { name: "나라수산" }));
    expect(screen.getByRole("heading", { name: "이미 등록된 가게예요" })).toBeInTheDocument();
    expect(fake.map.fitBounds).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    expect(screen.getByRole("heading", { name: "핀을 가게 위치로 옮겨주세요" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "나라수산" }));
    fireEvent.click(screen.getByRole("button", { name: "이 가게예요" }));
    expect(screen.getByRole("article", { name: "나라수산 상세" })).toBeInTheDocument();
    expect(history.replaceState).toHaveBeenLastCalledWith({ saeuDetail: true }, "", "/place/nara");
  });

  it("지도를 못 불러온 상태에선 제보 입구가 토스트로 막힌다", async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "서울 전체 4곳" });
    const w = window as Window & { navermap_authFailure?: () => void };
    act(() => {
      w.navermap_authFailure?.();
    });
    fireEvent.click(screen.getByRole("button", { name: "제보" }));
    expect(screen.getByRole("status")).toHaveTextContent("지도를 불러오지 못해 제보할 수 없어요");
    expect(screen.queryByRole("region", { name: "가게 제보" })).toBeNull();
    expect(history.pushState).not.toHaveBeenCalled();
  });
});
