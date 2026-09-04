"use client";

import { useState } from "react";
import type { AddressHit } from "@/components/map/map-view";
import { Button } from "@/components/ui/button";
import { getGuOfPoint } from "@/lib/data";
import { findDuplicate, findOverlapping } from "@/lib/duplicates";
import { formatDistance, haversineKm } from "@/lib/geo";
import { TAG_LABELS } from "@/lib/places";
import type { LatLng, Place } from "@/lib/types";
import { AddressSearch } from "./address-search";
import { StepFrame } from "./step-frame";

export const OUTSIDE_KOREA_ERROR = "한국 안의 위치만 제보할 수 있어요";

/** 중복 의심 후보 — name: 150m 안 비슷한 상호 / overlap: 핀 자리(30m) 기존 가게 또는 탭한 마커 */
interface Candidate {
  place: Place;
  reason: "name" | "overlap";
}

const CANDIDATE_TITLE: Record<Candidate["reason"], string> = {
  name: "150m 안에 비슷한 가게가 있어요",
  overlap: "핀 자리에 이미 등록된 가게가 있어요",
};

interface StepLocationProps {
  /** 1단계에서 넣은 이름 — 중복 재검사에 쓴다 */
  name: string;
  pin: LatLng | null;
  places: readonly Place[];
  /** 이미 "다른 가게예요"라고 답한 후보인지 — 다시 묻지 않는다 */
  isDuplicateDismissed: (id: string) => boolean;
  geocode: (query: string) => Promise<AddressHit[]>;
  onBack: () => void;
  /** 주소 검색으로 핀 이동 */
  onPinChange: (point: LatLng) => void;
  /** 중복 후보가 보이게 지도를 맞춘다 (핀 + 후보) */
  onShowCandidate: (candidate: Place) => void;
  /** 지도에서 탭한 기존 마커 — 그 가게로 후보 패널을 연다(지도 훅이 fitBounds까지 한다) */
  tappedPlaceId: string | null;
  onClearTapped: () => void;
  /** [이 가게예요] — 그 가게 상세로, 플로우 닫힘 */
  onOpenExisting: (id: string) => void;
  /** [다른 가게예요] — 후보를 기억하고 다음으로 */
  onDismissDuplicate: (id: string) => void;
  /** 위치 확정 — duplicateOf는 의심 후보 id 또는 null */
  onConfirm: (duplicateOf: string | null) => void;
}

/**
 * 2단계 — 위치 (design 화면 3-2). 지도를 탭하면 핀이 오고(드래그는 미세 조정), 주소 검색은 보조. [여기가 맞아요]를 누르면
 * 핀 좌표로 구를 판정해 한국 밖(바다)이면 막고, 150m 안 비슷한 상호가 있거나 핀 자리 30m 안에 기존 가게가 있으면
 * 같은 시트 안에서 중복 의심 패널로 바뀐다(변형 (a)). 기존 마커를 탭해도 그 가게로 같은 패널이 열린다.
 */
export function StepLocation({
  name,
  pin,
  places,
  isDuplicateDismissed,
  geocode,
  onBack,
  onPinChange,
  onShowCandidate,
  tappedPlaceId,
  onClearTapped,
  onOpenExisting,
  onDismissDuplicate,
  onConfirm,
}: StepLocationProps) {
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [found, setFound] = useState<Candidate | null>(null);
  const tapped = tappedPlaceId === null ? null : (places.find((p) => p.id === tappedPlaceId) ?? null);
  const candidate: Candidate | null = tapped ? { place: tapped, reason: "overlap" } : found;

  const confirm = async () => {
    if (!pin || checking) return;
    setChecking(true);
    setError(null);
    try {
      const gu = await getGuOfPoint(pin);
      if (gu === null) {
        setError(OUTSIDE_KOREA_ERROR);
        return;
      }
      // 상호가 비슷한 가게(150m)가 먼저, 없으면 핀 자리(30m)의 아무 가게. 이미 "다른 가게예요"라고 답한 후보는 건너뛴다
      const byName = findDuplicate({ name, lat: pin.lat, lng: pin.lng }, places);
      const overlap = findOverlapping(pin, places);
      const ask = [byName, overlap].find((p) => p !== null && !isDuplicateDismissed(p.id)) ?? null;
      if (ask) {
        setFound({ place: ask, reason: ask === byName ? "name" : "overlap" });
        onShowCandidate(ask);
        return;
      }
      onConfirm(byName?.id ?? overlap?.id ?? null);
    } finally {
      setChecking(false);
    }
  };

  if (candidate && pin) {
    const { place, reason } = candidate;
    return (
      <StepFrame
        step={2}
        title={CANDIDATE_TITLE[reason]}
        caption="같은 가게면 그 가게로 이동해요"
        onBack={() => {
          if (tapped) onClearTapped();
          else setFound(null);
        }}
        footer={
          <div className="flex gap-2">
            <Button
              size="xl"
              className="flex-1"
              onClick={() => {
                onOpenExisting(place.id);
              }}
            >
              이 가게예요
            </Button>
            <Button
              size="xl"
              className="flex-1"
              onClick={() => {
                onDismissDuplicate(place.id);
                onConfirm(place.id);
              }}
            >
              다른 가게예요
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-3 rounded-12 border border-line-hairline p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-body-l-semibold text-fg">{place.name}</p>
            <p className="truncate text-caption-l-regular text-fg-tertiary">
              {[place.gu, ...place.tags.map((t) => TAG_LABELS[t])].join(" · ")}
            </p>
          </div>
          <span className="shrink-0 text-body-m-medium text-fg tabular-nums">
            {formatDistance(haversineKm(pin, place))}
          </span>
        </div>
      </StepFrame>
    );
  }

  return (
    <StepFrame
      step={2}
      title="핀을 가게 위치로 옮겨주세요"
      caption="지도를 탭하거나 핀을 끌어 맞춰주세요"
      onBack={onBack}
      footer={
        <Button
          variant="brand"
          size="xl"
          className="w-full"
          disabled={!pin || checking}
          onClick={() => {
            void confirm();
          }}
        >
          여기가 맞아요
        </Button>
      }
    >
      <AddressSearch
        geocode={geocode}
        onPick={(hit) => {
          setError(null);
          onPinChange({ lat: hit.lat, lng: hit.lng });
        }}
      />
      {error && (
        <p role="alert" className="mt-1.5 text-caption-l-regular text-brand-fg">
          {error}
        </p>
      )}
    </StepFrame>
  );
}
