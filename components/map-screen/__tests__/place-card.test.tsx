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
        userLocation={null}
        selected={false}
        onSelect={onSelect}
        {...overrides}
      />
    </ul>,
  );
  return { place, onSelect, unmount };
}

describe("PlaceCard", () => {
  it("상호 · 구 · 메뉴+단위칩+가격 · 사이드 · 확인 라벨", () => {
    renderCard();
    expect(screen.getByRole("heading", { name: "나라수산" })).toBeInTheDocument();
    expect(screen.getByText("마포구")).toBeInTheDocument();
    expect(screen.getByText("생새우소금구이")).toBeInTheDocument();
    expect(screen.getByText("1kg")).toBeInTheDocument();
    expect(screen.getByText("60,000")).toBeInTheDocument();
    expect(screen.getByText("어제 확인")).toBeInTheDocument();
    // 사이드: 있는 것만
    const sides = screen.getByRole("list", { name: "사이드" });
    expect(sides).toHaveTextContent("머리버터구이");
    expect(sides).toHaveTextContent("라면");
    expect(sides).not.toHaveTextContent("볶음밥");
  });

  it("위치 없으면 거리 숨김, 있으면 '구 · 거리'", () => {
    const first = renderCard();
    expect(screen.getByText("마포구")).not.toHaveTextContent("km");
    first.unmount();

    renderCard({ userLocation: { lat: 37.54, lng: 126.95 } });
    expect(screen.getByText(/마포구 · \d+m$/)).toBeInTheDocument();
  });

  it("신규는 확인 라벨 대신 '새로 제보됨'", () => {
    const place = makePlace({ isNew: true, lastCheckedAt: YESTERDAY });
    render(
      <ul>
        <PlaceCard place={place} now={NOW} userLocation={null} selected={false} onSelect={vi.fn()} />
      </ul>,
    );
    expect(screen.getByText("새로 제보됨")).toBeInTheDocument();
    expect(screen.queryByText("어제 확인")).not.toBeInTheDocument();
  });

  it("메뉴 없으면 메뉴 줄 없음", () => {
    const place = makePlace({ menus: [] });
    render(
      <ul>
        <PlaceCard place={place} now={NOW} userLocation={null} selected={false} onSelect={vi.fn()} />
      </ul>,
    );
    expect(screen.queryByText(/,\d{3}/)).not.toBeInTheDocument();
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
