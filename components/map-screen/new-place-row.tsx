"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { useCheckIn } from "@/components/place-detail/use-check-in";
import { TAG_LABELS, primaryMenuLine } from "@/lib/places";
import { formatKstDate } from "@/lib/time";
import type { Place } from "@/lib/types";
import { cx } from "@/lib/cx";
import { PlaceThumbnail } from "./place-card";

interface NewPlaceRowProps {
  place: Place;
  now: string;
  /** 이 세션에서 이미 확인한 가게(상세의 다녀왔어요와 공유) */
  checked: boolean;
  onOpen: (id: string) => void;
  onPatchPlace: (place: Place) => void;
  onChecked: (placeId: string) => void;
  onFlag: (place: Place) => void;
  onNotice: (message: string) => void;
}

/**
 * 화면 4 행 — 썸네일 64 + 상호·등록일 / 구·카테고리 / 대표 메뉴 / 상태·액션 줄.
 * 썸네일·텍스트가 한 버튼(상세로), [맞아요][달라요]는 그 형제(버튼 안 버튼 금지).
 * 맞아요 = 다녀왔어요(`useCheckIn`): 즉시 "확인됨" + 틴트 [확인했어요], 실패 시 원복 + 토스트.
 */
export function NewPlaceRow({
  place,
  now,
  checked,
  onOpen,
  onPatchPlace,
  onChecked,
  onFlag,
  onNotice,
}: NewPlaceRowProps) {
  const { place: shown, done, checkIn } = useCheckIn({
    place,
    now,
    checked,
    onPatchPlace,
    onChecked,
    onNotice,
  });
  const verified = shown.checkCount >= 1;
  const categories = shown.tags.map((tag) => TAG_LABELS[tag]).join(" · ");
  const menu = primaryMenuLine(shown);

  return (
    <li data-place-id={shown.id} className="px-5 py-3">
      <button
        type="button"
        onClick={() => {
          onOpen(shown.id);
        }}
        aria-label={`${shown.name}, ${shown.gu}`}
        className="flex w-full gap-3 text-left"
      >
        <PlaceThumbnail place={shown} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 truncate text-body-l-semibold text-fg">{shown.name}</h3>
            {shown.createdAt && (
              <span className="shrink-0 pt-0.5 text-caption-l-regular text-fg-tertiary tabular-nums">
                {formatKstDate(shown.createdAt)} 등록
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-caption-l-regular text-fg-secondary">
            {shown.gu} · {categories}
          </p>
          {menu ? (
            <p className="mt-1 truncate text-body-m-regular text-fg tabular-nums">{menu}</p>
          ) : (
            <p className="mt-1 text-caption-l-regular text-fg-tertiary">메뉴 정보가 없어요</p>
          )}
        </div>
      </button>
      {/* 상태·액션 줄 — 텍스트 열에 맞춰 들여쓴다(썸네일 64 + 간격 12) */}
      <div className="mt-2 flex items-center justify-between gap-3 pl-19">
        {verified ? (
          <span className="flex items-center gap-1 text-caption-l-medium text-fg-secondary">
            <span className="icon-[ci--check] size-3" aria-hidden="true" />
            확인됨
          </span>
        ) : (
          <span className="text-caption-l-regular text-fg-tertiary">검증 전</span>
        )}
        <div className="flex shrink-0 gap-2">
          {done ? (
            <span role="status" className={cx(buttonVariants({ variant: "tint", size: "md" }))}>
              <span className="icon-[ci--check] size-4" aria-hidden="true" />
              확인했어요
            </span>
          ) : (
            <Button variant="outline" size="md" onClick={checkIn}>
              <span className="icon-[ci--check] size-4" aria-hidden="true" />
              맞아요
            </Button>
          )}
          <Button
            variant="outline"
            size="md"
            className="text-fg-secondary"
            onClick={() => {
              onFlag(shown);
            }}
          >
            달라요
          </Button>
        </div>
      </div>
    </li>
  );
}
