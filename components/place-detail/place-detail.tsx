"use client";

import { SectionBand } from "@/components/ui/section-band";
import { isAllowedNaverPlaceUrl } from "@/lib/naver-links";
import type { Place, Review } from "@/lib/types";
import { ActionRow } from "./action-row";
import { ContributionBand } from "./contribution-band";
import { FooterLinks } from "./footer-links";
import { PlaceInfo } from "./info-rows";
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
  /** 이 세션에서 이미 "다녀왔어요"를 누른 가게 */
  checked: boolean;
  initialReviews?: Review[] | undefined;
  onPatchPlace: (place: Place) => void;
  onChecked: (placeId: string) => void;
  onToggleBookmark: () => void;
  onNotice: (message: string) => void;
}

/**
 * 화면 2 — 가게 상세 본문 (spec 4.2 순서 1~10 엄수). 바텀시트 detail 모드 안에 들어간다.
 * 확인 줄(3번)은 해체됐다 — 신선도는 상호 아래 캡션, 액션은 사이드와 리뷰 사이 기여 블록.
 * 닫기 ✕는 본문이 아니라 시트 헤더에 있다(bottom-sheet의 onDismiss).
 */
export function PlaceDetail({
  place,
  now,
  bookmarked,
  checked,
  initialReviews,
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
  const hasPhoto = place.photoUrls.length > 0;

  return (
    <article aria-label={`${place.name} 상세`}>
      {/* 1 */}
      <PhotoArea place={d.place} naverUrl={hasPhoto ? null : naverUrl} onUploadPhoto={d.comingSoon} />
      {/* 2 */}
      <PlaceHeader place={d.place} now={now} />
      {d.place.isNew && <NewPlaceBanner />}
      {/* 4·5 — 주소·지번·영업시간 한 블록 */}
      <PlaceInfo place={d.place} onCopy={d.copyAddress} onSuggestHours={d.comingSoon} />
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
      <SidesRow sides={d.place.sides} onSuggest={d.comingSoon} />
      <SectionBand />
      {/* 3의 액션 자리 — 신선도는 상호 아래 캡션, 여기는 "그래서 뭘 하면 되나"만 */}
      <ContributionBand
        place={d.place}
        now={now}
        done={d.done}
        onCheckIn={d.checkIn}
        onWriteReview={d.comingSoon}
      />
      <SectionBand />
      {/* 9 */}
      <ReviewSection
        status={d.status}
        reviews={d.reviews}
        naverUrl={hasPhoto ? naverUrl : null}
        onRetry={d.retryReviews}
      />
      <SectionBand />
      {/* 10 */}
      <FooterLinks onSelect={d.comingSoon} />
    </article>
  );
}
