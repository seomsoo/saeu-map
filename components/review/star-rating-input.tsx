import { StarIcon } from "@/components/ui/icons/star-icon";
import { cx } from "@/lib/cx";

const STARS = [1, 2, 3, 4, 5] as const;

interface StarRatingInputProps {
  /** 0 = 아직 안 고름 */
  value: number;
  onChange: (rating: number) => void;
}

/**
 * 별점 입력 — 별 5개 버튼(각 44 히트, 아이콘 32), 채움 잉크·빈 별 line(화면 2 리뷰 행과 같은 별).
 * radiogroup: 별 하나가 곧 값이라 라디오 문법이 맞다(체크박스가 아니다).
 */
export function StarRatingInput({ value, onChange }: StarRatingInputProps) {
  return (
    <div role="radiogroup" aria-label="별점" className="-ml-1.5 flex">
      {STARS.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${String(n)}점`}
          onClick={() => {
            onChange(n);
          }}
          className="press flex size-11 items-center justify-center"
        >
          <StarIcon className={cx("size-8", n <= value ? "text-fg" : "text-line")} />
        </button>
      ))}
    </div>
  );
}
