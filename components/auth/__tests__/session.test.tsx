import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { Session } from "@/lib/types";
import { SessionProvider, useSession } from "../session-provider";
import { LOGIN_FAILED_MESSAGE } from "../login-sheet";

const data = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<Session>>(),
  signInWithKakao: vi.fn<(next: string) => Promise<string>>(),
  signOut: vi.fn<() => Promise<Session>>(),
}));
const nav = vi.hoisted(() => ({ assignLocation: vi.fn<(url: string) => void>() }));
vi.mock("@/lib/navigate", () => ({ assignLocation: nav.assignLocation }));
vi.mock("@/lib/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data")>()),
  getSession: data.getSession,
  signInWithKakao: data.signInWithKakao,
  signOut: data.signOut,
}));

const ANON: Session = { userId: "anon-local-1", provider: "anonymous", nickname: null };
const KAKAO: Session = { userId: "u-kakao-1", provider: "kakao", nickname: "새우헌터" };

/** 게이트 결과를 화면에 찍는 소비자 */
function Consumer() {
  const { session, requireLogin, signOut, refreshSession } = useSession();
  const [result, setResult] = useState("");
  return (
    <div>
      <p data-testid="session">{session ? `${session.provider}:${session.nickname ?? ""}` : "loading"}</p>
      <p data-testid="result">{result}</p>
      <button
        type="button"
        onClick={() => {
          setResult("");
          void requireLogin("review").then((ok) => {
            setResult(ok ? "ok" : "no");
          });
        }}
      >
        게이트
      </button>
      <button
        type="button"
        onClick={() => {
          void signOut();
        }}
      >
        로그아웃
      </button>
      <button
        type="button"
        onClick={() => {
          void refreshSession();
        }}
      >
        세션 갱신
      </button>
    </div>
  );
}

function renderConsumer() {
  render(
    <SessionProvider>
      <Consumer />
    </SessionProvider>,
  );
}

const sessionText = () => screen.getByTestId("session").textContent;
const resultText = () => screen.getByTestId("result").textContent;
const loginDialog = () => screen.queryByRole("dialog", { name: "카카오로 로그인" });

