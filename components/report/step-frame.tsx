import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { REPORT_STEP_COUNT, type ReportStep } from "./types";

/** 헤더 아래 4칸 세그먼트 — 숫자 "1/4" 대신 칸으로 읽힌다 (design 화면 3 규칙) */
function ProgressSegments({ step }: { step: number }) {
  return (
    <div
      role="progressbar"
      aria-label="제보 진행"
      aria-valuemin={1}
      aria-valuemax={REPORT_STEP_COUNT}
      aria-valuenow={step}
      className="flex shrink-0 gap-1 px-5 pt-1"
    >
      {Array.from({ length: REPORT_STEP_COUNT }, (_, i) => (
        <span
          key={i}
          className={cx("h-0.5 flex-1 rounded-max", i < step ? "bg-brand" : "bg-line-hairline")}
        />
      ))}
    </div>
  );
}

interface StepFrameProps {
  step: ReportStep;
  title: string;
  caption: string;
  /** ‹ (없으면 줄 자체가 없다 — 완료 화면) */
  onBack?: (() => void) | undefined;
  /** 시트 바닥에 고정되는 CTA 줄 — 이 화면의 유일한 채운 레드가 여기 들어간다 */
  footer: ReactNode;
  children?: ReactNode;
}

/**
 * 퍼널 한 장의 뼈대: 진행 세그먼트 / ‹ 줄(44) / 제목(24 bold) + 캡션(14 fg-secondary) / 본문(스크롤) / 바닥 CTA.
 * 시트 본문(.saeu-sheet__body) 높이를 꽉 채우고 본문만 스크롤된다 — CTA는 요약 스냅에서도 늘 보인다.
 * ‹는 헤더가 아니라 패널 첫 줄이다: 헤더는 시트 드래그 표적이라 버튼을 더 두지 않는다(design 화면 3).
 */
export function StepFrame({ step, title, caption, onBack, footer, children }: StepFrameProps) {
  return (
    <div className="flex h-full flex-col">
      {step !== "done" && <ProgressSegments step={step} />}
      <div className="min-h-0 flex-1 overflow-y-auto px-5">
        {onBack && (
          <div className="-ml-2 flex h-11 items-center">
            <button
              type="button"
              onClick={onBack}
              aria-label="이전"
              className="press flex size-11 items-center justify-center text-fg"
            >
              <span className="icon-[ci--chevron-left] size-6" aria-hidden="true" />
            </button>
          </div>
        )}
        <h2 className={cx("text-title-m-bold text-fg", !onBack && "pt-4")}>{title}</h2>
        <p className="mt-1 text-body-m-regular text-fg-secondary">{caption}</p>
        {children && <div className="mt-5 pb-3">{children}</div>}
      </div>
      <div className="shrink-0 px-5 pt-3 pb-safe-bottom-or-3">{footer}</div>
    </div>
  );
}
