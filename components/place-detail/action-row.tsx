import { Button } from "@/components/ui/button";

interface ActionRowProps {
  bookmarked: boolean;
  onRoute: () => void;
  onShare: () => void;
  onToggleBookmark: () => void;
}

/** 6. 버튼 줄 — [길찾기](레드 채움, 폭 2) [공유] [♡ 찜](아웃라인, 켜면 틴트 + 하트 채움). 48px, 라운드 12.
 * 확인 버튼이 기여 블록으로 내려가면서 길찾기가 이 화면의 유일한 채운 레드가 됐다. */
export function ActionRow({ bookmarked, onRoute, onShare, onToggleBookmark }: ActionRowProps) {
  return (
    <div className="grid grid-cols-4 gap-2 px-5 pt-1 pb-4">
      <Button variant="brand" size="xl" className="col-span-2" onClick={onRoute}>
        <span className="icon-[ci--navigation] size-4" aria-hidden="true" />
        길찾기
      </Button>
      <Button variant="outline" size="xl" onClick={onShare}>
        <span className="icon-[ci--share-outline] size-4" aria-hidden="true" />
        공유
      </Button>
      <Button
        variant={bookmarked ? "tint" : "outline"}
        size="xl"
        aria-pressed={bookmarked}
        onClick={onToggleBookmark}
      >
        <span
          className={bookmarked ? "icon-[ci--heart-fill] size-4" : "icon-[ci--heart-outline] size-4"}
          aria-hidden="true"
        />
        찜
      </Button>
    </div>
  );
}
