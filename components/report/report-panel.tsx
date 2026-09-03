"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Place } from "@/lib/types";
import { StepFrame } from "./step-frame";
import { StepName } from "./step-name";
import type { ReportStep } from "./types";

export interface ReportPanelProps {
  step: ReportStep;
  places: readonly Place[];
  /** ‹ — 히스토리 한 단계 뒤로(이전 단계, 1단계에선 닫힘) */
  onBack: () => void;
  onStepChange: (step: ReportStep) => void;
  /** 이미 있는 가게로 넘어가기 — 플로우를 닫고 그 가게 상세를 연다 */
  onOpenExisting: (id: string) => void;
}

/**
 * 화면 3 — 바텀시트 안 제보 퍼널. 단계(step)와 히스토리는 지도 훅이 갖고, 입력값은 이 패널이 갖는다
 * (단계를 오가도 패널이 마운트돼 있어 값이 남는다. 플로우를 닫으면 언마운트 = 초기화).
 */
export function ReportPanel({ step, places, onBack, onStepChange, onOpenExisting }: ReportPanelProps) {
  const [name, setName] = useState("");

  switch (step) {
    case 1:
      return (
        <StepName
          places={places}
          value={name}
          onChange={setName}
          onBack={onBack}
          onOpenExisting={onOpenExisting}
          onNext={() => {
            onStepChange(2);
          }}
        />
      );
    case 2:
      return (
        <StepFrame
          step={2}
          title="핀을 가게 위치로 옮겨주세요"
          caption="지도에서 핀을 끌어 맞춰주세요"
          onBack={onBack}
          footer={
            <Button
              variant="brand"
              size="xl"
              className="w-full"
              onClick={() => {
                onStepChange(3);
              }}
            >
              여기가 맞아요
            </Button>
          }
        />
      );
    case 3:
      return (
        <StepFrame
          step={3}
          title="메뉴와 가격을 알려주세요"
          caption="대표 메뉴 한 줄이면 돼요"
          onBack={onBack}
          footer={
            <Button
              variant="brand"
              size="xl"
              className="w-full"
              onClick={() => {
                onStepChange(4);
              }}
            >
              다음
            </Button>
          }
        />
      );
    case 4:
      return (
        <StepFrame
          step={4}
          title="더 알려주실 게 있나요?"
          caption="모두 선택 사항이에요"
          onBack={onBack}
          footer={
            <Button
              variant="brand"
              size="xl"
              className="w-full"
              onClick={() => {
                onStepChange("done");
              }}
            >
              건너뛰고 등록
            </Button>
          }
        />
      );
    case "done":
      return (
        <StepFrame
          step="done"
          title="등록됐어요!"
          caption="지도에 바로 보여요. 7일간 '새로 제보됨' 표시가 붙어요"
          footer={
            <Button variant="brand" size="xl" className="w-full">
              내 핀 보러가기
            </Button>
          }
        />
      );
  }
}
