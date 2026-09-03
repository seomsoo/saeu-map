import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { makeMenu, makePlace } from "@/lib/__tests__/fixtures";
import { MAX_PLACE_PHOTOS } from "@/lib/data";
import type { Photo, Place, PlaceDetail as PlaceDetailData, Review } from "@/lib/types";
import { PlaceDetail, type PlaceDetailProps } from "../place-detail";

type PhotoReport = Parameters<typeof import("@/lib/data").reportPhoto>[0];

const data = vi.hoisted(() => ({
  getPlaceDetail: vi.fn<(id: string, now: string) => Promise<PlaceDetailData | undefined>>(),
  checkIn: vi.fn<(id: string, now: string) => Promise<Place>>(),
  reportPhoto: vi.fn<(input: PhotoReport) => Promise<void>>(),
}));

// 상수(MAX_PLACE_PHOTOS)는 진짜 값을 쓰고 쓰기 함수만 가짜로 — 상한을 테스트에 두 번 적지 않는다
vi.mock("@/lib/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data")>()),
  getPlaceDetail: data.getPlaceDetail,
  checkIn: data.checkIn,
  reportPhoto: data.reportPhoto,
}));

const NOW = "2026-09-01T12:00:00+09:00";
const day = (d: number) => new Date(Date.parse(NOW) - d * 86_400_000).toISOString();

const photo = (n: number): Photo => ({
  id: `nara-p${String(n)}`,
  url: `/mock/photo-${String(n)}.svg`,
  uploadedAt: day(n),
});

function review(rating: number, overrides: Partial<Review> = {}): Review {
  return {
    placeId: "nara",
    rating,
    text: "대하가 실했어요.",
    nickname: "새우헌터",
    at: day(2),
    ...overrides,
  };
}

function nara(overrides: Partial<Place> = {}): Place {
  return makePlace({
    id: "nara",
    name: "나라수산",
    gu: "마포구",
    addressRoad: "서울 마포구 마포대로12길 34",
    addressJibun: "서울 마포구 마포동 123-4",
    tags: ["grill", "raw"],
    naverPlaceUrl: "https://m.place.naver.com/restaurant/1/home",
    hoursNote: "23:00 라스트오더, 월 휴무",
    lastCheckedAt: day(1),
    checkCount: 4,
    sides: { headButter: true, ramen: true, friedRice: false },
    menus: [
      makeMenu({ name: "생새우소금구이", price: 60000, unit: "kg", unit_raw: "1" }),
      makeMenu({ name: "새우 머리구이", price: null }),
    ],
    ...overrides,
  });
}

function renderDetail(place: Place, overrides: Partial<PlaceDetailProps> = {}) {
  const props: PlaceDetailProps = {
    place,
    now: NOW,
    bookmarked: false,
    checked: false,
    onPatchPlace: vi.fn(),
    onChecked: vi.fn(),
    onToggleBookmark: vi.fn(),
    onNotice: vi.fn(),
    ...overrides,
  };
  const view = render(<PlaceDetail {...props} />);
  return { ...view, props };
}

