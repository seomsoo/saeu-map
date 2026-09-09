import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PeelTest } from "../peel-test";
import content from "@/lib/mock/peel-test.json";
import type { PeelTest as PeelTestContent, PeelType } from "@/lib/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const test = content as PeelTestContent;
const questions = test.questions;

beforeEach(() => {
  push.mockClear();
});

/** @tsconfig/strictest라 인덱스 접근이 undefined를 낼 수 있다 — 없으면 테스트를 세운다 */
function q(i: number) {
  const question = questions[i];
  if (!question) throw new Error(`문항 ${i}이 없다`);
  return question;
}

function click(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

/** 표지에서 [시작하기]를 누르고 문항마다 `choices[pick]`을 고른다. */
function play(picks: readonly (0 | 1)[]) {
  click("시작하기");
  for (const [i, pick] of picks.entries()) click(q(i).choices[pick]);
}

describe("표지", () => {
  it("제목·부제·소요 시간과 시작 버튼", () => {
    render(<PeelTest content={test} />);
    expect(screen.getByRole("heading", { name: test.title })).toBeInTheDocument();
    expect(screen.getByText(test.subtitle)).toBeInTheDocument();
    expect(screen.getByText(test.duration)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "시작하기" })).toBeInTheDocument();
  });

  it("궁합 초대면 상대 유형이 눈썹에 뜬다", () => {
    const partner = test.types[0] as PeelType;
    render(<PeelTest content={test} partner={partner} />);
    expect(screen.getByText(`${partner.name}이 궁합을 신청했어요`)).toBeInTheDocument();
    expect(screen.getByText("질문 6개를 풀면 둘의 궁합이 나와요")).toBeInTheDocument();
  });
});

describe("문항", () => {
  it("시작하면 1번 문항과 진행 칸이 보인다", () => {
    render(<PeelTest content={test} />);
    click("시작하기");

    expect(screen.getByRole("heading", { name: q(0).text })).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "6");
  });

  it("고르면 다음 문항으로 넘어간다", () => {
    render(<PeelTest content={test} />);
    play([0, 0]);

    expect(screen.getByRole("heading", { name: q(2).text })).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
  });

  it("[이전]은 앞 문항으로 돌아가고 첫 문항에서는 표지로 나간다", () => {
    render(<PeelTest content={test} />);
    play([0]);

    click("이전");
    expect(screen.getByRole("heading", { name: q(0).text })).toBeInTheDocument();

    click("이전");
    expect(screen.getByRole("button", { name: "시작하기" })).toBeInTheDocument();
  });

  it("되돌아가 다른 답을 고르면 결과가 바뀐다", () => {
    render(<PeelTest content={test} />);
    // 1번(축 A)만 되돌려 반대로 고른다 — 나머지는 그대로 앞쪽
    play([0]);
    click("이전");
    click(q(0).choices[1]);
    for (const i of [1, 2, 3, 4, 5]) click(q(i).choices[i === 2 || i === 4 ? 1 : 0]);
    // 축 A는 3문항 중 3표가 "받는다", 축 B는 3표가 "구이" → 완식형
    expect(push).toHaveBeenCalledWith("/test/wansik");
  });
});

describe("결과로 넘어가기", () => {
  it("6번째를 고르면 유형 결과로 push한다", () => {
    render(<PeelTest content={test} />);
    play([0, 0, 0, 0, 0, 0]);
    expect(push).toHaveBeenCalledWith("/test/jipge");
  });

  it("궁합 초대로 들어왔으면 궁합 결과로 push한다", () => {
    const partner = test.types[2] as PeelType;
    render(<PeelTest content={test} partner={partner} />);
    play([1, 1, 1, 1, 1, 1]);
    expect(push).toHaveBeenCalledWith(`/test/chojang/${partner.slug}`);
  });

  it("마지막 답 전에는 아무 데도 안 간다", () => {
    render(<PeelTest content={test} />);
    play([0, 0, 0, 0, 0]);
    expect(push).not.toHaveBeenCalled();
  });
});
