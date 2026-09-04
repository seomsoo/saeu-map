import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { Session } from "@/lib/types";
import { SessionProvider, useSession } from "../session-provider";
import { LOGIN_FAILED_MESSAGE } from "../login-sheet";

const data = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<Session>>(),
  signInWithKakao: vi.fn<() => Promise<Session>>(),
  signOut: vi.fn<() => Promise<Session>>(),
}));
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
  const { session, requireLogin, signOut } = useSession();
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
    data.signInWithKakao.mockResolvedValue(KAKAO);
    data.signOut.mockResolvedValue({ ...ANON, userId: "anon-local-2" });
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

  it("[카카오로 시작하기] → 세션이 카카오가 되고 시트가 닫힌 뒤 true", async () => {
    renderConsumer();
    await waitFor(() => {
      expect(sessionText()).toBe("anonymous:");
    });
    fireEvent.click(screen.getByRole("button", { name: "게이트" }));
    fireEvent.click(screen.getByRole("button", { name: "카카오로 시작하기" }));
    expect(screen.getByRole("button", { name: "로그인 중…" })).toBeDisabled();
    await waitFor(() => {
      expect(resultText()).toBe("ok");
    });
    expect(sessionText()).toBe("kakao:새우헌터");
    expect(loginDialog()).not.toBeInTheDocument();
    expect(back).toHaveBeenCalledTimes(1);

    // 이미 카카오면 시트 없이 즉시 true
    fireEvent.click(screen.getByRole("button", { name: "게이트" }));
    await waitFor(() => {
      expect(resultText()).toBe("ok");
    });
    expect(loginDialog()).not.toBeInTheDocument();
    expect(pushState).toHaveBeenCalledTimes(1);
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
      expect(resultText()).toBe("ok");
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
});
