"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ModalSheet, closeEnclosingDialog } from "@/components/ui/modal-sheet";
import type { Session } from "@/lib/types";

/** 시트를 띄운 이유 — 캡션이 달라진다 (design 화면 5 변형 (a)) */
export type LoginReason = "review" | "me";

const CAPTIONS: Record<LoginReason, string> = {
  review: "리뷰를 남기려면 로그인이 필요해요",
  me: "로그인하면 찜·리뷰·제보가 기기가 바뀌어도 남아요",
};

export const LOGIN_FAILED_MESSAGE = "로그인하지 못했어요. 다시 시도해주세요";

interface LoginSheetProps {
  reason: LoginReason;
  signIn: () => Promise<Session>;
  onSignedIn: (session: Session) => void;
  /** 나중에 할게요·딤·Escape·뒤로가기 — 전부 같은 길 */
  onDismiss: () => void;
}

/**
 * 로그인 시트 — 딤 위 바텀 모달: 제목 / 이유별 캡션 / [카카오로 시작하기](카카오 옐로, 이 버튼 한 곳) / 오류 줄 / 나중에 할게요.
 * 카카오 심볼은 커스텀 에셋 대기 — 그 전까지 coolicons `chat`(decisions 2026-09-04 에셋 목록).
 */
export function LoginSheet({ reason, signIn, onSignedIn, onDismiss }: LoginSheetProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const laterRef = useRef<HTMLButtonElement>(null);
  // 늦게 온 응답이 닫힌 시트를 움직이지 않게 (StrictMode 이중 effect: 본문에서 true)
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const handleSignIn = () => {
    if (pending) return;
    setPending(true);
    setError(null);
    signIn().then(
      (session) => {
        if (!alive.current) return;
        setPending(false);
        onSignedIn(session);
      },
      () => {
        if (!alive.current) return;
        setPending(false);
        setError(LOGIN_FAILED_MESSAGE);
      },
    );
  };

  return (
    <ModalSheet label="카카오로 로그인" onClose={onDismiss}>
      <div className="px-5 pt-6">
        <h2 className="text-title-s-semibold text-fg">카카오로 로그인</h2>
        <p className="mt-1 text-body-m-regular text-fg-secondary">{CAPTIONS[reason]}</p>
        <Button
          variant="kakao"
          size="xl"
          className="mt-5 w-full"
          onClick={handleSignIn}
          disabled={pending}
          aria-busy={pending}
        >
          <span className="icon-[ci--chat] size-4" aria-hidden="true" />
          {pending ? "로그인 중…" : "카카오로 시작하기"}
        </Button>
        {error && (
          <p role="alert" className="mt-1.5 text-caption-l-regular text-brand-fg">
            {error}
          </p>
        )}
        <button
          ref={laterRef}
          type="button"
          onClick={() => {
            closeEnclosingDialog(laterRef.current);
          }}
          className="press mx-auto mt-3 flex h-11 items-center px-3 text-body-m-regular text-fg-secondary"
        >
          나중에 할게요
        </button>
      </div>
    </ModalSheet>
  );
}