beforeEach(() => {
  data.getPlaceDetail.mockReset();
  data.checkIn.mockReset();
  data.reportPhoto.mockReset();
  data.reportPhoto.mockResolvedValue(undefined);
  data.getPlaceDetail.mockResolvedValue({ place: nara(), reviews: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PlaceDetail — 화면 2 순서 1~10", () => {
  it("상호·확인 캡션·주소·영업시간·버튼 3개·메뉴·사이드·기여 블록·리뷰·하단 링크가 순서대로 있다", async () => {
    renderDetail(nara());
    const article = screen.getByRole("article", { name: "나라수산 상세" });

    // 1. 사진 없음 → 입력 행 + 네이버 링크가 위에
    const upload = within(article).getByRole("button", { name: "첫 사진을 올려주세요" });
    const naverLink = within(article).getByRole("link", { name: /네이버에서 사진 보기/ });
    expect(naverLink).toHaveAttribute("target", "_blank");
    expect(naverLink).toHaveAttribute("rel", "noopener noreferrer");

    // 2. 상호 + 텍스트 태그 (닫기 ✕는 본문이 아니라 시트 헤더에 있다)
    const title = within(article).getByRole("heading", { level: 2, name: "나라수산" });
    expect(within(article).getByText("소금구이 · 생새우회 · 마포구")).toBeInTheDocument();
    expect(upload.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // 신선도는 상호 아래 캡션 (확인 줄 해체)
    expect(within(article).getByText("어제 확인")).toBeInTheDocument();
    expect(within(article).getByText("확인 4회")).toBeInTheDocument();

    // 4·5
    expect(within(article).getByText("서울 마포구 마포대로12길 34")).toBeInTheDocument();
    expect(within(article).getByRole("button", { name: "주소 복사" })).toBeInTheDocument();
    expect(within(article).getByText("23:00 라스트오더, 월 휴무")).toBeInTheDocument();

    // 6
    const route = within(article).getByRole("button", { name: "길찾기" });
    within(article).getByRole("button", { name: "공유" });
    expect(within(article).getByRole("button", { name: "찜" })).toHaveAttribute("aria-pressed", "false");
    expect(title.compareDocumentPosition(route) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // 7~10 제목 순서 — 확인 액션은 사이드와 리뷰 사이 기여 블록으로 내려갔다
    const headings = within(article)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent.trim());
    expect(headings[0]).toBe("대표 메뉴");
    expect(headings[1]).toBe("여기 다녀오셨나요?");
    expect(headings[2]).toMatch(/^리뷰/);
    // 사이드는 칩이 곧 내용이라 제목을 캡션 급으로 낮췄다 — 이름은 섹션이 갖는다
    expect(within(article).getByRole("region", { name: "사이드" })).toBeInTheDocument();
    const checkButton = within(article).getByRole("button", { name: "다녀왔어요" });
    expect(route.compareDocumentPosition(checkButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(article).getByText("생새우소금구이")).toBeInTheDocument();
    expect(within(article).getByText("1kg")).toBeInTheDocument();
    expect(within(article).getByText("60,000원")).toBeInTheDocument();
    expect(within(article).getByText("가격 미확인")).toBeInTheDocument();
    expect(within(article).getByRole("button", { name: "대표 메뉴 수정" })).toBeInTheDocument();
    const sides = within(within(article).getByRole("list", { name: "사이드 목록" }))
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(sides).toEqual(["머리버터구이 있음", "라면 있음", "볶음밥 없음"]);
    await waitFor(() => {
      expect(within(article).getByText("아직 리뷰가 없어요")).toBeInTheDocument();
    });
    const nav = within(article).getByRole("navigation", { name: "가게 정보 관리" });
    for (const label of ["정보 수정 제안", "신고", "사장님이신가요?"]) {
      expect(within(nav).getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("사진이 있으면 상단에 사진, 네이버 링크는 리뷰 섹션 끝으로", async () => {
    renderDetail(nara({ photos: [photo(1), photo(2)] }));
    const strip = screen.getByRole("list", { name: "나라수산 사진" });
    expect(within(strip).getAllByRole("button", { name: /크게 보기$/ })).toHaveLength(2);
    expect(within(strip).getByRole("button", { name: "사진 추가" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "첫 사진을 올려주세요" })).toBeNull();
    await waitFor(() => {
      expect(screen.getByText("아직 리뷰가 없어요")).toBeInTheDocument();
    });
    const link = screen.getByRole("link", { name: /네이버에서 사진 보기/ });
    const reviewsHeading = screen.getByRole("heading", { level: 3, name: /리뷰/ });
    expect(reviewsHeading.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it(`사진이 ${String(MAX_PLACE_PHOTOS)}장이면 ＋ 대신 안내 타일`, async () => {
    const photos = Array.from({ length: MAX_PLACE_PHOTOS }, (_, i) => photo(i + 1));
    renderDetail(nara({ photos }));
    const strip = screen.getByRole("list", { name: "나라수산 사진" });
    expect(within(strip).getAllByRole("button", { name: /크게 보기$/ })).toHaveLength(MAX_PLACE_PHOTOS);
    expect(within(strip).queryByRole("button", { name: "사진 추가" })).toBeNull();
    expect(within(strip).getByText(`${String(MAX_PLACE_PHOTOS)}장까지 올릴 수 있어요`)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("아직 리뷰가 없어요")).toBeInTheDocument();
    });
  });

  it("사진을 누르면 뷰어가 열리고 그 장의 카운터·업로드 날짜가 보인다", () => {
    renderDetail(nara({ photos: [photo(1), photo(2)] }));
    const strip = screen.getByRole("list", { name: "나라수산 사진" });
    fireEvent.click(within(strip).getByRole("button", { name: "나라수산 사진 2 크게 보기" }));

    const viewer = screen.getByRole("dialog", { name: "나라수산 사진 크게 보기" });
    // 누른 장에서 시작한다 — 2번째
    expect(within(viewer).getByText("2 / 2")).toBeInTheDocument();
    // 절대 날짜는 연도까지 (2026-08-30 = NOW - 2일)
    // getByText는 직계 텍스트 노드만 본다 — 회색 " 등록"은 자식 span이라 toHaveTextContent로 함께 본다
    expect(within(viewer).getByText("2026.08.30")).toHaveTextContent("2026.08.30 등록");
    expect(within(viewer).getAllByRole("img")).toHaveLength(2);

    fireEvent.click(within(viewer).getByRole("button", { name: "사진 닫기" }));
    expect(screen.queryByRole("dialog", { name: "나라수산 사진 크게 보기" })).toBeNull();
  });

  it("뷰어 사진이 깨지면 그 장만 문구로 대체된다", () => {
    renderDetail(nara({ photos: [photo(1)] }));
    const strip = screen.getByRole("list", { name: "나라수산 사진" });
    fireEvent.click(within(strip).getByRole("button", { name: "나라수산 사진 1 크게 보기" }));

    const viewer = screen.getByRole("dialog", { name: "나라수산 사진 크게 보기" });
    fireEvent.error(within(viewer).getByRole("img"));
    expect(within(viewer).getByText("사진을 불러오지 못했어요")).toBeInTheDocument();
    expect(within(viewer).queryByRole("img")).toBeNull();
  });

  it("뷰어에서 신고 사유를 고르면 그 사진 id로 접수하고 뷰어가 닫힌다", async () => {
    const { props } = renderDetail(nara({ photos: [photo(1), photo(2)] }));
    const strip = screen.getByRole("list", { name: "나라수산 사진" });
    fireEvent.click(within(strip).getByRole("button", { name: "나라수산 사진 2 크게 보기" }));

    const viewer = screen.getByRole("dialog", { name: "나라수산 사진 크게 보기" });
    fireEvent.click(within(viewer).getByRole("button", { name: "신고" }));
    const sheet = within(viewer).getByRole("region", { name: "사진 신고" });
    for (const label of ["부적절한 사진", "다른 가게 사진", "광고·도배", "기타"]) {
      expect(within(sheet).getByRole("button", { name: label })).toBeInTheDocument();
    }
    // 확인 버튼은 없다 — 탭이 곧 제출
    fireEvent.click(within(sheet).getByRole("button", { name: "광고·도배" }));

    await waitFor(() => {
      expect(props.onNotice).toHaveBeenCalledWith("신고를 접수했어요");
    });
    expect(data.reportPhoto).toHaveBeenCalledWith({
      placeId: "nara",
      photoId: "nara-p2",
      reason: "spam",
    });
    expect(screen.queryByRole("dialog", { name: "나라수산 사진 크게 보기" })).toBeNull();
  });

  it("신고 접수가 실패하면 뷰어 안 토스트로 알리고 사유 패널은 그대로 둔다", async () => {
    data.reportPhoto.mockRejectedValue(new Error("mock write failed"));
    const { props } = renderDetail(nara({ photos: [photo(1)] }));
    const strip = screen.getByRole("list", { name: "나라수산 사진" });
    fireEvent.click(within(strip).getByRole("button", { name: "나라수산 사진 1 크게 보기" }));

    const viewer = screen.getByRole("dialog", { name: "나라수산 사진 크게 보기" });
    fireEvent.click(within(viewer).getByRole("button", { name: "신고" }));
    fireEvent.click(within(viewer).getByRole("button", { name: "부적절한 사진" }));

    await waitFor(() => {
      expect(within(viewer).getByRole("status")).toHaveTextContent("신고를 접수하지 못했어요");
    });
    // 다시 탭이 재시도 — 뷰어도 패널도 닫히지 않는다
    expect(within(viewer).getByRole("button", { name: "부적절한 사진" })).toBeEnabled();
    expect(props.onNotice).not.toHaveBeenCalled();
  });

  it("naverPlaceUrl이 화이트리스트 밖이면 링크를 렌더하지 않는다", async () => {
    renderDetail(nara({ naverPlaceUrl: "https://evil.example/x" }));
    await waitFor(() => {
      expect(screen.getByText("아직 리뷰가 없어요")).toBeInTheDocument();
    });
    expect(screen.queryByRole("link", { name: /네이버에서 사진 보기/ })).toBeNull();
  });

  it("신규 핀이면 상호 아래 배너, 영업시간·메뉴가 없으면 입구", () => {
    renderDetail(nara({ isNew: true, hoursNote: null, menus: [] }));
    expect(screen.getByRole("note")).toHaveTextContent("새로 제보된 곳이에요");
    expect(screen.getByRole("button", { name: "영업시간을 알려주세요" })).toBeInTheDocument();
    expect(screen.getByText("메뉴 정보가 없어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "메뉴 알려주기" })).toBeInTheDocument();
  });
});

describe("다녀왔어요 — 낙관적 업데이트 + 실패 롤백", () => {
  it("성공: 즉시 +1·오늘 확인·확인했어요, 완료 후 부모에 반영", async () => {
    let resolve!: (p: Place) => void;
    data.checkIn.mockReturnValue(
      new Promise<Place>((r) => {
        resolve = r;
      }),
    );
    const { props } = renderDetail(nara());
    fireEvent.click(screen.getByRole("button", { name: "다녀왔어요" }));

    expect(screen.getByText("오늘 확인")).toBeInTheDocument();
    expect(screen.getByText("확인 5회")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent("확인했어요");
    expect(screen.queryByRole("button", { name: "다녀왔어요" })).toBeNull();
    expect(data.checkIn).toHaveBeenCalledWith("nara", NOW);

    const updated = nara({ checkCount: 5, lastCheckedAt: NOW });
    await act(async () => {
      resolve(updated);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(props.onPatchPlace).toHaveBeenCalledWith(updated);
    });
    expect(props.onChecked).toHaveBeenCalledWith("nara");
    expect(props.onNotice).not.toHaveBeenCalled();
  });

  it("실패: 원래 값으로 돌아가고 토스트", async () => {
    data.checkIn.mockRejectedValue(new Error("mock write failed"));
    const { props } = renderDetail(nara());
    fireEvent.click(screen.getByRole("button", { name: "다녀왔어요" }));
    expect(screen.getByText("확인 5회")).toBeInTheDocument();

    await waitFor(() => {
      expect(props.onNotice).toHaveBeenCalledWith("확인을 저장하지 못했어요");
    });
    expect(screen.getByText("어제 확인")).toBeInTheDocument();
    expect(screen.getByText("확인 4회")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다녀왔어요" })).toBeInTheDocument();
    expect(props.onPatchPlace).not.toHaveBeenCalled();
  });

  it("이미 확인한 가게(checked)는 처음부터 확인했어요", () => {
    renderDetail(nara(), { checked: true });
    expect(screen.queryByRole("button", { name: "다녀왔어요" })).toBeNull();
    expect(screen.getByText("확인했어요")).toBeInTheDocument();
  });
});

describe("찜·복사·공유·준비 중 입구", () => {
  it("찜 버튼은 aria-pressed로 상태를 보이고 토글을 부모에 위임", () => {
    const { props, rerender } = renderDetail(nara());
    fireEvent.click(screen.getByRole("button", { name: "찜" }));
    expect(props.onToggleBookmark).toHaveBeenCalledTimes(1);
    rerender(<PlaceDetail {...props} bookmarked />);
    expect(screen.getByRole("button", { name: "찜" })).toHaveAttribute("aria-pressed", "true");
  });

  it("주소 복사 → 클립보드 + 토스트", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const { props } = renderDetail(nara());
    fireEvent.click(screen.getByRole("button", { name: "주소 복사" }));
    await waitFor(() => {
      expect(props.onNotice).toHaveBeenCalledWith("주소를 복사했어요");
    });
    expect(writeText).toHaveBeenCalledWith("서울 마포구 마포대로12길 34");
  });

  it("공유: navigator.share가 있으면 /place/[id] 링크로, 없으면 링크 복사 토스트", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    const first = renderDetail(nara());
    fireEvent.click(screen.getByRole("button", { name: "공유" }));
    expect(share).toHaveBeenCalledWith({
      title: "나라수산",
      url: `${window.location.origin}/place/nara`,
    });
    expect(first.props.onNotice).not.toHaveBeenCalled();
    first.unmount();

    Reflect.deleteProperty(navigator, "share");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const second = renderDetail(nara());
    fireEvent.click(screen.getByRole("button", { name: "공유" }));
    await waitFor(() => {
      expect(second.props.onNotice).toHaveBeenCalledWith("링크를 복사했어요");
    });
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/place/nara`);
  });

  it("아직 없는 플로우의 입구는 전부 '준비 중이에요' 토스트", async () => {
    const onNotice = vi.fn();
    renderDetail(nara({ hoursNote: null }), { onNotice });
    await waitFor(() => {
      expect(screen.getByText("아직 리뷰가 없어요")).toBeInTheDocument();
    });
    const entries = [
      "첫 사진을 올려주세요",
      "영업시간을 알려주세요",
      "대표 메뉴 수정",
      "사이드 수정",
      "리뷰 남기기",
      "정보 수정 제안",
      "신고",
      "사장님이신가요?",
    ];
    for (const name of entries) fireEvent.click(screen.getByRole("button", { name }));
    expect(onNotice).toHaveBeenCalledTimes(entries.length);
    for (const call of onNotice.mock.calls) expect(call[0]).toBe("준비 중이에요");
  });

  it("값이 있는 영업시간은 옅은 [수정]이 입구", () => {
    const onNotice = vi.fn();
    renderDetail(nara(), { onNotice });
    expect(screen.queryByRole("button", { name: "영업시간을 알려주세요" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "영업시간 수정" }));
    expect(onNotice).toHaveBeenCalledWith("준비 중이에요");
  });
});

describe("리뷰 — 3개 이상일 때만 평균 별점, 로딩·에러·재시도", () => {
  it("2개면 개수만, 3개면 ★ 평균", () => {
    const two = renderDetail(nara(), { initialReviews: [review(5), review(4)] });
    expect(screen.getByRole("heading", { level: 3, name: /리뷰/ })).toHaveTextContent("2");
    expect(screen.queryByLabelText(/평균 별점/)).toBeNull();
    two.unmount();

    renderDetail(nara(), {
      initialReviews: [review(5), review(4), review(5, { photoUrl: "/mock/thumb-1.svg", nickname: "뚝섬러버" })],
    });
    expect(screen.getByLabelText("평균 별점 4.7점")).toHaveTextContent("4.7");
    expect(screen.getAllByRole("img", { name: /별점 \d점/ })).toHaveLength(3);
    expect(screen.getByRole("img", { name: "뚝섬러버의 리뷰 사진" })).toBeInTheDocument();
    expect(data.getPlaceDetail).not.toHaveBeenCalled();
  });

  it("리뷰 날짜는 연도까지 쓴다", () => {
    renderDetail(nara(), { initialReviews: [review(5)] });
    expect(screen.getByText("2026.08.30")).toBeInTheDocument();
  });

  it("클라이언트 로드: 로딩 → 실패 → 다시 시도 → 성공", async () => {
    data.getPlaceDetail.mockRejectedValueOnce(new Error("network"));
    renderDetail(nara());
    expect(screen.getByLabelText("리뷰 불러오는 중")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("리뷰를 불러오지 못했어요")).toBeInTheDocument();
    });

    data.getPlaceDetail.mockResolvedValueOnce({ place: nara(), reviews: [review(5), review(3), review(4)] });
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => {
      expect(screen.getByLabelText("평균 별점 4.0점")).toBeInTheDocument();
    });
    expect(data.getPlaceDetail).toHaveBeenLastCalledWith("nara", NOW);
  });
});

describe("사진 뷰어 — 뒤로가기 1회 = 뷰어만 닫기", () => {
  const spies = { pushState: vi.fn(), back: vi.fn() };

  beforeEach(() => {
    window.history.replaceState(null, "", "/place/nara");
    spies.pushState = vi.spyOn(window.history, "pushState");
    spies.back = vi.spyOn(window.history, "back").mockImplementation(() => {});
  });
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  const openViewer = () => {
    renderDetail(nara({ photos: [photo(1)] }));
    fireEvent.click(screen.getByRole("button", { name: "나라수산 사진 1 크게 보기" }));
    return screen.getByRole("dialog", { name: "나라수산 사진 크게 보기" });
  };

  it("열면 URL은 그대로 두고 엔트리만 쌓는다", () => {
    openViewer();
    expect(spies.pushState).toHaveBeenCalledWith(
      { saeuDetail: true, saeuPhoto: true },
      "",
      "/place/nara",
    );
  });

  it("✕로 닫으면 쌓은 엔트리를 되돌린다", () => {
    const viewer = openViewer();
    fireEvent.click(within(viewer).getByRole("button", { name: "사진 닫기" }));
    expect(spies.back).toHaveBeenCalledTimes(1);
  });

  it("뒤로가기로 닫히면 back을 다시 부르지 않는다 (상세까지 닫히면 안 된다)", () => {
    openViewer();
    // 브라우저가 우리 엔트리를 빼고 popstate를 낸 상태 — 경로는 그대로
    window.history.replaceState({ saeuDetail: true }, "", "/place/nara");
    fireEvent.popState(window, { state: { saeuDetail: true } });
    expect(screen.queryByRole("dialog", { name: "나라수산 사진 크게 보기" })).toBeNull();
    expect(spies.back).not.toHaveBeenCalled();
  });
});
