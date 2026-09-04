import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SessionProvider } from "@/components/auth/session-provider";
import { makeMenu, makePlace } from "@/lib/__tests__/fixtures";
import { MAX_PLACE_PHOTOS } from "@/lib/data";
import type { Photo, Place, PlaceDetail as PlaceDetailData, Review, Session } from "@/lib/types";
import { PlaceDetail, type PlaceDetailProps } from "../place-detail";

type PhotoReport = Parameters<typeof import("@/lib/data").reportPhoto>[0];
type ReviewInput = Parameters<typeof import("@/lib/data").submitReview>[0];
type ReviewPatch = Parameters<typeof import("@/lib/data").updateReview>[1];

const ANON: Session = { userId: "anon-local-1", provider: "anonymous", nickname: null };
const KAKAO: Session = { userId: "u-kakao-1", provider: "kakao", nickname: "새우헌터" };

const data = vi.hoisted(() => ({
  getPlaceDetail: vi.fn<(id: string, now: string) => Promise<PlaceDetailData | undefined>>(),
  checkIn: vi.fn<(id: string, now: string) => Promise<Place>>(),
  reportPhoto: vi.fn<(input: PhotoReport) => Promise<void>>(),
  getSession: vi.fn<() => Promise<Session>>(),
  signInWithKakao: vi.fn<() => Promise<Session>>(),
  submitReview: vi.fn<(input: ReviewInput, now: string) => Promise<{ review: Review; place: Place }>>(),
  updateReview: vi.fn<(id: string, patch: ReviewPatch, now: string) => Promise<Review>>(),
  deleteReview: vi.fn<(id: string) => Promise<void>>(),
}));

// 상수(MAX_PLACE_PHOTOS)는 진짜 값을 쓰고 쓰기 함수만 가짜로 — 상한을 테스트에 두 번 적지 않는다
vi.mock("@/lib/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data")>()),
  getPlaceDetail: data.getPlaceDetail,
  checkIn: data.checkIn,
  reportPhoto: data.reportPhoto,
  getSession: data.getSession,
  signInWithKakao: data.signInWithKakao,
  submitReview: data.submitReview,
  updateReview: data.updateReview,
  deleteReview: data.deleteReview,
}));

const NOW = "2026-09-01T12:00:00+09:00";
const day = (d: number) => new Date(Date.parse(NOW) - d * 86_400_000).toISOString();

const photo = (n: number): Photo => ({
  id: `nara-p${String(n)}`,
  url: `/mock/photo-${String(n)}.svg`,
  uploadedAt: day(n),
});

