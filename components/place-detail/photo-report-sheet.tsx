"use client";

import type { PhotoReportReason } from "@/lib/data";

/** 사유 4개 고정 — 자유 입력은 없다(목 단계에 저장할 곳도, 읽을 사람도 없다). */
const REASONS: { value: PhotoReportReason; label: string }[] = [
  { value: "inappropriate", label: "부적절한 사진" },
  { value: "wrong_place", label: "다른 가게 사진" },
  { value: "spam", label: "광고·도배" },
  { value: "other", label: "기타" },
];

interface PhotoReportSheetProps {
  /** 접수 중인 사유(없으면 null). 하나라도 진행 중이면 네 행 모두 잠근다. */
  pending: PhotoReportReason | null;
  onSelect: (reason: PhotoReportReason) => void;
  onClose: () => void;
}

/**
 * 사진 신고 사유 패널 — 뷰어 하단에서 올라온다(design 화면 2 변형 (e)).
 * **탭이 곧 제출**이라 확인 버튼이 없다: 고르고도 안 낸 상태를 만들지 않는다.
 * 표시만 하고 쓰기는 부모(뷰어 → use-place-detail)가 한다.
 */
export function PhotoReportSheet({ pending, onSelect, onClose }: PhotoReportSheetProps) {
  const busy = pending !== null;
  return (
    <section
      aria-label="사진 신고"
      className="rounded-t-20 bg-bg pb-safe-bottom-or-3 text-fg shadow-upper"
    >
      <div className="flex items-center justify-between pr-2 pl-5">
        <h2 className="text-body-m-medium">신고 사유를 골라주세요</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="신고 닫기"
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
              disabled={busy}
              onClick={() => {
                onSelect(value);
              }}
              className="press flex h-11 w-full items-center px-5 text-body-l-regular disabled:text-fg-tertiary"
            >
              {pending === value ? "접수 중…" : label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
