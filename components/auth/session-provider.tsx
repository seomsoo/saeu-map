"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useOverlayHistory } from "@/components/ui/use-overlay-history";
import {
  deleteAccount as requestDeleteAccount,
  getSession,
  signInWithKakao,
  signOut as requestSignOut,
  updateNickname as requestUpdateNickname,
} from "@/lib/data";
import { pushOverlayHistoryEntry } from "@/lib/history-state";
import type { Session } from "@/lib/types";
import { LoginSheet, type LoginReason } from "./login-sheet";

export interface SessionContextValue {
  /** null = 아직 모름(첫 로드). 그동안 프로필 버튼은 익명 아이콘. */
  session: Session | null;
  /**
   * 로그인 게이트 — 이미 카카오면 즉시 true, 아니면 로그인 시트를 띄우고 로그인 성공(true)/닫기(false)로 resolve.
   * 호출자는 true를 받은 뒤 하려던 일(리뷰 폼·내 활동)을 이어 간다 = spec 5 "완료 후 쓰던 화면으로 복귀".
   */
  requireLogin: (reason: LoginReason) => Promise<boolean>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateNickname: (nickname: string) => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface Prompt {
  reason: LoginReason;
  resolve: (ok: boolean) => void;
}

/**
 * 세션 컨텍스트 + 로그인 시트(화면 5 변형 (a)). 시트는 여기서 직접 렌더한다 — PlaceSheet에 prop을 꿰지 않는다.
 * 시트는 히스토리 엔트리 하나(saeuOverlay)를 쌓고, 닫힘은 popstate로 정리된 뒤에야 호출자에게 결과가 간다
 * (그래야 로그인 직후 여는 리뷰 폼의 엔트리를 늦은 back()이 삼키지 않는다 — use-overlay-history).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  /** state의 거울 — 핸들러가 재구독 없이 읽고, setState 업데이터 안에서 부수효과(히스토리·resolve)를 내지 않는다 */
  const promptRef = useRef<Prompt | null>(null);
  /** 닫히는 중에 정해진 결과 — popstate 정리 뒤 resolve한다 */
  const resultRef = useRef(false);

  useEffect(() => {
    let alive = true;
    void getSession().then((s) => {
      if (alive) setSession(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  const finish = useCallback(() => {
    const current = promptRef.current;
    promptRef.current = null;
    setPrompt(null);
    current?.resolve(resultRef.current);
  }, []);
  const closePrompt = useOverlayHistory(prompt !== null, finish);

  const requireLogin = useCallback(
    (reason: LoginReason): Promise<boolean> => {
      if (session?.provider === "kakao") return Promise.resolve(true);
      return new Promise<boolean>((resolve) => {
        const previous = promptRef.current;
        previous?.resolve(false); // 겹쳐 열리면 앞 요청은 취소로 본다 (엔트리는 이미 있다)
        if (!previous) pushOverlayHistoryEntry();
        const next: Prompt = { reason, resolve };
        promptRef.current = next;
        setPrompt(next);
      });
    },
    [session],
  );

  const settle = useCallback(
    (ok: boolean) => {
      resultRef.current = ok;
      closePrompt();
    },
    [closePrompt],
  );

  const handleSignedIn = useCallback(
    (next: Session) => {
      setSession(next);
      settle(true);
    },
    [settle],
  );
  const handleDismiss = useCallback(() => {
    settle(false);
  }, [settle]);

  const signOut = useCallback(async () => {
    setSession(await requestSignOut());
  }, []);
  const deleteAccount = useCallback(async () => {
    setSession(await requestDeleteAccount());
  }, []);
  const updateNickname = useCallback(async (nickname: string) => {
    setSession(await requestUpdateNickname(nickname));
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ session, requireLogin, signOut, deleteAccount, updateNickname }),
    [session, requireLogin, signOut, deleteAccount, updateNickname],
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
      {prompt && (
        <LoginSheet
          reason={prompt.reason}
          signIn={signInWithKakao}
          onSignedIn={handleSignedIn}
          onDismiss={handleDismiss}
        />
      )}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession은 SessionProvider 안에서만 쓸 수 있다");
  return value;
}
