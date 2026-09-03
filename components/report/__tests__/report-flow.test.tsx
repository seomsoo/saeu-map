import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { makePlace } from "@/lib/__tests__/fixtures";
import { ReportPanel, type ReportPanelProps } from "../report-panel";

const places = [
  makePlace({ id: "nara", name: "나라수산", gu: "마포구", tags: ["grill", "raw"] }),
  makePlace({ id: "nara2", name: "나라수산 본점", gu: "마포구" }),
  makePlace({ id: "hana", name: "노량진수산시장 하나수산", gu: "동작구" }),
  ...Array.from({ length: 7 }, (_, i) => makePlace({ id: `s${i}`, name: `새우집${i}` })),
];

function renderPanel(overrides: Partial<ReportPanelProps> = {}) {
  const props: ReportPanelProps = {
    step: 1,
    places,
    onBack: vi.fn(),
    onStepChange: vi.fn(),
    onOpenExisting: vi.fn(),
    ...overrides,
  };
  const view = render(<ReportPanel {...props} />);
  return { ...view, props };
}

describe("ReportPanel 1단계 — 가게 이름", () => {
  it("열리면 입력에 포커스, 진행바 1/4, ‹ 와 [새로 등록하기]", () => {
    const { props } = renderPanel();
    expect(screen.getByRole("textbox", { name: "가게 이름" })).toHaveFocus();
    expect(screen.getByRole("progressbar", { name: "제보 진행" })).toHaveAttribute("aria-valuenow", "1");
    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByText("찾는 가게가 없나요?")).toBeInTheDocument();
  });

  it("두 글자부터 우리 DB를 맞춰 최대 5행, 행에 '이미 있어요'·구·카테고리", () => {
    renderPanel();
    const input = screen.getByRole("textbox", { name: "가게 이름" });
    fireEvent.change(input, { target: { value: "새" } });
    expect(screen.queryByRole("list", { name: "이미 있는 가게" })).toBeNull();
    fireEvent.change(input, { target: { value: "새우집" } });
    expect(within(screen.getByRole("list", { name: "이미 있는 가게" })).getAllByRole("listitem")).toHaveLength(5);
    fireEvent.change(input, { target: { value: "나라 수산" } });
    const rows = within(screen.getByRole("list", { name: "이미 있는 가게" })).getAllByRole("button");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("나라수산");
    expect(rows[0]).toHaveTextContent("마포구 · 새우구이 · 생새우회");
    expect(rows[0]).toHaveTextContent("이미 있어요");
  });

  it("매치 행을 탭하면 그 가게로 넘어간다", () => {
    const { props } = renderPanel();
    fireEvent.change(screen.getByRole("textbox", { name: "가게 이름" }), { target: { value: "하나" } });
    fireEvent.click(screen.getByRole("button", { name: /하나수산/ }));
    expect(props.onOpenExisting).toHaveBeenCalledWith("hana");
    expect(props.onStepChange).not.toHaveBeenCalled();
  });

  it("이름 없이 [새로 등록하기] → 오류 줄 + 포커스, 입력하면 오류가 사라지고 2단계로", () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "새로 등록하기" }));
    expect(screen.getByRole("alert")).toHaveTextContent("가게 이름을 입력해주세요");
    expect(screen.getByRole("textbox", { name: "가게 이름" })).toHaveAttribute("aria-invalid", "true");
    expect(props.onStepChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "가게 이름" }), { target: { value: "  " } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "새로 등록하기" }));
    expect(screen.getByRole("alert")).toBeInTheDocument(); // 공백만은 이름이 아니다
    fireEvent.change(screen.getByRole("textbox", { name: "가게 이름" }), { target: { value: "나라새우집" } });
    fireEvent.click(screen.getByRole("button", { name: "새로 등록하기" }));
    expect(props.onStepChange).toHaveBeenCalledWith(2);
  });

  it("Enter도 [새로 등록하기]와 같다 — 한글 조합 중 Enter는 아니다", () => {
    const { props } = renderPanel();
    const input = screen.getByRole("textbox", { name: "가게 이름" });
    fireEvent.change(input, { target: { value: "나라새우집" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(props.onStepChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onStepChange).toHaveBeenCalledWith(2);
  });
});

describe("ReportPanel 단계 뼈대", () => {
  it.each([
    [2, "핀을 가게 위치로 옮겨주세요", "여기가 맞아요", 3],
    [3, "메뉴와 가격을 알려주세요", "다음", 4],
    [4, "더 알려주실 게 있나요?", "건너뛰고 등록", "done"],
  ] as const)("%s단계: 제목·진행바·CTA → 다음 단계", (step, title, cta, next) => {
    const { props } = renderPanel({ step });
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "제보 진행" })).toHaveAttribute("aria-valuenow", String(step));
    fireEvent.click(screen.getByRole("button", { name: cta }));
    expect(props.onStepChange).toHaveBeenCalledWith(next);
  });

  it("완료: 진행바·‹ 없이 제목과 [내 핀 보러가기]", () => {
    renderPanel({ step: "done" });
    expect(screen.getByRole("heading", { name: "등록됐어요!" })).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByRole("button", { name: "이전" })).toBeNull();
    expect(screen.getByRole("button", { name: "내 핀 보러가기" })).toBeInTheDocument();
  });
});
