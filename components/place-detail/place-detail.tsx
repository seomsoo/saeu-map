"use client";

import { useEffect, useRef } from "react";
import { ReviewForm } from "@/components/review/review-form";
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
import { PhotoViewer } from "./photo-viewer";
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
  /** 제보 완료 "리뷰도 남겨볼래요?"로 들어옴 — 열리자마자 리뷰 게이트(→ 폼). 한 번 쓰고 부모가 지운다 */
  autoReview?: boolean | undefined;
  onAutoReviewConsumed?: (() => void) | undefined;
  onPatchPlace: (place: Place) => void;
  onChecked: (placeId: string) => void;
  onToggleBookmark: () => void;
  onNotice: (message: string) => void;
}

/**
 * 화면 2 — 가게 상세 본문 (spec 4.2 순서 1~9 엄수). 바텀시트 detail 모드 안에 들어간다.
 * 확인 줄(3번)은 해체됐다 — 신선도는 상호 아래 캡션, 액션은 사이드와 리뷰 사이 기여 블록.
 * 닫기 ✕는 본문이 아니라 시트 헤더에 있다(bottom-sheet의 onDismiss).
 */
export function PlaceDetail({
  place,
  now,
  bookmarked,
  checked,
  initialReviews,
  autoReview = false,
  onAutoReviewConsumed,
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

  // 제보 완료에서 넘어온 리뷰 의도는 한 번만 — ref라 StrictMode 이중 effect에도 게이트가 두 번 서지 않는다
  const autoHandled = useRef(false);
  const { writeReview } = d;
  useEffect(() => {
    if (!autoReview || autoHandled.current) return;
    autoHandled.current = true;
    onAutoReviewConsumed?.();
    writeReview();
  }, [autoReview, onAutoReviewConsumed, writeReview]);

  return (
    <article aria-label={`${place.name} 상세`}>
      {/* 1 */}
      <PhotoArea
        place={d.place}
        onUploadPhoto={d.comingSoon}
        onOpenPhoto={d.openPhoto}
      />
      {/* 2 */}
      <PlaceHeader place={d.place} now={now} />
      {d.place.isNew && <NewPlaceBanner />}
      {/* 3 — 주소·지번·영업시간 한 블록 */}
      <PlaceInfo
        place={d.place}
        onCopy={d.copyAddress}
        onSuggestHours={d.comingSoon}
        onSuggestAddress={d.comingSoon}
      />
      {/* 4 */}
      <ActionRow
        bookmarked={bookmarked}
        onRoute={d.openRoute}
        onShare={d.share}
        onToggleBookmark={onToggleBookmark}
      />
      <SectionBand />
      {/* 5 */}
      <MenuList menus={d.place.menus} onSuggest={d.comingSoon} />
      {/* 6 */}
      <SidesRow sides={d.place.sides} onSuggest={d.comingSoon} />
      <SectionBand />
      {/* 7 — 구 3(확인 줄)의 액션 자리. 신선도는 상호 아래 캡션, 여기는 "그래서 뭘 하면 되나"만 */}
      <ContributionBand
        place={d.place}
        now={now}
        done={d.done}
        onCheckIn={d.checkIn}
        onWriteReview={d.writeReview}
      />
      <SectionBand />
      {/* 8 */}
      <ReviewSection
        status={d.status}
        reviews={d.reviews}
        naverUrl={naverUrl}
        currentUserId={d.currentUserId}
        onRetry={d.retryReviews}
        onEdit={d.editReview}
        onDelete={d.deleteReview}
      />
      <SectionBand />
      {/* 9 */}
      <FooterLinks onSelect={d.comingSoon} />
      {/* 화면 5 변형 (b) — 리뷰 폼. 뷰어와 같은 top layer 오버레이 */}
      {d.reviewForm && (
        <ReviewForm
          placeId={place.id}
          placeName={place.name}
          now={now}
          initial={d.reviewForm.initial}
          onSaved={d.handleReviewSaved}
          onClose={d.closeReviewForm}
        />
      )}
      {/* 변형 (e) — 전체 화면 사진 뷰어. body 포털이라 시트 밖(top layer)에 뜬다. */}
      {d.photoIndex !== null && (
        <PhotoViewer
          photos={d.place.photos}
          initialIndex={d.photoIndex}
          placeName={d.place.name}
          onClose={d.closePhoto}
          onReport={d.reportPhoto}
        />
      )}
    </article>
  );
}
