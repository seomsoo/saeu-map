"use client";

import type { AddressHit } from "@/components/map/map-view";
import { COMING_SOON_NOTICE } from "@/components/place-detail/use-place-detail";
import { sharePlace } from "@/lib/share";
import type { LatLng, Place } from "@/lib/types";
import { StepDone } from "./step-done";
import { StepExtras } from "./step-extras";
import { StepLocation } from "./step-location";
import { StepMenu } from "./step-menu";
import { StepName } from "./step-name";
import type { ReportStep } from "./types";
import { useReportFlow } from "./use-report-flow";

export const SUBMIT_FAILED_NOTICE = "등록하지 못했어요. 다시 시도해주세요";

export interface ReportPanelProps {
  step: ReportStep;
  places: readonly Place[];
  /** 서버 렌더 시각(ISO) — 등록 시각의 목 기준. 클라이언트 Date.now() 금지 */
  now: string;
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
  /** 2단계에서 탭한 기존 마커 — 그 가게로 중복 의심 패널을 연다 */
  tappedPlaceId: string | null;
  onClearTapped: () => void;
  /** 이미 있는 가게로 넘어가기 — 플로우를 닫고 그 가게 상세를 연다 */
  onOpenExisting: (id: string) => void;
  /** 등록 성공 — 목록·마커에 추가 */
  onCreated: (place: Place) => void;
  onNotice: (message: string) => void;
}

/**
 * 화면 3 — 바텀시트 안 제보 퍼널. 단계(step)와 히스토리는 지도 훅이 갖고, 입력값은 이 패널이 갖는다
 * (단계를 오가도 패널이 마운트돼 있어 값이 남는다. 플로우를 닫으면 언마운트 = 초기화).
 */
export function ReportPanel({
  step,
  places,
  now,
  pin,
  geocode,
  onBack,
  onStepChange,
  onPinChange,
  onShowCandidate,
  tappedPlaceId,
  onClearTapped,
  onOpenExisting,
  onCreated,
  onNotice,
}: ReportPanelProps) {
  const {
    draft,
    patch,
    patchMenu,
    isDuplicateDismissed,
    dismissDuplicate,
    submitting,
    created,
    submit,
  } = useReportFlow();

  const handleSubmit = async () => {
    if (!pin) {
      onStepChange(2);
      return;
    }
    const result = await submit(pin, now);
    if (result === "invalid") {
      onStepChange(3);
      return;
    }
    if (result === null) {
      onNotice(SUBMIT_FAILED_NOTICE);
      return;
    }
    onCreated(result);
    onStepChange("done");
  };

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
          tappedPlaceId={tappedPlaceId}
          onClearTapped={onClearTapped}
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
        <StepExtras
          photos={draft.photos}
          sides={draft.sides}
          hoursNote={draft.hoursNote}
          submitting={submitting}
          onPhotosChange={(photos) => {
            patch({ photos });
          }}
          onSidesChange={(sides) => {
            patch({ sides });
          }}
          onHoursNoteChange={(hoursNote) => {
            patch({ hoursNote });
          }}
          onBack={onBack}
          onSubmit={() => {
            void handleSubmit();
          }}
        />
      );
    case "done":
      if (!created) return null;
      return (
        <StepDone
          place={created}
          onOpen={() => {
            onOpenExisting(created.id);
          }}
          onShare={() => {
            sharePlace(created, onNotice);
          }}
          onReview={() => {
            onNotice(COMING_SOON_NOTICE);
          }}
        />
      );
  }
}
