import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PeelMatchView } from "../match-view";
import { makePlace } from "@/lib/__tests__/fixtures";
import content from "@/lib/mock/peel-test.json";
import { matchKey } from "@/lib/peel-test";
import type { PeelMatch, PeelTest, PeelType, Place } from "@/lib/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const test = content as PeelTest;
const NOW = "2026-09-09T03:00:00.000Z";

function typeOf(slug: string): PeelType {
  const found = test.types.find((t) => t.slug === slug);
  if (!found) throw new Error(slug);
  return found;
}

function matchOf(a: PeelType, b: PeelType): PeelMatch {
  const key = matchKey(a, b);
  const found = test.matches.find((m) => m.key === key);
  if (!found) throw new Error(key);
  return found;
}

const jipge = typeOf("jipge");
const wansik = typeOf("wansik");

function view(
  mine: PeelType = jipge,
  partner: PeelType = wansik,
  places: Place[] = [makePlace({ id: "p1", name: "나라수산" })],
) {
  return render(
    <PeelMatchView
      mine={mine}
      partner={partner}
      match={matchOf(mine, partner)}
      places={places}
      now={NOW}
    />,
  );
}

beforeEach(() => {
  push.mockClear();
});

describe("궁합 결과", () => {
  it("두 유형과 궁합 수, 관계 한 줄", () => {
    view();
    expect(screen.getByLabelText("궁합 100점")).toHaveTextContent("100");
    expect(screen.getByText(jipge.name)).toBeInTheDocument();
    expect(screen.getByText(wansik.name)).toBeInTheDocument();
    const match = matchOf(jipge, wansik);
    expect(screen.getByRole("heading", { level: 1, name: match.title })).toBeInTheDocument();
    expect(screen.getByText(match.description)).toBeInTheDocument();
  });

  it("취향이 갈린 조합은 R2 카피가 온다", () => {
    const chojang = typeOf("chojang");
    view(jipge, chojang);
    expect(screen.getByRole("heading", { level: 1, name: "역할은 맞는데 메뉴에서 갈린다" })).toBeInTheDocument();
    expect(screen.getByLabelText("궁합 80점")).toBeInTheDocument();
  });

  it("둘 다 받는 쪽이면 R4다", () => {
    view(wansik, typeOf("chojang"));
    expect(screen.getByRole("heading", { level: 1, name: "아무도 집게를 안 든다" })).toBeInTheDocument();
  });

  it("같이 갈 가게를 그리고 누르면 상세로 간다", () => {
    view();
    expect(screen.getByRole("heading", { name: "둘이 같이 갈 새우집" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /나라수산/ }));
    expect(push).toHaveBeenCalledWith("/place/p1");
  });

  it("추천이 0곳이면 빈 상태 (궁합 자체는 그대로 보인다)", () => {
    view(jipge, wansik, []);
    expect(screen.getByText("아직 둘 다 만족할 집을 못 찾았어요")).toBeInTheDocument();
    expect(screen.getByLabelText("궁합 100점")).toBeInTheDocument();
  });
});

describe("나가는 길", () => {
  it("[궁합 공유하기]는 궁합 링크를 보낸다", () => {
    const share = vi.fn<(data: { title: string; url: string }) => Promise<void>>();
    share.mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, clipboard: { writeText: vi.fn() } });
    view();
    fireEvent.click(screen.getByRole("button", { name: "궁합 공유하기" }));
    vi.unstubAllGlobals();
    expect(share.mock.calls[0]?.[0].url).toContain("/test/jipge/wansik");
  });

  it("내 결과와 다시 하기로 나갈 수 있다", () => {
    view();
    expect(screen.getByRole("link", { name: "내 결과 보기" })).toHaveAttribute("href", "/test/jipge");
    expect(screen.getByRole("link", { name: "다시 하기" })).toHaveAttribute("href", "/test");
  });
});
