"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChipButton } from "@/components/ui/chip";
import { ModalSheet, closeEnclosingDialog } from "@/components/ui/modal-sheet";
import { TextField } from "@/components/ui/text-field";
import { submitOwnerRequest } from "@/lib/data";
import type { OwnerRequestKind, Place } from "@/lib/types";

export const OWNER_REQUEST_FAILED_MESSAGE = "보내지 못했어요. 다시 시도해주세요";
const CONTACT_ERROR = "연락드릴 곳을 알려주세요";
const CONTACT_MAX = 60;
const MESSAGE_MAX = 300;

const KINDS: { value: OwnerRequestKind; label: string }[] = [
  { value: "edit", label: "정보 수정" },
  { value: "remove", label: "게재 삭제" },
];

interface OwnerRequestSheetProps {
  place: Place;
  /** 접수 성공 — 부모가 시트를 닫고 토스트를 낸다 */
  onSubmitted: () => void;
  /** 딤·Escape·✕·뒤로가기 */
  onClose: () => void;
}

/**
 * [사장님이신가요?]의 요청 폼 (spec 4.2-9 "연락 창구 상시 노출", spec 5 "삭제 요청 1회로 즉시 처리").
 * 값 폼 시트 문법이되 **"확인 후 반영돼요"를 쓰지 않는다** — 여기는 제안이 아니라 요청이고,
 * 답은 화면이 아니라 연락처로 온다. 그래서 연락처가 필수다(decisions 2026-09-08).
 */
export function OwnerRequestSheet({ place, onSubmitted, onClose }: OwnerRequestSheetProps) {
  const [kind, setKind] = useState<OwnerRequestKind>("edit");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [contactError, setContactError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const submit = () => {
    if (pending) return;
    const trimmed = contact.trim();
    if (trimmed.length < 5) {
      setContactError(CONTACT_ERROR);
      return;
    }
    setPending(true);
    setError(null);
    submitOwnerRequest({ placeId: place.id, kind, contact: trimmed, message: message.trim() }).then(
      () => {
        if (!alive.current) return;
        setPending(false);
        onSubmitted();
      },
      () => {
        if (!alive.current) return;
        setPending(false);
        setError(OWNER_REQUEST_FAILED_MESSAGE);
      },
    );
  };

  return (
    <ModalSheet form label={`${place.name} 사장님 요청`} onClose={onClose}>
      <div className="flex items-center justify-between pr-2 pl-5">
        <h2 className="text-body-m-medium text-fg">사장님이신가요?</h2>
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

      <div className="saeu-modal-body px-5 pt-1 pb-3">
        <p className="text-caption-l-regular text-fg-secondary">무엇을 도와드릴까요?</p>
        <div role="group" aria-label="요청 종류" className="mt-1.5 flex gap-1.5">
          {KINDS.map((option) => (
            <ChipButton
              key={option.value}
              size="sm"
              pressed={kind === option.value}
              onClick={() => {
                setKind(option.value);
              }}
            >
              {option.label}
            </ChipButton>
          ))}
        </div>
        <TextField
          className="mt-4"
          label="연락처"
          placeholder="이메일 또는 전화번호"
          maxLength={CONTACT_MAX}
          value={contact}
          onChange={(e) => {
            setContact(e.target.value);
            setContactError(null);
          }}
          error={contactError}
          autoComplete="off"
        />
        <label className="mt-4 block text-caption-l-regular text-fg-secondary" htmlFor="owner-message">
          하실 말씀 (선택)
        </label>
        <textarea
          id="owner-message"
          rows={3}
          maxLength={MESSAGE_MAX}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
          }}
          placeholder={
            kind === "remove" ? "예: 폐업했습니다" : "예: 영업시간이 바뀌었어요"
          }
          className="mt-1.5 w-full resize-none rounded-8 bg-bg-sunken p-4 text-body-l-medium text-fg outline-none placeholder:font-normal placeholder:text-fg-placeholder"
        />
        <p className="mt-2 text-caption-l-regular text-fg-tertiary">
          확인하고 24시간 안에 연락드릴게요
        </p>
      </div>

      <div className="px-5 pb-2">
        {error && (
          <p role="alert" className="mb-2 text-caption-l-regular text-brand-fg">
            {error}
          </p>
        )}
        <Button variant="brand" size="xl" className="w-full" disabled={pending} onClick={submit}>
          {pending ? "보내는 중…" : "요청 보내기"}
        </Button>
      </div>
    </ModalSheet>
  );
}
