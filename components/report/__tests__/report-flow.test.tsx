import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { AddressHit } from "@/components/map/map-view";
import { makePlace } from "@/lib/__tests__/fixtures";
import type { ReportInput } from "@/lib/data";
import type { Place } from "@/lib/types";
import { ReportPanel, type ReportPanelProps } from "../report-panel";

// 등록만 가짜. 구 판정은 기본이 진짜(factory에서 연결)고, 검사 도중 단계를 떠나는 테스트만 응답 시점을 잡는다
const dataMocks = vi.hoisted(() => ({
  submitReport: vi.fn<(input: ReportInput, now: string) => Promise<Place>>(),
  getGuOfPoint: vi.fn<(point: { lat: number; lng: number }) => Promise<string | null>>(),
}));
vi.mock("@/lib/data", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/data")>();
  dataMocks.getGuOfPoint.mockImplementation(original.getGuOfPoint);
  return { ...original, submitReport: dataMocks.submitReport, getGuOfPoint: dataMocks.getGuOfPoint };
});

const NOW = "2026-09-04T12:00:00+09:00";

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
    now: NOW,
    pin: null,
    geocode: vi.fn(() => Promise.resolve([])),
    onBack: vi.fn(),
    onStepChange: vi.fn(),
    onPinChange: vi.fn(),
    onShowCandidate: vi.fn(),
    tappedPlaceId: null,
    onClearTapped: vi.fn(),
    onOpenExisting: vi.fn(),
    onCreated: vi.fn(),
    onNotice: vi.fn(),
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

// 목 fixture 기본 좌표(37.54, 126.95)는 마포구 안. 서해(36.0, 125.0)는 한국 밖.
const MAPO = { lat: 37.54, lng: 126.95 };
const SEA = { lat: 36.0, lng: 125.0 };
const hit = (roadAddress: string, jibunAddress = ""): AddressHit => ({ roadAddress, jibunAddress, ...MAPO });

