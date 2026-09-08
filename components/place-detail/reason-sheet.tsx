"use client";

import { useEffect, useRef, useState } from "react";
import { ModalSheet, closeEnclosingDialog } from "@/components/ui/modal-sheet";
import { flagPlace, reportPlace } from "@/lib/data";
import type { Place, PlaceFlagReason, PlaceReportReason } from "@/lib/types";

/** 정보 수정 제안 — "값이 틀렸다" (design 화면 2-9). */
const FLAG_REASONS: { value: PlaceFlagReason; label: string }[] = [
  { value: "location", label: "위치가 달라요" },
  { value: "menu", label: "메뉴·가격이 달라요" },
  { value: "closed", label: "문 닫았어요" },
  { value: "other", label: "기타" },
];

/**
 * 가게 신고 — "이 등록 자체가 잘못됐다"(spec 5 "신고 3회 → 자동 숨김", decisions 2026-09-08).
 * [문 닫았어요]가 없는 건 그게 위 수정 제안의 사유이기 때문이다 — 같은 말을 두 입구에 두지 않는다.
 */
const REPORT_REASONS: { value: PlaceReportReason; label: string }[] = [
  { value: "not_shrimp", label: "새우집이 아니에요" },
  { value: "fake", label: "허위·광고성 등록" },
  { value: "duplicate", label: "중복 등록이에요" },
  { value: "other", label: "기타" },
];

export const REASON_FAILED_MESSAGE = "접수하지 못했어요. 다시 눌러주세요";

/** 어느 입구에서 열렸나 — 사유 목록·제목·제출 함수만 다르고 생김새와 동작은 같다. */
export type ReasonKind = "flag" | "report";

interface ReasonSheetProps {
  place: Place;
  kind: ReasonKind;
  /** 접수 성공 — 부모가 시트를 닫고 토스트를 낸다 */
  onSubmitted: () => void;
  /** 딤·Escape·✕·뒤로가기 */
  onClose: () => void;
}

/**
 * 사유 시트 (design 화면 2 "상세의 쓰기 표면") — 바텀 모달, 44px 행 4개. **탭이 곧 제출**이라 확인 버튼이 없다:
 * 고르고도 안 낸 상태를 만들지 않는다. 접수 중엔 누른 행이 "접수 중…"으로 비활성, 실패하면 시트 안 오류 한 줄 +
 * 다시 탭이 재시도. 사진 신고(변형 (e))도 같은 문법이지만 그건 뷰어 안 표면이라 별도 컴포넌트다.
 * 접수된 것은 관리자 신고 큐로 간다(Phase 6, spec 4.5) — 값 수정과 달리 이건 **즉시 반영이 아니다**.
 */
export function ReasonSheet({ place, kind, onSubmitted, onClose }: ReasonSheetProps) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const flag = kind === "flag";
  const reasons = flag ? FLAG_REASONS : REPORT_REASONS;
  const title = flag ? "어떤 정보가 달라요?" : "무엇이 문제인가요?";
  // 접근성 이름은 제목이 아니라 "무엇에 대한 시트인가" — 질문을 그대로 읽으면 어느 가게인지가 흐려진다
  const label = `${place.name} ${flag ? "정보가 달라요" : "신고"}`;

  const submit = (reason: string) => {
    if (pending !== null) return;
    setPending(reason);
    setError(null);
    const sent = flag
      ? flagPlace({ placeId: place.id, reason: reason as PlaceFlagReason })
      : reportPlace({ placeId: place.id, reason: reason as PlaceReportReason });
    sent.then(
      () => {
        if (!alive.current) return;
        setPending(null);
        onSubmitted();
      },
      () => {
        if (!alive.current) return;
        setPending(null);
        setError(REASON_FAILED_MESSAGE);
      },
    );
  };

  return (
    <ModalSheet label={label} onClose={onClose}>
      <div className="flex items-center justify-between pr-2 pl-5">
        <h2 className="text-body-m-medium text-fg">{title}</h2>
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
        {reasons.map(({ value, label }) => (
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
