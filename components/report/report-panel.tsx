"use client";

import type { AddressHit } from "@/components/map/map-view";
import { Button } from "@/components/ui/button";
import type { LatLng, Place } from "@/lib/types";
import { StepFrame } from "./step-frame";
import { StepLocation } from "./step-location";
import { StepMenu } from "./step-menu";
import { StepName } from "./step-name";
import type { ReportStep } from "./types";
import { useReportFlow } from "./use-report-flow";

export interface ReportPanelProps {
  step: ReportStep;
  places: readonly Place[];
  /** 2단계 핀 (지도 훅 소유) */
  pin: LatLng | null;
  geocode: (query: string) => Promise<AddressHit[]>;
  /** ‹ — 히스토리 한 단계 뒤로(이전 단계, 1단계에선 닫힘) */
  onBack: () => void;
  onStepChange: (step: ReportStep) => void;
  /** 주소 검색으로 핀 이동 */
  onPinChange: (point: LatLng) => void;
  /** 중복 후보가 보이게 지도를 맞춘다 */
  onShowCandidate: (candidate: Place) => void;
  /** 이미 있는 가게로 넘어가기 — 플로우를 닫고 그 가게 상세를 연다 */
  onOpenExisting: (id: string) => void;
}

/**
 * 화면 3 — 바텀시트 안 제보 퍼널. 단계(step)와 히스토리는 지도 훅이 갖고, 입력값은 이 패널이 갖는다
 * (단계를 오가도 패널이 마운트돼 있어 값이 남는다. 플로우를 닫으면 언마운트 = 초기화).
 */
export function ReportPanel({
  step,
  places,
  pin,
  geocode,
  onBack,
  onStepChange,
  onPinChange,
  onShowCandidate,
  onOpenExisting,
}: ReportPanelProps) {
  const { draft, patch, patchMenu, isDuplicateDismissed, dismissDuplicate } = useReportFlow();

  switch (step) {
    case 1:
      return (
        <StepName
          places={places}
          value={draft.name}
          onChange={(name) => {
            patch({ name });
          }}
          onBack={onBack}
          onOpenExisting={onOpenExisting}
          onNext={() => {
            onStepChange(2);
          }}
        />
      );
    case 2:
      return (
        <StepLocation
          name={draft.name}
          pin={pin}
          places={places}
          isDuplicateDismissed={isDuplicateDismissed}
          geocode={geocode}
          onBack={onBack}
          onPinChange={onPinChange}
          onShowCandidate={onShowCandidate}
          onOpenExisting={onOpenExisting}
          onDismissDuplicate={dismissDuplicate}
          onConfirm={(duplicateOf) => {
            patch({ duplicateOf });
            onStepChange(3);
          }}
        />
      );
    case 3:
      return (
        <StepMenu
          grill={draft.grill}
          rawToo={draft.rawToo}
          raw={draft.raw}
          onChangeGrill={(changes) => {
            patchMenu("grill", changes);
          }}
          onChangeRaw={(changes) => {
            patchMenu("raw", changes);
          }}
          onRawTooChange={(rawToo) => {
            patch({ rawToo });
          }}
          onBack={onBack}
          onNext={() => {
            onStepChange(4);
          }}
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
