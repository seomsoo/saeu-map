import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { makeMenu, makePlace } from "@/lib/__tests__/fixtures";
import { PlaceCard } from "../place-card";

const NOW = "2026-09-01T12:00:00+09:00";
const YESTERDAY = "2026-08-31T03:00:00.000Z"; // 8/31 12:00 KST

function renderCard(overrides: Partial<Parameters<typeof PlaceCard>[0]> = {}) {
  const place = makePlace({
    name: "나라수산",
    gu: "마포구",
    tags: ["grill", "raw"],
    lastCheckedAt: YESTERDAY,
    menus: [
      makeMenu({ name: "생새우소금구이", price: 60000, unit: "kg", unit_raw: "1" }),
    ],
    sides: { headButter: true, ramen: true, friedRice: false },
  });
  const onSelect = vi.fn();
  const { unmount } = render(
    <ul>
      <PlaceCard
        place={place}
        now={NOW}
        origin={null}
        selected={false}
        onSelect={onSelect}
        {...overrides}
      />
    </ul>,
  );
  return { place, onSelect, unmount };
}

describe("PlaceCard", () => {
  it("상호 · 구·카테고리 메타 · **대표 메뉴 가격** · 사이드 · 확인 라벨", () => {
    renderCard();
    expect(screen.getByRole("heading", { name: "나라수산" })).toBeInTheDocument();
    expect(screen.getByText("마포구 · 새우구이 · 생새우회")).toBeInTheDocument();
    // 가격은 카드에 있다 — 훑어보기 단계에서 고를 수 있어야 한다 (2026-09-08 리디자인)
    expect(screen.getByText("60,000원")).toBeInTheDocument();
    expect(screen.getByText(/생새우소금구이/)).toBeInTheDocument();
    expect(screen.getByText("어제 확인")).toBeInTheDocument();
    // 사이드: 있는 것만
    const sides = screen.getByRole("list", { name: "사이드" });
    expect(sides).toHaveTextContent("머리버터구이");
    expect(sides).toHaveTextContent("라면");
    expect(sides).not.toHaveTextContent("볶음밥");
  });

  it("기준점 없으면 거리 숨김, 있으면 거리가 맨 앞", () => {
    const first = renderCard();
    expect(screen.getByText(/마포구/)).not.toHaveTextContent(/km|\dm/);
    first.unmount();

    renderCard({ origin: { lat: 37.54, lng: 126.95 } });
    // 거리는 별도 span이라 요소 전체 텍스트로 확인
    expect(screen.getByText(/마포구 · 새우구이 · 생새우회/)).toHaveTextContent(
      /^\d+m · 마포구 · 새우구이 · 생새우회$/,
    );
  });

  it("신규는 확인 라벨 대신 '새로 제보됨'", () => {
    const place = makePlace({ isNew: true, lastCheckedAt: YESTERDAY });
    render(
      <ul>
        <PlaceCard place={place} now={NOW} origin={null} selected={false} onSelect={vi.fn()} />
      </ul>,
    );
    expect(screen.getByText("새로 제보됨")).toBeInTheDocument();
    expect(screen.queryByText("어제 확인")).not.toBeInTheDocument();
  });

  it("썸네일: 있으면 사진, 없으면 새우 플레이스홀더", () => {
    const { unmount } = renderCard();
    expect(document.querySelector("img")?.getAttribute("src")).toContain("shrimp.webp");
    unmount();

    const place = makePlace({ thumbnailUrl: "/mock/thumb-1.webp" });
    const { container } = render(
      <ul>
        <PlaceCard place={place} now={NOW} origin={null} selected={false} onSelect={vi.fn()} />
      </ul>,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain("thumb-1.webp");
    expect(img).toHaveAttribute("alt", "");
  });

  it("사진이 있으면 사진 카드(16:9), 없으면 썸네일 72 콤팩트 행", () => {
    const { unmount } = renderCard();
    // 사진 없음 — 썸네일 타일 안 새우 플레이스홀더
    expect(document.querySelector("img")?.getAttribute("width")).toBe("44");
    unmount();

    const place = makePlace({ thumbnailUrl: "/mock/thumb-1.webp" });
    const { container } = render(
      <ul>
        <PlaceCard place={place} now={NOW} origin={null} selected={false} onSelect={vi.fn()} />
      </ul>,
    );
    // 사진 있음 — 카드 폭을 채우는 사진
    expect(container.querySelector("img")?.getAttribute("width")).toBe("392");
  });

  it("평점은 리뷰 3개 이상일 때만(집계는 lib/data) — 없으면 줄 자체가 없다", () => {
    const { unmount } = renderCard();
    expect(screen.queryByLabelText(/별점/)).toBeNull();
    unmount();

    renderCard({ place: makePlace({ name: "나라수산", rating: { count: 12, average: 4.6 } }) });
    expect(screen.getByLabelText("별점 4.6점, 리뷰 12개")).toBeInTheDocument();
  });

  it("찜 하트는 카드 버튼의 형제 — 눌러도 onSelect가 불리지 않고 aria-pressed가 상태를 말한다", () => {
    const onToggleBookmark = vi.fn();
    const { place, onSelect, unmount } = renderCard({ onToggleBookmark });
    const heart = screen.getByRole("button", { name: "나라수산 찜하기" });
    expect(heart).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(heart);
    expect(onToggleBookmark).toHaveBeenCalledWith(place.id);
    expect(onSelect).not.toHaveBeenCalled();
    unmount();

    renderCard({ onToggleBookmark, bookmarked: true });
    expect(screen.getByRole("button", { name: "나라수산 찜 해제" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("탭하면 onSelect(id), 선택되면 aria-current", () => {
    const { place, onSelect, unmount } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: /나라수산/ }));
    expect(onSelect).toHaveBeenCalledWith(place.id);
    unmount();

    renderCard({ selected: true });
    expect(screen.getByRole("button", { name: /나라수산/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });
});

describe("PlaceCard trailing — 카드 오른쪽 액션(내 활동 찜 탭의 하트)", () => {
  it("trailing은 카드 버튼의 형제라 눌러도 onSelect가 불리지 않는다", () => {
    const onToggle = vi.fn();
    const { onSelect } = renderCard({
      trailing: (
        <button type="button" aria-label="찜 해제" onClick={onToggle}>
          ♥
        </button>
      ),
    });
    fireEvent.click(screen.getByRole("button", { name: "찜 해제" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
    // 카드 버튼 안에 버튼이 들어가지 않는다 (a11y: 중첩 인터랙티브 금지)
    const card = screen.getByRole("button", { name: "나라수산, 마포구" });
    expect(card.querySelector("button")).toBeNull();
  });
});

describe("hover (design 화면 6 — 데스크탑 카드 ↔ 마커)", () => {
  it("마우스가 올라가면 onHoverChange(id), 떠나면 null. 터치 포인터는 무시", () => {
    const onHoverChange = vi.fn();
    const { place } = renderCard({ onHoverChange });
    const card = screen.getByRole("button", { name: "나라수산, 마포구" });
    fireEvent.pointerEnter(card, { pointerType: "mouse" });
    expect(onHoverChange).toHaveBeenLastCalledWith(place.id);
    fireEvent.pointerLeave(card, { pointerType: "mouse" });
    expect(onHoverChange).toHaveBeenLastCalledWith(null);
    onHoverChange.mockClear();
    fireEvent.pointerEnter(card, { pointerType: "touch" });
    expect(onHoverChange).not.toHaveBeenCalled();
  });
});
