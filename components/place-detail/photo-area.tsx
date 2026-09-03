import Image from "next/image";
import { MAX_PLACE_PHOTOS } from "@/lib/data";
import type { Place } from "@/lib/types";

interface PhotoAreaProps {
  place: Place;
  onUploadPhoto: () => void;
  /** 사진 탭 → 전체 화면 뷰어 (design 화면 2 변형 (e)) */
  onOpenPhoto: (index: number) => void;
}

/** 176×128 — 4:3에 가장 가까운 토큰 폭. 정사각 112로는 접시가 잘려 음식이 안 보였다(decisions 2026-09-03). */
const PHOTO_TILE = "h-32 w-44 shrink-0 rounded-12 bg-bg-sunken";

/** 가라앉은 타일 안 ＋ — 접근 가능한 이름은 감싸는 버튼이 갖는다. */
function AddTile() {
  return (
    <span
      aria-hidden="true"
      className={`${PHOTO_TILE} flex flex-col items-center justify-center gap-1 text-fg-tertiary`}
    >
      <span className="icon-[ci--add-plus] size-6" />
      <span className="text-caption-l-medium">사진 추가</span>
    </span>
  );
}

/** 10장이 다 찬 자리. 사진 타일과 같은 크기라 행 높이·스크롤 길이가 그대로다 — 버튼이 아니다. */
function FullTile() {
  return (
    <span
      className={`${PHOTO_TILE} flex items-center justify-center px-4 text-center text-caption-l-regular text-fg-tertiary`}
    >
      {MAX_PLACE_PHOTOS}장까지 올릴 수 있어요
    </span>
  );
}

/**
 * 1. 사진 — 가로 스크롤 스트립(176×128). 사진을 탭하면 전체 화면 뷰어가 열린다.
 * 마지막 칸은 ＋ 타일이라 사진이 있어도 옆에 더 올리고, 10장이 차면 그 자리가 안내 타일로 바뀐다.
 * touch-pan-x: 시트 본문이 pan-y라 가로 스와이프가 시트 드래그로 새지 않게 스트립에서 명시한다.
 *
 * **사진이 없으면 전폭 빈 상태 블록**(같은 높이 128, decisions 2026-09-03 3차). 176 타일 하나만 두면
 * 오른쪽에 담기지 않은 흰 공간이 남아 미완성으로 읽힌다 — 표적이 하나뿐이니 폭을 다 쓴다.
 * 카피가 두 줄인 이유: 여기는 버튼 라벨이 아니라 빈 상태다. 상태 한 줄 + 요청 한 줄이 그 문법이고,
 * 스트립 안 ＋ 타일은 그대로 액션 라벨("사진 추가")을 쓴다. 네이버 링크는 사진 유무와 무관하게 리뷰 끝.
 */
export function PhotoArea({ place, onUploadPhoto, onOpenPhoto }: PhotoAreaProps) {
  if (place.photos.length === 0) {
    return (
      <div className="px-5 pt-1 pb-3">
        {/* 접근 이름은 보이는 두 줄 그대로 — aria-label로 덮으면 읽는 말과 보이는 말이 달라진다 */}
        <button
          type="button"
          onClick={onUploadPhoto}
          className="press flex h-32 w-full flex-col items-center justify-center rounded-12 bg-bg-sunken"
        >
          {/* 아이콘은 떼고(8) 두 줄은 붙인다(2) — 상태와 요청은 한 덩어리다 */}
          <span className="icon-[ci--add-plus] mb-2 size-6 text-fg-tertiary" aria-hidden="true" />
          <span className="text-body-m-medium text-fg">아직 사진이 없어요</span>
          <span className="mt-0.5 text-caption-l-regular text-fg-tertiary">첫 새우를 올려주세요</span>
        </button>
      </div>
    );
  }

  return (
    <ul
      aria-label={`${place.name} 사진`}
      data-pan-x
      className="no-scrollbar flex touch-pan-x gap-2 overflow-x-auto px-5 pt-1 pb-3"
    >
      {place.photos.map((photo, i) => (
        <li key={photo.id} className="shrink-0">
          <button
            type="button"
            onClick={() => {
              onOpenPhoto(i);
            }}
            className="press block"
            aria-label={`${place.name} 사진 ${String(i + 1)} 크게 보기`}
          >
            {/* 이름은 버튼이 갖는다(alt="") — images.unoptimized, 업로드 시 리사이즈본을 쓴다 */}
            <Image
              src={photo.url}
              alt=""
              width={176}
              height={128}
              draggable={false}
              className={`${PHOTO_TILE} object-cover`}
            />
          </button>
        </li>
      ))}
      <li className="shrink-0">
        {place.photos.length >= MAX_PLACE_PHOTOS ? (
          <FullTile />
        ) : (
          <button type="button" onClick={onUploadPhoto} className="press block" aria-label="사진 추가">
            <AddTile />
          </button>
        )}
      </li>
    </ul>
  );
}
