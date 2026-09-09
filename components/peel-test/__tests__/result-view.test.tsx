import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PeelResultView } from "../result-view";
import { makePlace } from "@/lib/__tests__/fixtures";
import content from "@/lib/mock/peel-test.json";
import { LINK_COPIED_NOTICE } from "@/lib/share";
import type { PeelTest, PeelType, Place } from "@/lib/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

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
    <PeelResultView type={jipge} partner={wansik} places={places} now={NOW} />,
  );
}

beforeEach(() => {
  push.mockClear();
});

describe("결과 화면", () => {
  it("유형 이름·한 줄·설명·조심할 점", () => {
    view();
    expect(screen.getByRole("heading", { level: 1, name: jipge.name })).toBeInTheDocument();
    expect(screen.getByText(jipge.tagline)).toBeInTheDocument();
    expect(screen.getByText(jipge.description)).toBeInTheDocument();
    expect(screen.getByText(jipge.caution)).toBeInTheDocument();
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

describe("공유 두 갈래", () => {
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

  it("[결과 공유하기]는 내 유형 링크를 보낸다", () => {
    expect(sharedUrlAfter("결과 공유하기")).toContain("/test/jipge");
  });

  it("[친구와 궁합 보기]는 초대 링크를 보낸다 — 링크 하나가 다음 테스트를 부른다", () => {
    expect(sharedUrlAfter("친구와 궁합 보기")).toContain("/test/with/jipge");
  });

  it("공유 시트가 없으면 링크를 복사하고 토스트를 띄운다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    view();
    fireEvent.click(screen.getByRole("button", { name: "결과 공유하기" }));
    await waitFor(() => {
      expect(screen.getByText(LINK_COPIED_NOTICE)).toBeInTheDocument();
    });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/test/jipge"));
    vi.unstubAllGlobals();
  });
});
