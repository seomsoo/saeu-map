"use client";

import { SectionBand } from "@/components/ui/section-band";
import { isAllowedNaverPlaceUrl } from "@/lib/naver-links";
import type { Place, Review } from "@/lib/types";
import { ActionRow } from "./action-row";
import { CheckLine } from "./check-line";
import { FooterLinks } from "./footer-links";
import { AddressRow, HoursRow } from "./info-rows";
import { MenuList } from "./menu-list";
import { NewPlaceBanner } from "./new-place-banner";
import { PhotoArea } from "./photo-area";
import { PlaceHeader } from "./place-header";
import { ReviewSection } from "./review-section";
import { SidesRow } from "./sides-row";
import { usePlaceDetail } from "./use-place-detail";

export interface PlaceDetailProps {
  place: Place;
  /** 서버 렌더 시각(ISO) — 상대 시간·낙관적 확인일의 기준 */
  now: string;
  bookmarked: boolean;
  /** 이 세션에서 이미 "다녀왔다면"을 누른 가게 */
  checked: boolean;
  initialReviews?: Review[] | undefined;
  onClose: () => void;
  onPatchPlace: (place: Place) => void;
  onChecked: (placeId: string) => void;
  onToggleBookmark: () => void;
  onNotice: (message: string) => void;
}

/**
 * 화면 2 — 가게 상세 본문 (spec 4.2 순서 1~10 엄수). 바텀시트 detail 모드 안에 들어간다.
 * 채운 레드는 3번 [다녀왔다면] 한 곳. 섹션 사이는 8px 띠, 안쪽 행은 헤어라인.
 */
export function PlaceDetail({
  place,
  now,
  bookmarked,
  checked,
  initialReviews,
  onClose,
  onPatchPlace,
  onChecked,
  onToggleBookmark,
  onNotice,
}: PlaceDetailProps) {
  const d = usePlaceDetail({
    place,
    now,
    initialReviews,
    checked,
    onPatchPlace,
    onChecked,
    onNotice,
  });
  // 외부 링크는 화이트리스트 호스트만 (규칙 3의 링크판)
  const naverUrl = isAllowedNaverPlaceUrl(place.naverPlaceUrl) ? place.naverPlaceUrl : null;
  const hasPhoto = place.thumbnailUrl !== null;

  return (
    <article aria-label={`${place.name} 상세`}>
      {/* 1 */}
      <PhotoArea place={d.place} naverUrl={hasPhoto ? null : naverUrl} onUploadPhoto={d.comingSoon} />
      {/* 2 */}
      <PlaceHeader place={d.place} onClose={onClose} />
      {d.place.isNew && <NewPlaceBanner />}
      {/* 3 */}
      <CheckLine place={d.place} now={now} done={d.done} onCheckIn={d.checkIn} />
      {/* 4 */}
      <AddressRow place={d.place} onCopy={d.copyAddress} />
      {/* 5 */}
      <HoursRow hoursNote={d.place.hoursNote} onSuggest={d.comingSoon} />
      {/* 6 */}
      <ActionRow
        bookmarked={bookmarked}
        onRoute={d.openRoute}
        onShare={d.share}
        onToggleBookmark={onToggleBookmark}
      />
      <SectionBand />
      {/* 7 */}
      <MenuList menus={d.place.menus} onSuggest={d.comingSoon} />
      {/* 8 */}
      <SidesRow sides={d.place.sides} />
      <SectionBand />
      {/* 9 */}
      <ReviewSection
        status={d.status}
        reviews={d.reviews}
        naverUrl={hasPhoto ? naverUrl : null}
        onRetry={d.retryReviews}
        onWriteReview={d.comingSoon}
      />
      <SectionBand />
      {/* 10 */}
      <FooterLinks onSelect={d.comingSoon} />
    </article>
  );
}