describe("SessionProvider — 세션 로드, 로그인 게이트(Promise), 로그인 시트", () => {
  let pushState: ReturnType<typeof vi.spyOn>;
  let back: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    data.getSession.mockResolvedValue(ANON);
    data.signInWithKakao.mockResolvedValue("https://kauth.kakao.com/oauth/authorize?state=x");
    data.signOut.mockResolvedValue({ ...ANON, userId: "anon-local-2" });
    nav.assignLocation.mockClear();
    pushState = vi.spyOn(window.history, "pushState");
    // 우리 엔트리를 빼고 popstate를 낸다 — 실제 브라우저의 back()과 같은 순서(정리 → 결과)
    back = vi.spyOn(window.history, "back").mockImplementation(() => {
      window.history.replaceState(null, "", window.location.pathname);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("세션 로드가 네트워크에서 실패하면 로딩(익명 취급)으로 남고 잡히지 않은 거부가 없다 — Sentry SAEU-MAP-4", async () => {
    data.getSession.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderConsumer();
    await act(async () => {});
    expect(sessionText()).toBe("loading");
    expect(data.getSession).toHaveBeenCalledTimes(1);
  });

  it("첫 로드는 익명. 게이트를 열면 시트 + 오버레이 엔트리, [나중에 할게요]면 false", async () => {
    renderConsumer();
    await waitFor(() => {
      expect(sessionText()).toBe("anonymous:");
    });
    fireEvent.click(screen.getByRole("button", { name: "게이트" }));
    expect(loginDialog()).toBeInTheDocument();
    expect(screen.getByText("리뷰를 남기려면 로그인이 필요해요")).toBeInTheDocument();
    expect(pushState).toHaveBeenCalledWith({ saeuOverlay: true }, "", "/");
    expect(resultText()).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "나중에 할게요" }));
    expect(back).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(resultText()).toBe("no");
    });
    expect(loginDialog()).not.toBeInTheDocument();
    expect(sessionText()).toBe("anonymous:");
  });

  it("[카카오로 시작하기] → OAuth URL로 페이지를 옮긴다 (돌아올 곳 = 지금 경로 + intent)", async () => {
    window.history.replaceState(null, "", "/place/abc");
    renderConsumer();
    await waitFor(() => {
      expect(sessionText()).toBe("anonymous:");
    });
    fireEvent.click(screen.getByRole("button", { name: "게이트" }));
    fireEvent.click(screen.getByRole("button", { name: "카카오로 시작하기" }));
    expect(screen.getByRole("button", { name: "로그인 중…" })).toBeDisabled();
    await waitFor(() => {
      expect(nav.assignLocation).toHaveBeenCalledWith("https://kauth.kakao.com/oauth/authorize?state=x");
    });
    expect(data.signInWithKakao).toHaveBeenCalledWith("/place/abc?intent=review");
    // 페이지가 통째로 넘어가므로 시트는 그대로(pending) — 게이트 약속은 콜백의 intent가 대신한다
    expect(loginDialog()).toBeInTheDocument();
    expect(resultText()).toBe("");
  });

  it("이미 카카오면 시트 없이 즉시 true", async () => {
    data.getSession.mockResolvedValue(KAKAO);
    renderConsumer();
    await waitFor(() => {
      expect(sessionText()).toBe("kakao:새우헌터");
    });
    fireEvent.click(screen.getByRole("button", { name: "게이트" }));
    await waitFor(() => {
      expect(resultText()).toBe("ok");
    });
    expect(loginDialog()).not.toBeInTheDocument();
    expect(pushState).not.toHaveBeenCalled();
  });

  it("콜백이 login=fail로 돌아오면 같은 이유의 시트를 오류 줄과 함께 다시 연다", async () => {
    window.history.replaceState(null, "", "/?login=fail&intent=review");
    renderConsumer();
    expect(await screen.findByRole("alert")).toHaveTextContent(LOGIN_FAILED_MESSAGE);
    expect(loginDialog()).toBeInTheDocument();
    expect(window.location.search).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "나중에 할게요" }));
    await waitFor(() => {
      expect(loginDialog()).not.toBeInTheDocument();
    });
  });

  it("로그인 실패면 시트 안 오류 한 줄, 다시 누르면 재시도", async () => {
    data.signInWithKakao.mockRejectedValueOnce(new Error("mock write failed"));
    renderConsumer();
    await waitFor(() => {
      expect(sessionText()).toBe("anonymous:");
    });
    fireEvent.click(screen.getByRole("button", { name: "게이트" }));
    fireEvent.click(screen.getByRole("button", { name: "카카오로 시작하기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(LOGIN_FAILED_MESSAGE);
    expect(loginDialog()).toBeInTheDocument();
    expect(resultText()).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "카카오로 시작하기" }));
    await waitFor(() => {
      expect(nav.assignLocation).toHaveBeenCalledTimes(1);
    });
  });

  it("뒤로가기(popstate)로 닫히면 false, 엔트리는 다시 빼지 않는다", async () => {
    renderConsumer();
    await waitFor(() => {
      expect(sessionText()).toBe("anonymous:");
    });
    fireEvent.click(screen.getByRole("button", { name: "게이트" }));
    act(() => {
      window.history.replaceState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await waitFor(() => {
      expect(resultText()).toBe("no");
    });
    expect(loginDialog()).not.toBeInTheDocument();
    expect(back).not.toHaveBeenCalled();
  });

  it("카카오로 이동을 시작한 뒤 뒤로가기로 닫혀도 취소(false)다 — 게이트 결과는 in-page에서 true가 될 길이 없다 (Codex PR #8 #1의 후신)", async () => {
    renderConsumer();
    await waitFor(() => {
      expect(sessionText()).toBe("anonymous:");
    });
    fireEvent.click(screen.getByRole("button", { name: "게이트" }));
    fireEvent.click(screen.getByRole("button", { name: "카카오로 시작하기" }));
    await waitFor(() => {
      expect(nav.assignLocation).toHaveBeenCalledTimes(1);
    });
    act(() => {
      window.history.replaceState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await waitFor(() => {
      expect(resultText()).toBe("no");
    });
    expect(loginDialog()).not.toBeInTheDocument();
  });

  it("로그아웃하면 새 익명", async () => {
    data.getSession.mockResolvedValue(KAKAO);
    renderConsumer();
    await waitFor(() => {
      expect(sessionText()).toBe("kakao:새우헌터");
    });
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await waitFor(() => {
      expect(sessionText()).toBe("anonymous:");
    });
  });

  it("늦게 돌아온 세션 갱신은 그 뒤에 시작한 로그아웃을 덮지 않는다 — 마지막에 시작한 요청이 이긴다 (Codex PR #18 #1)", async () => {
    data.getSession.mockResolvedValue(KAKAO);
    renderConsumer();
    await waitFor(() => {
      expect(sessionText()).toBe("kakao:새우헌터");
    });
    // 리뷰 저장 뒤의 갱신(기다리지 않는 호출)이 느리다
    let finishRefresh: (s: Session) => void = () => {};
    data.getSession.mockImplementationOnce(() => new Promise<Session>((resolve) => (finishRefresh = resolve)));
    fireEvent.click(screen.getByRole("button", { name: "세션 갱신" }));
    // 그 사이 로그아웃 — 바로 돌아온다
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    await waitFor(() => {
      expect(sessionText()).toBe("anonymous:");
    });
    // 이제야 갱신이 옛 카카오 세션을 들고 돌아온다 — 버려진다
    await act(async () => {
      finishRefresh({ ...KAKAO, reviewIds: ["rv-1"] });
    });
    expect(sessionText()).toBe("anonymous:");
  });
});
