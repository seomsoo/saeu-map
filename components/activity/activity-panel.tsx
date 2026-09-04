"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { PlaceCard, PlaceCardSkeleton } from "@/components/map-screen/place-card";
import { ReviewRow } from "@/components/place-detail/review-section";
import { ReviewForm } from "@/components/review/review-form";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useOverlayHistory } from "@/components/ui/use-overlay-history";
import { pushOverlayHistoryEntry } from "@/lib/history-state";
import type { LatLng, Place } from "@/lib/types";
import { DeleteAccountSheet } from "./delete-account-sheet";
import { ProfileRow } from "./profile-row";
import { ACTIVITY_TABS, useActivity, type ActivityTab, type LoadStatus } from "./use-activity";

interface ActivityPanelProps {
  now: string;
  tab: ActivityTab;
  onTabChange: (tab: ActivityTab) => void;
  /** 찜한 가게 — 진실은 지도 훅(places ∩ bookmarkedIds) */
  bookmarkedPlaces: readonly Place[];
  origin: LatLng | null;
  onOpenPlace: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  /** 활성 탭의 가게 id — 열린 동안 지도 마커는 이것만 (design 화면 5) */
  onPlaceIdsChange: (ids: readonly string[]) => void;
  onSignedOut: () => void;
  onAccountDeleted: () => void;
  onNotice: (message: string) => void;
}

function ListSkeleton() {
  return (
    <ul aria-busy="true" aria-label="불러오는 중" className="divide-y divide-line-hairline">
      <PlaceCardSkeleton />
      <PlaceCardSkeleton />
      <PlaceCardSkeleton />
    </ul>
  );
}

function ReviewsSkeleton() {
  return (
    <div aria-busy="true" aria-label="불러오는 중" className="space-y-2 px-5 py-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}

function statusView(status: LoadStatus, onRetry: () => void, loading: React.ReactNode) {
  if (status === "loading") return loading;
  if (status === "error") return <ErrorState title="불러오지 못했어요" onRetry={onRetry} />;
  return null;
}

/**
 * 화면 5 — 내 활동 패널 본문(시트 me 모드). 프로필 행 / 세그먼트 3탭 / 탭 본문(4상태) / 맨 아래 "로그아웃 │ 탈퇴".
 * 찜 카드의 하트(카드 버튼의 형제)는 즉시 목록에서 빼고(부모 state), 내 리뷰 행은 상세와 같은 ReviewRow.
 */
export function ActivityPanel({
  now,
  tab,
  onTabChange,
  bookmarkedPlaces,
  origin,
  onOpenPlace,
  onToggleBookmark,
  onPlaceIdsChange,
  onSignedOut,
  onAccountDeleted,
  onNotice,
}: ActivityPanelProps) {
  const { session, signOut, deleteAccount, updateNickname } = useSession();
  const a = useActivity({ now, tab, onNotice });

  // 활성 탭의 가게만 지도에 — 탭·목록이 바뀔 때마다 부모에 알린다
  useEffect(() => {
    const ids =
      tab === "bookmarks"
        ? bookmarkedPlaces.map((p) => p.id)
        : tab === "reviews"
          ? a.reviews.map((r) => r.placeId)
          : a.reports.map((p) => p.id);
    onPlaceIdsChange(ids);
  }, [tab, bookmarkedPlaces, a.reviews, a.reports, onPlaceIdsChange]);

  /* ── 오버레이: 리뷰 수정 폼·탈퇴 확인 (엔트리 하나씩) ── */
  const closeReviewForm = useOverlayHistory(a.editing !== null, a.closeReviewForm);
  const [deleting, setDeleting] = useState(false);
  const clearDeleting = useCallback(() => {
    setDeleting(false);
  }, []);
  const closeDeleting = useOverlayHistory(deleting, clearDeleting);
  const openDeleting = () => {
    pushOverlayHistoryEntry();
    setDeleting(true);
  };

  const handleSignOut = () => {
    void signOut().then(onSignedOut, () => {
      onNotice("로그아웃하지 못했어요");
    });
  };
  const confirmDelete = async () => {
    await deleteAccount();
    closeDeleting();
    onAccountDeleted();
  };

  if (!session || session.provider !== "kakao") return null;

  return (
    <div className="pb-safe-bottom-or-3">
      <ProfileRow session={session} onSave={updateNickname} onNotice={onNotice} />
      <div className="px-5 pb-2">
        <Segmented label="내 활동" value={tab} options={ACTIVITY_TABS} onChange={onTabChange} />
      </div>

      {tab === "bookmarks" &&
        (bookmarkedPlaces.length === 0 ? (
          <EmptyState title="아직 찜한 곳이 없어요" description="가게 상세의 하트로 찜할 수 있어요" />
        ) : (
          <ul aria-label="찜한 곳" className="divide-y divide-line-hairline">
            {bookmarkedPlaces.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                now={now}
                origin={origin}
                selected={false}
                onSelect={onOpenPlace}
                trailing={
                  <button
                    type="button"
                    aria-label={`${place.name} 찜 해제`}
                    onClick={() => {
                      onToggleBookmark(place.id);
                    }}
                    className="press flex size-11 items-center justify-center text-brand-fg"
                  >
                    <span className="icon-[ci--heart-fill] size-5" aria-hidden="true" />
                  </button>
                }
              />
            ))}
          </ul>
        ))}

      {tab === "reviews" &&
        (statusView(a.reviewsStatus, a.retry, <ReviewsSkeleton />) ??
          (a.reviews.length === 0 ? (
            <EmptyState title="아직 남긴 리뷰가 없어요" />
          ) : (
            <ul aria-label="내 리뷰" className="divide-y divide-line-hairline px-5">
              {a.reviews.map((review) => (
                <ReviewRow
                  key={review.id}
                  review={review}
                  mine
                  title={review.placeName}
                  onOpen={() => {
                    onOpenPlace(review.placeId);
                  }}
                  onEdit={a.editReview}
                  onDelete={a.deleteReview}
                />
              ))}
            </ul>
          )))}

      {tab === "reports" &&
        (statusView(a.reportsStatus, a.retry, <ListSkeleton />) ??
          (a.reports.length === 0 ? (
            <EmptyState title="아직 제보한 가게가 없어요" description="아는 새우집을 제보해주세요" />
          ) : (
            <ul aria-label="내 제보" className="divide-y divide-line-hairline">
              {a.reports.map((place) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  now={now}
                  origin={origin}
                  selected={false}
                  onSelect={onOpenPlace}
                />
              ))}
            </ul>
          )))}

      <nav aria-label="계정" className="flex items-center justify-center px-5 pt-6">
        {[
          { label: "로그아웃", onClick: handleSignOut },
          { label: "탈퇴", onClick: openDeleting },
        ].map(({ label, onClick }, i) => (
          <Fragment key={label}>
            {i > 0 && <span aria-hidden="true" className="mx-3 h-3 w-px bg-line" />}
            <button
              type="button"
              onClick={onClick}
              className="press text-caption-l-regular text-fg-tertiary hit-44"
            >
              {label}
            </button>
          </Fragment>
        ))}
      </nav>

      {a.editing && (
        <ReviewForm
          placeId={a.editing.placeId}
          placeName={a.editing.placeName}
          now={now}
          initial={a.editing}
          onSaved={a.handleReviewSaved}
          onClose={closeReviewForm}
        />
      )}
      {deleting && <DeleteAccountSheet onConfirm={confirmDelete} onClose={closeDeleting} />}
    </div>
  );
}