describe("ReportPanel 1단계 — 가게 이름", () => {
  it("열리면 입력에 포커스, 진행바 1/4, ‹ 와 [새로 등록하기]", () => {
    const { props } = renderPanel();
    expect(screen.getByRole("textbox", { name: "가게 이름" })).toHaveFocus();
    expect(screen.getByRole("progressbar", { name: "제보 진행" })).toHaveAttribute("aria-valuenow", "1");
    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "새로 등록하기" })).toBeInTheDocument();
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

  it("[새로 등록하기]는 매치 유무와 무관하게 늘 있고, 설명 캡션은 없다", () => {
    renderPanel();
    const input = screen.getByRole("textbox", { name: "가게 이름" });
    const cta = () => screen.getByRole("button", { name: "새로 등록하기" });
    expect(cta()).toBeInTheDocument();
    expect(screen.queryByText("찾는 가게가 없나요?")).toBeNull();
    fireEvent.change(input, { target: { value: "나라 수산" } });
    expect(screen.getByRole("list", { name: "이미 있는 가게" })).toBeInTheDocument();
    expect(cta()).toBeInTheDocument(); // 매치가 있어도 "그중엔 없다"며 등록할 수 있어야 한다
    fireEvent.change(input, { target: { value: "없는가게이름" } });
    expect(cta()).toBeInTheDocument();
    expect(screen.queryByText("찾는 가게가 없나요?")).toBeNull();
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

  it("한국 밖(바다) 핀은 [여기가 맞아요]에서 막힌다", async () => {
    const { props } = renderStep2("나라새우집", SEA);
    fireEvent.click(screen.getByRole("button", { name: "여기가 맞아요" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("한국 안의 위치만 제보할 수 있어요");
    expect(props.onStepChange).not.toHaveBeenCalled();
  });

  it("서울 밖(김포)도 통과한다", async () => {
    const { props } = renderStep2("김포 새우집", { lat: 37.6, lng: 126.77 });
    fireEvent.click(screen.getByRole("button", { name: "여기가 맞아요" }));
    await waitFor(() => {
      expect(props.onStepChange).toHaveBeenCalledWith(3);
    });
  });

  it("비슷한 상호도 없고 핀 자리(30m)에 가게도 없으면 바로 3단계", async () => {
    // fixture 가게들은 전부 MAPO에 있다 — 40m 떨어진 핀은 근접 검사에 안 걸린다
    const { props } = renderStep2("완전히 다른 새우집", { lat: MAPO.lat + 0.00036, lng: MAPO.lng });
    fireEvent.click(screen.getByRole("button", { name: "여기가 맞아요" }));
    await waitFor(() => {
      expect(props.onStepChange).toHaveBeenCalledWith(3);
    });
    expect(props.onShowCandidate).not.toHaveBeenCalled();
  });

  it("상호가 전혀 달라도 핀 자리 30m 안에 가게가 있으면 '핀 자리에 이미 등록된 가게가 있어요'", async () => {
    const { props } = renderStep2("완전히 다른 새우집", MAPO);
    fireEvent.click(screen.getByRole("button", { name: "여기가 맞아요" }));
    expect(await screen.findByRole("heading", { name: "핀 자리에 이미 등록된 가게가 있어요" })).toBeInTheDocument();
    expect(props.onShowCandidate).toHaveBeenCalledWith(expect.objectContaining({ id: "nara" }));
    fireEvent.click(screen.getByRole("button", { name: "다른 가게예요" }));
    expect(props.onStepChange).toHaveBeenCalledWith(3);
  });

  it("지도에서 탭한 기존 마커(tappedPlaceId)는 바로 후보 패널('이미 등록된 가게예요'), ‹는 onClearTapped", () => {
    const { props } = renderStep2("나라새우집", MAPO, { tappedPlaceId: "hana" });
    expect(screen.getByRole("heading", { name: "이미 등록된 가게예요" })).toBeInTheDocument();
    expect(screen.getByText("노량진수산시장 하나수산")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    expect(props.onClearTapped).toHaveBeenCalledTimes(1);
    expect(props.onBack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "이 가게예요" }));
    expect(props.onOpenExisting).toHaveBeenCalledWith("hana");
    // [다른 가게예요]는 3단계가 아니라 핀 화면으로 — 등록은 [여기가 맞아요]의 검사를 거친다
    fireEvent.click(screen.getByRole("button", { name: "다른 가게예요" }));
    expect(props.onClearTapped).toHaveBeenCalledTimes(2);
    expect(props.onStepChange).not.toHaveBeenCalled();
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

  it("확정 검사 중에 이 단계를 떠나면(‹·✕) 늦게 끝난 검사가 단계를 옮기지 않는다 (Codex PR #6 #2)", async () => {
    let resolveGu: (gu: string | null) => void = () => {};
    dataMocks.getGuOfPoint.mockImplementationOnce(
      () =>
        new Promise<string | null>((resolve) => {
          resolveGu = resolve;
        }),
    );
    // 후보가 없는 입력 — 검사가 끝나면 그대로 onConfirm(3단계)이 불리던 경우
    const { props, goto } = renderStep2("완전히 다른 새우집", { lat: MAPO.lat + 0.00036, lng: MAPO.lng });
    fireEvent.click(screen.getByRole("button", { name: "여기가 맞아요" }));
    goto(1); // 경계 판정이 끝나기 전에 ‹ — 2단계가 언마운트된다
    await act(async () => {
      resolveGu("마포구");
      await Promise.resolve();
    });
    expect(props.onStepChange).not.toHaveBeenCalled();
    expect(props.onShowCandidate).not.toHaveBeenCalled();
  });
});

describe("ReportPanel 3단계 — 메뉴와 가격", () => {
  const fill = (line: "" | "새우회 ", name: string, price: string) => {
    fireEvent.change(screen.getByRole("textbox", { name: `${line}메뉴명` }), { target: { value: name } });
    const priceInputs = screen.getAllByRole("textbox", { name: "가격" });
    fireEvent.change(priceInputs[line ? 1 : 0] as HTMLElement, { target: { value: price } });
  };

  it("빈 채로 [다음] → 이름·가격·단위 오류 세 줄, 고치면 그 오류만 사라진다", () => {
    const { props } = renderPanel({ step: 3 });
    expect(screen.getByRole("progressbar", { name: "제보 진행" })).toHaveAttribute("aria-valuenow", "3");
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    const alerts = screen.getAllByRole("alert").map((a) => a.textContent);
    expect(alerts).toEqual(["메뉴 이름을 알려주세요", "가격을 숫자로 알려주세요", "단위를 골라주세요"]);
    expect(props.onStepChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "메뉴명" }), { target: { value: "왕새우 소금구이" } });
    expect(screen.getAllByRole("alert")).toHaveLength(2);
  });

  it("가격은 숫자만 받아 천 단위로 보여주고, 채우면 4단계로. 값은 단계를 오가도 남는다", () => {
    const { props, rerender } = renderPanel({ step: 3 });
    fill("", "왕새우 소금구이", "3만5천원");
    expect(screen.getByRole("textbox", { name: "가격" })).toHaveValue("35");
    fireEvent.change(screen.getByRole("textbox", { name: "가격" }), { target: { value: "35000" } });
    expect(screen.getByRole("textbox", { name: "가격" })).toHaveValue("35,000");
    fireEvent.click(within(screen.getByRole("group", { name: "단위" })).getByRole("button", { name: "1kg" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(props.onStepChange).toHaveBeenCalledWith(4);

    rerender(<ReportPanel {...props} step={4} />);
    rerender(<ReportPanel {...props} step={3} />);
    expect(screen.getByRole("textbox", { name: "메뉴명" })).toHaveValue("왕새우 소금구이");
    expect(screen.getByRole("textbox", { name: "가격" })).toHaveValue("35,000");
    expect(screen.getByRole("button", { name: "1kg" })).toHaveAttribute("aria-pressed", "true");
  });

  it("[마리]를 고르면 칩 행 아래에 몇 마리 입력이 나와 포커스되고, 비어 있으면 오류가 그 아래", () => {
    const { props } = renderPanel({ step: 3 });
    fill("", "대하", "20000");
    fireEvent.click(screen.getByRole("button", { name: "마리" }));
    const count = screen.getByRole("textbox", { name: "몇 마리" });
    expect(count).toHaveFocus();
    expect(within(screen.getByRole("group", { name: "단위" })).queryByRole("textbox")).toBeNull(); // 칩 행 밖
    expect(screen.getByText("마리", { selector: "span" })).toBeInTheDocument(); // 접미
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByRole("alert")).toHaveTextContent("몇 마리인지 알려주세요");
    fireEvent.change(count, { target: { value: "10" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(props.onStepChange).toHaveBeenCalledWith(4);
  });

  it("rawToo가 켜진 채 3단계에 다시 들어오면 포커스를 뺏지 않는다 (단계는 switch로 언마운트된다)", () => {
    const { rerender, props } = renderPanel({ step: 3 });
    fill("", "왕새우 소금구이", "35000");
    fireEvent.click(screen.getByRole("button", { name: "1kg" }));
    fireEvent.click(screen.getByRole("switch", { name: "새우회도 팔아요" }));
    expect(screen.getByRole("textbox", { name: "새우회 메뉴명" })).toHaveFocus();
    // 4단계로 갔다가 ‹로 돌아온다 — 3단계가 통째로 다시 마운트된다
    rerender(<ReportPanel {...props} step={4} />);
    rerender(<ReportPanel {...props} step={3} />);
    expect(screen.getByRole("textbox", { name: "새우회 메뉴명" })).not.toHaveFocus();
  });

  it("'새우회도 팔아요'를 켜면 회 줄이 펼쳐지고 그 줄도 검증된다", () => {
    const { props } = renderPanel({ step: 3 });
    fill("", "왕새우 소금구이", "35000");
    fireEvent.click(screen.getByRole("button", { name: "1kg" }));
    expect(screen.queryByRole("textbox", { name: "새우회 메뉴명" })).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "새우회도 팔아요" }));
    expect(screen.getByRole("switch", { name: "새우회도 팔아요" })).toHaveAttribute("aria-checked", "true");
    // 회 줄은 토글 아래에 생겨 스크롤 밖이면 안 보인다 — 켠 직후 메뉴명에 포커스를 줘 따라 올라오게 한다
    expect(screen.getByRole("textbox", { name: "새우회 메뉴명" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getAllByRole("alert")).toHaveLength(3); // 회 줄의 세 오류
    expect(props.onStepChange).not.toHaveBeenCalled();
    fill("새우회 ", "생새우회", "40000");
    fireEvent.click(within(screen.getByRole("group", { name: "새우회 단위" })).getByRole("button", { name: "500g" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(props.onStepChange).toHaveBeenCalledWith(4);
    // 끄면 회 줄은 사라지고 검증에서도 빠진다
    fireEvent.click(screen.getByRole("switch", { name: "새우회도 팔아요" }));
    expect(screen.queryByRole("textbox", { name: "새우회 메뉴명" })).toBeNull();
  });
});

/** 1~3단계 값을 채우고 4단계로 — 등록 입력은 패널 상태에서 나온다 */
function renderStep4(overrides: Partial<ReportPanelProps> = {}) {
  const view = renderStep2("테스트 새우집", MAPO, overrides);
  view.goto(3);
  fireEvent.change(screen.getByRole("textbox", { name: "메뉴명" }), { target: { value: "왕새우 소금구이" } });
  fireEvent.change(screen.getByRole("textbox", { name: "가격" }), { target: { value: "35000" } });
  fireEvent.click(screen.getByRole("button", { name: "1kg" }));
  view.goto(4);
  return view;
}

const image = (name: string) => new File(["x"], name, { type: "image/jpeg" });

describe("ReportPanel 4단계 — 선택 항목 + 등록", () => {
  // jsdom에는 createObjectURL이 없다 — 미리보기 URL 생성·해제를 셀 수 있게 가짜로
  const createObjectURL = vi.fn((file: Blob) => `blob:${(file as File).name}`);
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    dataMocks.submitReport.mockReset();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("CTA는 하나: 비어 있으면 [건너뛰고 등록], 하나라도 넣으면 [등록하기]", () => {
    renderStep4();
    expect(screen.getByRole("progressbar", { name: "제보 진행" })).toHaveAttribute("aria-valuenow", "4");
    expect(screen.getByRole("button", { name: "건너뛰고 등록" })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: "사이드" })).getByRole("button", { name: "라면" }));
    expect(screen.getByRole("button", { name: "등록하기" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "라면" }));
    expect(screen.getByRole("button", { name: "건너뛰고 등록" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "영업시간" }), { target: { value: "월 휴무" } });
    expect(screen.getByRole("button", { name: "등록하기" })).toBeInTheDocument();
  });

  it("사진: 파일 선택 → 미리보기 타일 + 카운터, 이미지가 아닌 파일은 거르고, 제거 ✕, 10장이 차면 ＋ 타일이 사라진다", () => {
    renderStep4();
    const input = screen.getByLabelText("사진 파일");
    fireEvent.change(input, {
      target: { files: [image("a.jpg"), new File(["x"], "note.txt", { type: "text/plain" }), image("b.jpg")] },
    });
    expect(screen.getByText("2/10")).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /고른 사진/ })).toHaveLength(2);
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "등록하기" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "사진 1 제거" }));
    expect(screen.getByText("1/10")).toBeInTheDocument();
    expect(revokeObjectURL).toHaveBeenCalled();

    fireEvent.change(input, { target: { files: Array.from({ length: 12 }, (_, i) => image(`${String(i)}.jpg`)) } });
    expect(screen.getByText("10/10")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "사진 추가" })).toBeNull();
  });

  it("등록 성공: 스키마 입력(이름·핀·메뉴·사이드·영업시간·사진·중복 후보)으로 submitReport → onCreated + 완료", async () => {
    const created = makePlace({ id: "r001", name: "테스트 새우집", source: "report", isNew: true });
    let resolve: (place: Place) => void = () => {};
    dataMocks.submitReport.mockImplementation(
      () =>
        new Promise<Place>((res) => {
          resolve = res;
        }),
    );
    const { props, goto } = renderStep4();
    fireEvent.change(screen.getByLabelText("사진 파일"), { target: { files: [image("a.jpg")] } });
    fireEvent.click(screen.getByRole("button", { name: "머리버터구이" }));
    fireEvent.change(screen.getByRole("textbox", { name: "영업시간" }), { target: { value: " 새벽 2시까지 " } });
    fireEvent.click(screen.getByRole("button", { name: "등록하기" }));

    const pending = screen.getByRole("button", { name: "등록 중…" });
    expect(pending).toBeDisabled();
    expect(pending).toHaveAttribute("aria-busy", "true");
    expect(dataMocks.submitReport).toHaveBeenCalledWith(
      {
        name: "테스트 새우집",
        lat: MAPO.lat,
        lng: MAPO.lng,
        menus: [{ name: "왕새우 소금구이", price: 35000, unit: "kg", unitRaw: "1", raw: false }],
        sides: { headButter: true, ramen: false, friedRice: false },
        hoursNote: " 새벽 2시까지 ",
        photos: [expect.objectContaining({ name: "a.jpg" })],
        duplicateOf: null,
      },
      NOW,
    );
    resolve(created);
    await waitFor(() => {
      expect(props.onStepChange).toHaveBeenCalledWith("done");
    });
    expect(props.onCreated).toHaveBeenCalledWith(created);

    goto("done");
    expect(screen.getByRole("heading", { name: "등록됐어요!" })).toBeInTheDocument();
    const card = screen.getByLabelText("등록한 가게");
    expect(card).toHaveTextContent("테스트 새우집");
    expect(card).toHaveTextContent("마포구 · 새우구이");
    fireEvent.click(screen.getByRole("button", { name: "내 핀 보러가기" }));
    expect(props.onOpenExisting).toHaveBeenCalledWith("r001");
    fireEvent.click(screen.getByRole("button", { name: "리뷰도 남겨볼래요?" }));
    expect(props.onNotice).toHaveBeenCalledWith("준비 중이에요");
  });

  it("완료 카드의 [공유]는 상세와 같은 길 (기기 공유 시트 → 링크 복사)", async () => {
    const created = makePlace({ id: "r002", name: "공유 새우집", source: "report", isNew: true });
    dataMocks.submitReport.mockResolvedValue(created);
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    const { goto } = renderStep4();
    fireEvent.click(screen.getByRole("button", { name: "건너뛰고 등록" }));
    await waitFor(() => {
      expect(dataMocks.submitReport).toHaveBeenCalled();
    });
    goto("done");
    fireEvent.click(screen.getByRole("button", { name: "공유" }));
    expect(share).toHaveBeenCalledWith({ title: "공유 새우집", url: `${window.location.origin}/place/r002` });
  });

  it("등록 실패: 토스트 + 4단계 유지, 버튼은 다시 눌린다(같은 버튼이 재시도)", async () => {
    dataMocks.submitReport.mockRejectedValueOnce(new Error("mock write failed"));
    const { props } = renderStep4();
    fireEvent.click(screen.getByRole("button", { name: "건너뛰고 등록" }));
    await waitFor(() => {
      expect(props.onNotice).toHaveBeenCalledWith("등록하지 못했어요. 다시 시도해주세요");
    });
    expect(props.onStepChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "건너뛰고 등록" })).toBeEnabled();
    expect(screen.getByRole("heading", { name: "더 알려주실 게 있나요?" })).toBeInTheDocument();
  });

  it("3단계 값이 사라졌으면(뒤로 가서 지움) 등록 대신 3단계로 돌려보낸다", async () => {
    const { props, goto } = renderStep4();
    goto(3);
    fireEvent.change(screen.getByRole("textbox", { name: "메뉴명" }), { target: { value: "" } });
    goto(4);
    fireEvent.click(screen.getByRole("button", { name: "건너뛰고 등록" }));
    await waitFor(() => {
      expect(props.onStepChange).toHaveBeenCalledWith(3);
    });
    expect(dataMocks.submitReport).not.toHaveBeenCalled();
  });
});
