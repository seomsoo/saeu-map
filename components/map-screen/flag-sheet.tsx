"use client";

import { useEffect, useRef, useState } from "react";
import { ModalSheet, closeEnclosingDialog } from "@/components/ui/modal-sheet";
import { flagPlace } from "@/lib/data";
import type { Place, PlaceFlagReason } from "@/lib/types";

/** 사유 4개 고정 — 사진 신고 시트와 같은 문법(design 화면 4 변형 (a)). */
const REASONS: { value: PlaceFlagReason; label: string }[] = [
  { value: "location", label: "위치가 달라요" },
  { value: "menu", label: "메뉴·가격이 달라요" },
  { value: "closed", label: "문 닫았어요" },
  { value: "other", label: "기타" },
];

export const FLAG_FAILED_MESSAGE = "접수하지 못했어요. 다시 눌러주세요";

interface FlagSheetProps {
  place: Place;
  /** 접수 성공 — 부모가 시트를 닫고 토스트를 낸다 */
  onFlagged: () => void;
  /** 딤·Escape·✕·뒤로가기 */
  onClose: () => void;
}

/**
 * [정보가 달라요] 사유 시트 — 바텀 모달, 44px 행 4개. **탭이 곧 제출**이라 확인 버튼이 없다.
 * 접수 중엔 누른 행이 "접수 중…"으로 비활성. 실패하면 시트 안 오류 한 줄 + 다시 탭이 재시도.
 */
export function FlagSheet({ place, onFlagged, onClose }: FlagSheetProps) {
  const [pending, setPending] = useState<PlaceFlagReason | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const submit = (reason: PlaceFlagReason) => {
    if (pending !== null) return;
    setPending(reason);
    setError(null);
    flagPlace({ placeId: place.id, reason }).then(
      () => {
        if (!alive.current) return;
        setPending(null);
        onFlagged();
      },
      () => {
        if (!alive.current) return;
        setPending(null);
        setError(FLAG_FAILED_MESSAGE);
      },
    );
  };

  return (
    <ModalSheet label={`${place.name} 정보가 달라요`} onClose={onClose}>
      <div className="flex items-center justify-between pr-2 pl-5">
        <h2 className="text-body-m-medium text-fg">어떤 정보가 달라요?</h2>
        <button
          ref={closeRef}
          type="button"
          onClick={() => {
            closeEnclosingDialog(closeRef.current);
          }}
          aria-label="닫기"
          className="press flex size-11 items-center justify-center"
        >
          <span className="icon-[ci--close-md] size-5 text-fg-secondary" aria-hidden="true" />
        </button>
      </div>
      <ul>
        {REASONS.map(({ value, label }) => (
          <li key={value} className="border-t border-line-hairline">
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => {
                submit(value);
              }}
              className="press flex h-11 w-full items-center px-5 text-body-l-regular text-fg disabled:text-fg-tertiary"
            >
              {pending === value ? "접수 중…" : label}
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="px-5 pt-2 text-caption-l-regular text-brand-fg">
          {error}
        </p>
      )}
    </ModalSheet>
  );
}
