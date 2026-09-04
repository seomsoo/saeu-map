"use client";

import { useEffect, useRef, useState } from "react";
import { EditButton } from "@/components/place-detail/edit-button";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { nicknameSchema } from "@/lib/data";
import type { Session } from "@/lib/types";

export const NICKNAME_RANGE_MESSAGE = "한글·영문·숫자로 2~12자 적어주세요";
export const NICKNAME_SAVED_NOTICE = "닉네임을 바꿨어요";
export const NICKNAME_SAVE_FAILED_NOTICE = "닉네임을 바꾸지 못했어요";

interface ProfileRowProps {
  session: Session;
  /** 저장 — 거부(reject)면 부모가 토스트 */
  onSave: (nickname: string) => Promise<void>;
  onNotice: (message: string) => void;
}

/**
 * 화면 5 항목 1 — 프로필 행: 40px 틴트 원 + 첫 글자 / 닉네임 + "카카오로 로그인됨" / 오른쪽 옅은 [수정].
 * [수정]이면 닉네임이 인라인 입력(2~12자)으로 바뀌고 [저장]·[취소]. 범위 밖이면 입력 아래 한 줄.
 */
export function ProfileRow({ session, onSave, onNotice }: ProfileRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);
  const nickname = session.nickname ?? "";
  const initial = nickname.trim().charAt(0);

  const startEdit = () => {
    setDraft(nickname);
    setError(null);
    setEditing(true);
  };

  const save = () => {
    if (pending) return; // Enter 연타 — 버튼은 disabled지만 키보드 경로는 아니다
    const parsed = nicknameSchema.safeParse(draft);
    if (!parsed.success) {
      setError(NICKNAME_RANGE_MESSAGE);
      return;
    }
    setPending(true);
    onSave(parsed.data).then(
      () => {
        setPending(false);
        setEditing(false);
        onNotice(NICKNAME_SAVED_NOTICE);
      },
      () => {
        setPending(false);
        onNotice(NICKNAME_SAVE_FAILED_NOTICE);
      },
    );
  };

  return (
    <div className="flex items-center gap-3 px-5 pt-1 pb-4">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-max bg-brand-tint text-body-l-semibold text-brand-fg"
      >
        {initial}
      </span>
      {editing ? (
        <div className="min-w-0 flex-1">
          <div className="flex items-end gap-2">
            <TextField
              ref={inputRef}
              label="닉네임"
              value={draft}
              maxLength={12}
              error={error}
              className="min-w-0 flex-1"
              onChange={(e) => {
                setDraft(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) save();
              }}
            />
            <Button variant="outline" size="md" onClick={save} disabled={pending} aria-busy={pending}>
              {pending ? "저장 중…" : "저장"}
            </Button>
            <Button
              variant="outline"
              size="md"
              className="text-fg-secondary"
              onClick={() => {
                setEditing(false);
              }}
              disabled={pending}
            >
              취소
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className="truncate text-body-l-semibold text-fg">{nickname}</p>
            <p className="text-caption-l-regular text-fg-tertiary">카카오로 로그인됨</p>
          </div>
          <EditButton label="닉네임 수정" onClick={startEdit} />
        </>
      )}
    </div>
  );
}