let reviewSeq = 0;
function review(rating: number, overrides: Partial<Review> = {}): Review {
  reviewSeq += 1;
  return {
    id: `rv${String(reviewSeq)}`,
    placeId: "nara",
    authorId: "u-other",
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
    nearestStation: { name: "마포역", exit: "3", distanceM: 240, lines: ["5"] },
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
  const view = render(
    <SessionProvider>
      <PlaceDetail {...props} />
    </SessionProvider>,
  );
  // 상세는 세션 컨텍스트 안에서 돈다 — rerender도 같은 래퍼로
  const rerender = (element: React.ReactElement) => {
    view.rerender(<SessionProvider>{element}</SessionProvider>);
  };
  return { ...view, rerender, props };
}

beforeEach(() => {
  data.getPlaceDetail.mockReset();
  data.checkIn.mockReset();
  data.reportPhoto.mockReset();
  data.reportPhoto.mockResolvedValue(undefined);
  data.getPlaceDetail.mockResolvedValue({ place: nara(), reviews: [] });
  data.getSession.mockReset();
  data.getSession.mockResolvedValue(ANON);
  data.signInWithKakao.mockReset();
  data.signInWithKakao.mockResolvedValue(KAKAO);
  data.submitReview.mockReset();
  data.updateReview.mockReset();
  data.deleteReview.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PlaceDetail — 화면 2 순서 1~10", () => {
  it("상호·확인 캡션·주소·영업시간·버튼 3개·메뉴·사이드·기여 블록·리뷰·하단 링크가 순서대로 있다", async () => {
    renderDetail(nara());
    const article = screen.getByRole("article", { name: "나라수산 상세" });

    // 1. 사진 없음 → 전폭 빈 상태 블록. 상태 한 줄 + 요청 한 줄이 그대로 접근 이름이다
    const upload = within(article).getByRole("button", { name: /첫 새우를 올려주세요/ });
    expect(upload).toHaveTextContent("아직 사진이 없어요");
    // 네이버 링크는 사진 유무와 무관하게 리뷰 끝 한 자리 — 사진 블록 안에 겹쳐 두지 않는다
    const naverLink = within(article).getByRole("link", { name: /네이버에서 사진 보기/ });
    expect(naverLink).toHaveAttribute("target", "_blank");
    expect(naverLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(upload).not.toContainElement(naverLink);
    const reviewsHeading = within(article).getByRole("heading", { level: 3, name: /리뷰/ });
    expect(
      reviewsHeading.compareDocumentPosition(naverLink) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // 2. 상호 + 텍스트 태그 (닫기 ✕는 본문이 아니라 시트 헤더에 있다)
    const title = within(article).getByRole("heading", { level: 2, name: "나라수산" });
    expect(within(article).getByText("새우구이 · 생새우회 · 마포구")).toBeInTheDocument();
    expect(upload.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // 신선도는 상호 아래 캡션 (확인 줄 해체)
    expect(within(article).getByText("어제 확인")).toBeInTheDocument();
    expect(within(article).getByText("확인 4회")).toBeInTheDocument();

    // 4·5 — 역 줄이 주소보다 먼저다("어느 역 근처냐"가 도로명보다 먼저 읽힌다).
    // 주소는 그 줄에 걸린 disclosure라 기본은 접힘 — 펼쳐야 도로명·[복사]가 나온다
    const stationToggle = within(article).getByRole("button", {
      name: "5호선 마포역 3번출구에서 240m",
    });
    expect(stationToggle).toHaveAttribute("aria-expanded", "false");
    expect(within(article).queryByText("서울 마포구 마포대로12길 34")).toBeNull();
    fireEvent.click(stationToggle);
    const road = within(article).getByText("서울 마포구 마포대로12길 34");
    expect(
      stationToggle.compareDocumentPosition(road) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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

  it("사진이 있으면 상단 스트립 + ＋ 타일, 빈 상태 블록은 없다", async () => {
    renderDetail(nara({ photos: [photo(1), photo(2)] }));
    const strip = screen.getByRole("list", { name: "나라수산 사진" });
    expect(within(strip).getAllByRole("button", { name: /크게 보기$/ })).toHaveLength(2);
    expect(within(strip).getByRole("button", { name: "사진 추가" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("아직 리뷰가 없어요")).toBeInTheDocument();
    });
    expect(screen.queryByText("아직 사진이 없어요")).toBeNull();
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

describe("정보 블록 — 최근접역 줄 + 접히는 주소", () => {
  /** 상세는 마운트 직후 리뷰를 비동기로 채운다 — 로딩이 다음 테스트로 새지 않게 정착까지 기다린다 */
  const settled = () =>
    waitFor(() => {
      expect(screen.getByText("아직 리뷰가 없어요")).toBeInTheDocument();
    });

  /** 역 줄 = 주소를 여는 disclosure 헤더. 낭독 이름은 버튼 aria-label이라 호선이 먼저 붙는다 */
  const stationToggle = (article: HTMLElement, name: string) =>
    within(article).getByRole("button", { name });

  /** 배지는 aria-hidden이라 낭독에 안 잡힌다 — 색 원의 개수는 그 속성으로 센다(chevron 제외) */
  const badgesOf = (row: HTMLElement) =>
    Array.from(row.querySelectorAll('[aria-hidden="true"]'))
      .map((b) => b.textContent)
      .filter((t) => t !== "");

  it("단일 호선: 배지 1개 + 낭독은 '9호선'", async () => {
    renderDetail(
      nara({ nearestStation: { name: "송파나루역", exit: "2", distanceM: 370, lines: ["9"] } }),
    );
    const article = screen.getByRole("article", { name: "나라수산 상세" });
    expect(badgesOf(stationToggle(article, "9호선 송파나루역 2번출구에서 370m"))).toEqual(["9"]);
    await settled();
  });

  it("환승역: 숫자 호선 수만큼 배지", async () => {
    renderDetail(
      nara({ nearestStation: { name: "가락시장역", exit: "2-1", distanceM: 90, lines: ["3", "8"] } }),
    );
    const article = screen.getByRole("article", { name: "나라수산 상세" });
    const row = stationToggle(article, "3호선 8호선 가락시장역 2-1번출구에서 90m");
    expect(badgesOf(row)).toEqual(["3", "8"]);
    await settled();
  });

  it("숫자 없는 노선은 배지 없이 역명만 (원 안에 넣을 숫자가 없다)", async () => {
    renderDetail(
      nara({ nearestStation: { name: "한티역", exit: "1", distanceM: 230, lines: ["수인·분당"] } }),
    );
    const article = screen.getByRole("article", { name: "나라수산 상세" });
    expect(badgesOf(stationToggle(article, "한티역 1번출구에서 230m"))).toEqual([]);
    expect(within(article).queryByText(/호선/)).toBeNull();
    await settled();
  });

  it("주소는 기본 접힘 — 역 줄을 누르면 도로명·지번·[복사]가 열리고 다시 누르면 닫힌다", async () => {
    renderDetail(nara());
    const article = screen.getByRole("article", { name: "나라수산 상세" });
    const toggle = stationToggle(article, "5호선 마포역 3번출구에서 240m");

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(article).queryByText("서울 마포구 마포대로12길 34")).toBeNull();
    expect(within(article).queryByRole("button", { name: "주소 복사" })).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(article).getByText("서울 마포구 마포대로12길 34")).toBeInTheDocument();
    // 지번은 시·구를 뗀 짧은 표기 — 바로 위 도로명이 이미 "서울 마포구"를 보여줬다
    expect(within(article).getByText("마포동 123-4")).toBeInTheDocument();
    expect(within(article).queryByText("서울 마포구 마포동 123-4")).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(article).queryByText("서울 마포구 마포대로12길 34")).toBeNull();
    await settled();
  });

  it("역이 멀면(null) 역 줄도 드롭다운도 없고 주소가 그냥 보인다", async () => {
    renderDetail(nara({ nearestStation: null }));
    const article = screen.getByRole("article", { name: "나라수산 상세" });
    await settled();
    expect(within(article).queryByText(/에서 \d+m$/)).toBeNull();
    // 헤더와 본문이 같은 disclosure는 만들지 않는다 — 접을 게 없으면 접는 버튼도 없다
    expect(within(article).queryByRole("button", { expanded: false })).toBeNull();
    expect(within(article).getByText("서울 마포구 마포대로12길 34")).toBeInTheDocument();
    expect(within(article).getByRole("button", { name: "주소 복사" })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /마포역/ })); // 주소를 펼쳐야 [복사]가 있다
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
    const entries: (string | RegExp)[] = [
      /첫 새우를 올려주세요/,
      "영업시간을 알려주세요",
      "대표 메뉴 수정",
      "사이드 수정",
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

describe("주소가 없는 제보 핀", () => {
  it("위치 그룹 전체가 '주소를 알려주세요' 입구가 되고 복사 버튼은 없다", () => {
    renderDetail(nara({ addressRoad: null, addressJibun: null, nearestStation: null }));
    expect(screen.getByRole("button", { name: "주소를 알려주세요" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "주소 복사" })).toBeNull();
  });
});

describe("리뷰 쓰기 — 로그인 게이트, 폼, 본인 리뷰 수정·삭제 (화면 5 변형 (b)·(c))", () => {
  beforeEach(() => {
    vi.spyOn(window.history, "pushState").mockImplementation(() => {});
    vi.spyOn(window.history, "back").mockImplementation(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
  });

  it("익명이 [리뷰 남기기] → 로그인 시트, 로그인하면 바로 리뷰 폼", async () => {
    renderDetail(nara(), { initialReviews: [] });
    fireEvent.click(screen.getByRole("button", { name: "리뷰 남기기" }));
    const login = await screen.findByRole("dialog", { name: "카카오로 로그인" });
    expect(login).toHaveTextContent("리뷰를 남기려면 로그인이 필요해요");
    expect(screen.queryByRole("dialog", { name: "리뷰 남기기" })).toBeNull();
    fireEvent.click(within(login).getByRole("button", { name: "카카오로 시작하기" }));
    expect(await screen.findByRole("dialog", { name: "리뷰 남기기" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "카카오로 로그인" })).toBeNull();
  });

  it("[나중에 할게요]면 폼이 열리지 않는다", async () => {
    renderDetail(nara(), { initialReviews: [] });
    fireEvent.click(screen.getByRole("button", { name: "리뷰 남기기" }));
    const login = await screen.findByRole("dialog", { name: "카카오로 로그인" });
    fireEvent.click(within(login).getByRole("button", { name: "나중에 할게요" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.queryByRole("dialog", { name: "리뷰 남기기" })).toBeNull();
  });

  it("카카오: 폼 → 등록 → 리뷰 맨 앞 + 확인 캡션 갱신 + 토스트, 내 리뷰엔 [수정][삭제]", async () => {
    data.getSession.mockResolvedValue(KAKAO);
    const saved: Review = {
      id: "rv-local-1",
      placeId: "nara",
      authorId: "u-kakao-1",
      rating: 5,
      text: "머리버터구이 최고",
      nickname: "새우헌터",
      at: NOW,
    };
    const place = nara({ checkCount: 5, lastCheckedAt: NOW });
    data.submitReview.mockResolvedValue({ review: saved, place });
    const { props } = renderDetail(nara(), { initialReviews: [review(4, { nickname: "을지로사람" })] });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "리뷰 남기기" })).toBeInTheDocument();
    });
    // 세션이 로드된 뒤 눌러야 게이트가 즉시 통과한다
    await waitFor(async () => {
      fireEvent.click(screen.getByRole("button", { name: "리뷰 남기기" }));
      expect(await screen.findByRole("dialog", { name: "리뷰 남기기" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("radio", { name: "5점" }));
    fireEvent.click(screen.getByRole("button", { name: "등록하기" }));
    await waitFor(() => {
      expect(props.onNotice).toHaveBeenCalledWith("리뷰를 남겼어요");
    });
    expect(props.onPatchPlace).toHaveBeenCalledWith(place);
    const section = screen.getByRole("heading", { level: 3, name: /리뷰/ }).closest("section");
    if (!section) throw new Error("section expected");
    const [first, second] = within(section).getAllByRole("listitem");
    if (!first || !second) throw new Error("two rows expected");
    expect(first).toHaveTextContent("새우헌터");
    expect(first).toHaveTextContent("머리버터구이 최고");
    expect(within(first).getByRole("button", { name: "리뷰 수정" })).toBeInTheDocument();
    expect(within(first).getByRole("button", { name: "리뷰 삭제" })).toBeInTheDocument();
    // 남의 리뷰엔 없다
    expect(within(second).queryByRole("button", { name: "리뷰 수정" })).toBeNull();
  });

  it("본인 리뷰 [수정] → 수정 폼 → '수정됨'. [삭제]는 인라인 확인 → 낙관 제거, 실패면 원복 + 토스트", async () => {
    data.getSession.mockResolvedValue(KAKAO);
    const mine = review(4, { id: "rv-mine", authorId: "u-kakao-1", nickname: "새우헌터", text: "원래 글" });
    const edited = { ...mine, rating: 3, text: "고친 글", editedAt: NOW };
    data.updateReview.mockResolvedValue(edited);
    data.deleteReview.mockRejectedValue(new Error("mock write failed"));
    const { props } = renderDetail(nara(), { initialReviews: [mine, review(5, { nickname: "을지로사람" })] });
    const editButton = await screen.findByRole("button", { name: "리뷰 수정" });
    fireEvent.click(editButton);
    const form = await screen.findByRole("dialog", { name: "리뷰 수정" });
    expect(within(form).getByRole("textbox", { name: "후기 (선택)" })).toHaveValue("원래 글");
    fireEvent.change(within(form).getByRole("textbox", { name: "후기 (선택)" }), { target: { value: "고친 글" } });
    fireEvent.click(within(form).getByRole("button", { name: "저장하기" }));
    await waitFor(() => {
      expect(props.onNotice).toHaveBeenCalledWith("리뷰를 고쳤어요");
    });
    expect(screen.getByText("고친 글")).toBeInTheDocument();
    expect(screen.getByText("수정됨")).toBeInTheDocument();
    expect(props.onPatchPlace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "리뷰 삭제" }));
    expect(screen.getByText("삭제할까요?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.queryByText("삭제할까요?")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "리뷰 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(screen.queryByText("고친 글")).toBeNull(); // 낙관 제거
    await waitFor(() => {
      expect(props.onNotice).toHaveBeenCalledWith("리뷰를 삭제하지 못했어요");
    });
    expect(screen.getByText("고친 글")).toBeInTheDocument(); // 원복
    expect(data.deleteReview).toHaveBeenCalledWith("rv-mine");
  });

  it("autoReview(제보 완료 → 리뷰도 남겨볼래요?): 열리자마자 게이트가 서고 한 번만 소비된다", async () => {
    const onAutoReviewConsumed = vi.fn();
    renderDetail(nara(), { initialReviews: [], autoReview: true, onAutoReviewConsumed });
    expect(await screen.findByRole("dialog", { name: "카카오로 로그인" })).toBeInTheDocument();
    expect(onAutoReviewConsumed).toHaveBeenCalledTimes(1);
  });
});
