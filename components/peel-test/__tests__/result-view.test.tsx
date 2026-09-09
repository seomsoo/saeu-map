import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PeelResultView } from "../result-view";
import { makePlace } from "@/lib/__tests__/fixtures";
import content from "@/lib/mock/peel-test.json";
import { LINK_COPIED_NOTICE } from "@/lib/share";
import type { PeelTest, PeelType, Place } from "@/lib/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

/** 이 세션에서 직접 풀었는지 — 결과 화면이 방문자와 응시자를 가른다 */
const flag = vi.hoisted(() => ({ tookTest: false }));
vi.mock("../session-flag", () => ({
  markTestFinished: () => {
    flag.tookTest = true;
  },
  useTookTest: () => flag.tookTest,
}));

const test = content as PeelTest;
const NOW = "2026-09-09T03:00:00.000Z";

function typeOf(slug: string): PeelType {
  const found = test.types.find((t) => t.slug === slug);
  if (!found) throw new Error(slug);
  return found;
}

const jipge = typeOf("jipge");
const wansik = typeOf("wansik");

function view(places: Place[] = [makePlace({ id: "p1", name: "나라수산" })]) {
  return render(
    <PeelResultView
      type={jipge}
      partner={wansik}
      types={test.types}
      places={places}
      now={NOW}
    />,
  );
}

beforeEach(() => {
  push.mockClear();
  flag.tookTest = false;
});

describe("결과 화면", () => {
  it("유형 이름·한 줄·설명·조심할 점", () => {
    view();
    expect(screen.getByRole("heading", { level: 1, name: jipge.name })).toBeInTheDocument();
    expect(screen.getByText(jipge.tagline)).toBeInTheDocument();
    expect(screen.getByText(jipge.description)).toBeInTheDocument();
    expect(screen.getByText(jipge.caution)).toBeInTheDocument();
  });

  it("네 유형 매트릭스에서 내 자리를 표시한다", () => {
    view();
    expect(screen.getByRole("heading", { name: "네 유형 중 내 자리" })).toBeInTheDocument();
    for (const type of test.types) expect(screen.getByText(type.shortName)).toBeInTheDocument();
    expect(screen.getByText(jipge.shortName).closest("[aria-current]")).not.toBeNull();
  });

  it("해시태그 3개를 보여준다", () => {
    view();
    for (const tag of jipge.tags) expect(screen.getByText(tag)).toBeInTheDocument();
  });

  it("잘 맞는 유형을 알려준다", () => {
    view();
    expect(screen.getByText(`잘 맞는 유형은 ${wansik.name}`)).toBeInTheDocument();
  });

  it("추천 가게 카드를 그리고 누르면 상세로 간다", () => {
    view();
    expect(screen.getByRole("heading", { name: "이 유형에 어울리는 새우집" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /나라수산/ }));
    expect(push).toHaveBeenCalledWith("/place/p1");
  });

  it("추천이 0곳이면 빈 상태 (결과 자체는 그대로 보인다)", () => {
    view([]);
    expect(screen.getByText("아직 어울리는 집을 못 찾았어요")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: jipge.name })).toBeInTheDocument();
  });
});

describe("공유는 하나 — 초대 링크만 보낸다", () => {
  /** 기기 공유 시트를 세우고 버튼을 눌러 넘어간 url을 돌려준다 */
  function sharedUrlAfter(label: string): string | undefined {
    const share = vi.fn<(data: { title: string; url: string }) => Promise<void>>();
    share.mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, clipboard: { writeText: vi.fn() } });
    view();
    fireEvent.click(screen.getByRole("button", { name: label }));
    vi.unstubAllGlobals();
    return share.mock.calls[0]?.[0].url;
  }

  it("[친구에게 보내기]는 결과 링크가 아니라 초대 링크다 — 링크 하나가 다음 테스트를 부른다", () => {
    const url = sharedUrlAfter("친구에게 보내기");
    expect(url).toContain("/test/with/jipge");
  });

  it("무엇이 일어나는지 버튼 아래 한 줄로 말한다", () => {
    view();
    expect(screen.getByText("친구가 풀면 둘의 궁합이 나와요")).toBeInTheDocument();
  });

  it("공유 링크로 들어온 사람에게는 [나도 해보기] 버튼이 있다", () => {
    view();
    expect(screen.getByRole("link", { name: "나도 해보기" })).toHaveAttribute("href", "/test");
    expect(screen.queryByRole("link", { name: "다시 하기" })).toBeNull();
  });

  it("방금 푼 사람에게는 [나도 해보기] 대신 [다시 하기]다", () => {
    flag.tookTest = true;
    view();
    expect(screen.queryByRole("link", { name: "나도 해보기" })).toBeNull();
    expect(screen.getByRole("link", { name: "다시 하기" })).toHaveAttribute("href", "/test");
  });

  it("공유 시트가 없으면 링크를 복사하고 토스트를 띄운다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    view();
    fireEvent.click(screen.getByRole("button", { name: "친구에게 보내기" }));
    await waitFor(() => {
      expect(screen.getByText(LINK_COPIED_NOTICE)).toBeInTheDocument();
    });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/test/with/jipge"));
    vi.unstubAllGlobals();
  });
});
