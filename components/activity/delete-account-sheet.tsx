"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ModalSheet, closeEnclosingDialog } from "@/components/ui/modal-sheet";

export const DELETE_ACCOUNT_FAILED_MESSAGE = "탈퇴하지 못했어요. 다시 시도해주세요";

interface DeleteAccountSheetProps {
  /** 탈퇴 — 거부(reject)면 시트 안 오류 한 줄, 성공은 부모가 패널을 닫고 알린다 */
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/**
 * 화면 5 변형 (d) — 탈퇴 확인 바텀 모달. [취소](아웃라인) [탈퇴하기](아웃라인 + brand-fg — 채움이 아니라 색으로만 위험을 말한다).
 */
export function DeleteAccountSheet({ onConfirm, onClose }: DeleteAccountSheetProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const confirm = () => {
    if (pending) return;
    setPending(true);
    setError(null);
    onConfirm().then(
      () => {
        if (alive.current) setPending(false);
      },
      () => {
        if (!alive.current) return;
        setPending(false);
        setError(DELETE_ACCOUNT_FAILED_MESSAGE);
      },
    );
  };

  return (
    <ModalSheet label="탈퇴 확인" onClose={onClose}>
      <div className="px-5 pt-6">
        <h2 className="text-title-s-semibold text-fg">정말 탈퇴할까요?</h2>
        <p className="mt-1 text-body-m-regular text-fg-secondary">
          리뷰·찜 등 내 기록이 모두 삭제되고 되돌릴 수 없어요
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="xl"
            disabled={pending}
            onClick={(e) => {
              closeEnclosingDialog(e.currentTarget);
            }}
          >
            취소
          </Button>
          <Button
            variant="outline"
            size="xl"
            className="border-brand-fg text-brand-fg"
            onClick={confirm}
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? "탈퇴 중…" : "탈퇴하기"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-caption-l-regular text-brand-fg">
            {error}
          </p>
        )}
      </div>
    </ModalSheet>
  );
}
