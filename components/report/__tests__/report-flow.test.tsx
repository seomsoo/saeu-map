import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { AddressHit } from "@/components/map/map-view";
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
    pin: null,
    geocode: vi.fn(() => Promise.resolve([])),
    onBack: vi.fn(),
    onStepChange: vi.fn(),
    onPinChange: vi.fn(),
    onShowCandidate: vi.fn(),
    onOpenExisting: vi.fn(),
    ...overrides,
  };
  const view = render(<ReportPanel {...props} />);
  return { ...view, props };
}

/** 1단계에서 이름을 넣고 2단계로 — 이름은 패널 상태라 같은 인스턴스를 rerender해야 남는다 */
function renderStep2(name: string, pin: ReportPanelProps["pin"], overrides: Partial<ReportPanelProps> = {}) {
  const view = renderPanel({ step: 1, ...overrides });
  fireEvent.change(screen.getByRole("textbox", { name: "가게 이름" }), { target: { value: name } });
  const goto = (step: ReportPanelProps["step"]) => {
    view.rerender(<ReportPanel {...view.props} step={step} pin={pin} />);
  };
  goto(2);
  return { ...view, goto };
}

// 목 fixture 기본 좌표(37.54, 126.95)는 마포구 안. 김포 고촌(37.6, 126.77)은 서울 밖.
const MAPO = { lat: 37.54, lng: 126.95 };
const GIMPO = { lat: 37.6, lng: 126.77 };
const hit = (roadAddress: string, jibunAddress = ""): AddressHit => ({ roadAddress, jibunAddress, ...MAPO });

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

describe("ReportPanel 2단계 — 위치", () => {
  it("핀이 없으면 [여기가 맞아요]가 비활성", () => {
    renderStep2("나라새우집", null);
    expect(screen.getByRole("heading", { name: "핀을 가게 위치로 옮겨주세요" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "여기가 맞아요" })).toBeDisabled();
  });

  it("주소 검색 4상태: 로딩 스켈레톤 → 결과 없음 / 실패 / 결과 행, 행을 탭하면 핀이 옮겨지고 목록이 닫힌다", async () => {
    let resolve: (hits: AddressHit[]) => void = () => {};
    let reject: (e: Error) => void = () => {};
    const geocode = vi.fn(
      () =>
        new Promise<AddressHit[]>((res, rej) => {
          resolve = res;
          reject = rej;
        }),
    );
    const { props } = renderStep2("나라새우집", MAPO, { geocode });
    const input = screen.getByRole("searchbox", { name: "도로명 주소" });
    const form = screen.getByRole("search", { name: "도로명 주소 검색" });

    fireEvent.submit(form); // 빈 질의는 부르지 않는다
    expect(geocode).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "마포대로 1" } });
    fireEvent.submit(form);
    expect(geocode).toHaveBeenCalledWith("마포대로 1");
    expect(screen.getByLabelText("주소 찾는 중")).toBeInTheDocument();
    resolve([]);
    expect(await screen.findByRole("status")).toHaveTextContent("검색 결과가 없어요");

    fireEvent.submit(form);
    reject(new Error("geocode failed"));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("주소를 찾지 못했어요");
    });

    fireEvent.submit(form);
    resolve([hit("서울 마포구 마포대로 1", "도화동 1"), hit("서울 마포구 마포대로 12")]);
    const rows = within(await screen.findByRole("list", { name: "주소 검색 결과" })).getAllByRole("button");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("도화동 1");
    fireEvent.click(rows[0] as HTMLElement);
    expect(props.onPinChange).toHaveBeenCalledWith(MAPO);
    expect(screen.queryByRole("list", { name: "주소 검색 결과" })).toBeNull();
  });

  it("한글 조합 중 Enter(submit)는 검색이 아니다", () => {
    const geocode = vi.fn(() => Promise.resolve([]));
    renderStep2("나라새우집", MAPO, { geocode });
    const input = screen.getByRole("searchbox", { name: "도로명 주소" });
    const form = screen.getByRole("search", { name: "도로명 주소 검색" });
    fireEvent.change(input, { target: { value: "마포대로" } });
    fireEvent.compositionStart(input);
    fireEvent.submit(form);
    expect(geocode).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    fireEvent.submit(form);
    expect(geocode).toHaveBeenCalledTimes(1);
  });

  it("서울 밖 핀은 [여기가 맞아요]에서 막힌다", async () => {
    const { props } = renderStep2("나라새우집", GIMPO);
    fireEvent.click(screen.getByRole("button", { name: "여기가 맞아요" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("서울 안의 위치만 제보할 수 있어요");
    expect(props.onStepChange).not.toHaveBeenCalled();
  });

  it("중복 없으면 바로 3단계", async () => {
    const { props } = renderStep2("완전히 다른 새우집", MAPO);
    fireEvent.click(screen.getByRole("button", { name: "여기가 맞아요" }));
    await waitFor(() => {
      expect(props.onStepChange).toHaveBeenCalledWith(3);
    });
    expect(props.onShowCandidate).not.toHaveBeenCalled();
  });

  it("150m 안 비슷한 상호 → 중복 의심 패널(후보·거리, 아웃라인 2개), [이 가게예요]는 그 상세로", async () => {
    const { props } = renderStep2("나라수산 본점", MAPO);
    fireEvent.click(screen.getByRole("button", { name: "여기가 맞아요" }));
    expect(await screen.findByRole("heading", { name: "150m 안에 비슷한 가게가 있어요" })).toBeInTheDocument();
    expect(props.onShowCandidate).toHaveBeenCalledWith(expect.objectContaining({ id: "nara" }));
    expect(screen.getByText("마포구 · 새우구이 · 생새우회")).toBeInTheDocument();
    expect(screen.getByText("10m")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "여기가 맞아요" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "이 가게예요" }));
    expect(props.onOpenExisting).toHaveBeenCalledWith("nara");
    expect(props.onStepChange).not.toHaveBeenCalled();
  });

  it("[다른 가게예요] → 3단계, 같은 후보는 다시 묻지 않는다. 패널의 ‹ 는 핀 화면으로 돌아온다", async () => {
    const { props, goto } = renderStep2("나라수산 본점", MAPO);
    fireEvent.click(screen.getByRole("button", { name: "여기가 맞아요" }));
    await screen.findByRole("heading", { name: "150m 안에 비슷한 가게가 있어요" });
    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    expect(screen.getByRole("heading", { name: "핀을 가게 위치로 옮겨주세요" })).toBeInTheDocument();
    expect(props.onBack).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "여기가 맞아요" }));
    await screen.findByRole("heading", { name: "150m 안에 비슷한 가게가 있어요" });
    fireEvent.click(screen.getByRole("button", { name: "다른 가게예요" }));
    expect(props.onStepChange).toHaveBeenCalledWith(3);

    // 3단계에 갔다가 돌아와 다시 확정 — 같은 후보라 바로 3단계
    goto(3);
    goto(2);
    fireEvent.click(screen.getByRole("button", { name: "여기가 맞아요" }));
    await waitFor(() => {
      expect(props.onStepChange).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByRole("heading", { name: "150m 안에 비슷한 가게가 있어요" })).toBeNull();
  });
});
