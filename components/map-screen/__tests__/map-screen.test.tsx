import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { makeMenu, makePlace } from "@/lib/__tests__/fixtures";
import type { Place } from "@/lib/types";
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
  const navermaps = { LatLng, LatLngBounds, Size, Point };
  const map = {
    getBounds: () => new LatLngBounds(new LatLng(37.4, 126.8), new LatLng(37.7, 127.2)),
    getZoom: () => 12,
    getCenter: () => new LatLng(37.55, 127.0),
    panTo: vi.fn(),
    morph: vi.fn(),
    fitBounds: vi.fn(),
    getSize: () => new Size(390, 844),
    getProjection: () => ({
      fromCoordToOffset: () => new Point(195, 400),
      fromOffsetToCoord: (p: Point) => new LatLng(p.y, p.x),
    }),
  };
  return { navermaps, map };
});

vi.mock("react-naver-maps", () => ({
  NavermapsProvider: ({ children }: { children: ReactNode }) => children,
  Container: ({ children }: { children: ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  NaverMap: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Marker: ({ title, onClick }: { title: string; onClick?: () => void }) => (
    <button type="button" data-testid="marker" onClick={onClick}>
      {title}
    </button>
  ),
  useMap: () => fake.map,
  useNavermaps: () => fake.navermaps,
  useListener: () => {},
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
  title: "새우 까주기 테스트 — 당신은 까주는 쪽?",
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
});

describe("MapScreen — design 화면 1의 1~9", () => {
  it("상단 바·검색·시즌 카운터·이벤트 카드·탭·칩·시트가 모두 있다", async () => {
    renderScreen();
    expect(screen.getByRole("heading", { level: 1, name: "새우맵" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "제보" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "가게·동네 검색" })).toBeInTheDocument();
    expect(screen.getByLabelText("시즌 카운터")).toHaveTextContent(
      "이번 주 확인 47곳 · 오늘 12건 · 이번 주 최다 확인 나라수산",
    );
    expect(screen.getByText("새우 까주기 테스트 — 당신은 까주는 쪽?")).toBeInTheDocument();
    const tabs = within(screen.getByRole("group", { name: "카테고리" })).getAllByRole("button");
    expect(tabs.map((t) => t.textContent)).toEqual(["전체", "구이", "회"]);
    expect(tabs[0]).toHaveAttribute("aria-pressed", "true");
    const chips = within(screen.getByRole("group", { name: "필터" })).getAllByRole("button");
    expect(chips.map((c) => c.textContent)).toEqual(["새로 들어온 집", "찜한 곳"]);
    expect(screen.getByRole("region", { name: "가게 목록" })).toBeInTheDocument();
    // 뷰포트 보고 후 "지도 내 N곳" — 밖의 1곳은 제외
    expect(await screen.findByRole("heading", { name: "지도 내 4곳" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /가까운순/ })).toBeInTheDocument();
    expect(listCards()).toHaveLength(4);
  });

  it("마커: 지도 안 가게가 마커로 그려지고, 마커 탭 → 카드 선택", async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "지도 내 4곳" });
    const markers = screen.getAllByTestId("marker");
    expect(markers.length).toBeGreaterThan(0);
    const nara = markers.find((m) => m.textContent === "나라수산");
    if (!nara) throw new Error("marker expected");
    fireEvent.click(nara);
    expect(screen.getByRole("button", { name: /나라수산, 마포구/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("카드 탭 → 선택 + 지도 이동(panTo)", async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "지도 내 4곳" });
    fireEvent.click(screen.getByRole("button", { name: /나라수산, 마포구/ }));
    expect(fake.map.panTo).toHaveBeenCalledTimes(1);
  });

  it("탭 '회' → 회 태그 가게만, 구이+회 가게는 양쪽에", async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "지도 내 4곳" });
    fireEvent.click(screen.getByRole("button", { name: "회" }));
    expect(await screen.findByRole("heading", { name: "지도 내 2곳" })).toBeInTheDocument();
    expect(listCards().map((h) => h.textContent).sort()).toEqual(
      ["나라수산", "노량진수산시장 하나수산"].sort(),
    );
    fireEvent.click(screen.getByRole("button", { name: "구이" }));
    expect(await screen.findByRole("heading", { name: "지도 내 3곳" })).toBeInTheDocument();
  });

  it("칩 '새로 들어온 집' → 신규만, '찜한 곳' → 빈 상태", async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "지도 내 4곳" });
    fireEvent.click(screen.getByRole("button", { name: "새로 들어온 집" }));
    expect(await screen.findByRole("heading", { name: "지도 내 1곳" })).toBeInTheDocument();
    expect(listCards()[0]).toHaveTextContent("수성2호왕새우소금구이");
    expect(screen.getByText("새로 제보됨")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "새로 들어온 집" }));
    fireEvent.click(screen.getByRole("button", { name: "찜한 곳" }));
    expect(await screen.findByText("아직 찜한 곳이 없어요")).toBeInTheDocument();
  });

  it("검색: 동네·상호 필터, 없는 동네는 빈 상태 + 제보, Enter로 지도 fitBounds", async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "지도 내 4곳" });
    const input = screen.getByRole("searchbox", { name: "가게·동네 검색" });

    fireEvent.change(input, { target: { value: "노량진" } });
    expect(await screen.findByRole("heading", { name: "지도 내 1곳" })).toBeInTheDocument();
    expect(listCards()[0]).toHaveTextContent("노량진수산시장 하나수산");

    fireEvent.submit(screen.getByRole("search"));
    expect(fake.map.fitBounds).toHaveBeenCalledTimes(1);

    fireEvent.change(input, { target: { value: "없는동네" } });
    expect(await screen.findByText("이 동네엔 아직 없어요")).toBeInTheDocument();
    expect(within(screen.getByRole("status")).getByRole("button", { name: "제보" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "검색어 지우기" }));
    expect(await screen.findByRole("heading", { name: "지도 내 4곳" })).toBeInTheDocument();
  });

  it("정렬 3종: 기본 가까운순, 최근 확인순·확인 많은 순으로 바뀐다", async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "지도 내 4곳" });

    fireEvent.click(screen.getByRole("button", { name: /가까운순/ }));
    const options = within(screen.getByRole("listbox", { name: "정렬" })).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["가까운순", "최근 확인순", "확인 많은 순"]);

    fireEvent.click(screen.getByRole("option", { name: "최근 확인순" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(listCards()[0]).toHaveTextContent("나라수산"); // 1일 전이 가장 최근

    fireEvent.click(screen.getByRole("button", { name: /최근 확인순/ }));
    fireEvent.click(screen.getByRole("option", { name: "확인 많은 순" }));
    const names = listCards().map((h) => h.textContent);
    expect(names.slice(0, 2)).toEqual(["나라수산", "노량진수산시장 하나수산"]); // 3회, 1회
  });

  it("이벤트 카드 닫기 → 사라짐 (메모리 상태)", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "이벤트 카드 닫기" }));
    expect(screen.queryByText("새우 까주기 테스트 — 당신은 까주는 쪽?")).not.toBeInTheDocument();
  });

  it("이벤트 카드가 null이면 슬롯이 비어 있다", () => {
    renderScreen({ eventCard: null });
    expect(screen.queryByLabelText("이벤트")).not.toBeInTheDocument();
  });

  it("[+ 제보] → 준비 중 안내 (Phase 3 전)", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "제보" }));
    expect(screen.getByRole("status")).toHaveTextContent("제보는 준비 중이에요");
  });

  it("NCP 인증 실패(navermap_authFailure) → 지도 자리와 시트 모두 에러 상태", async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "지도 내 4곳" });
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

  it("위치 권한 없음(jsdom 기본) → 카드에 거리 없음", async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "지도 내 4곳" });
    expect(screen.queryByText(/km|\dm\b/)).not.toBeInTheDocument();
  });
});
