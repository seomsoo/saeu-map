import Image from "next/image";
import { MAX_PLACE_PHOTOS } from "@/lib/data";
import type { Place } from "@/lib/types";
import { NaverPhotoLink } from "./naver-photo-link";

interface PhotoAreaProps {
  place: Place;
  /** 사진이 없을 때 타일 오른쪽에 넣을 네이버 링크(화이트리스트 통과분만). 사진이 있으면 리뷰 섹션 끝으로 간다. */
  naverUrl: string | null;
  onUploadPhoto: () => void;
  /** 사진 탭 → 전체 화면 뷰어 (design 화면 2 변형 (e)) */
  onOpenPhoto: (index: number) => void;
}

/** 176×128 — 4:3에 가장 가까운 토큰 폭. 정사각 112로는 접시가 잘려 음식이 안 보였다(decisions 2026-09-03). */
const TILE = "h-32 w-44 shrink-0 rounded-12 bg-bg-sunken";

/** 가라앉은 타일 안 ＋ — 접근 가능한 이름은 감싸는 버튼이 갖는다. */
function AddTile() {
  return (
    <span
      aria-hidden="true"
      className={`${TILE} flex flex-col items-center justify-center gap-1 text-fg-tertiary`}
    >
      <span className="icon-[ci--add-plus] size-6" />
      <span className="text-caption-l-medium">사진</span>
    </span>
  );
}

/** 10장이 다 찬 자리. ＋ 타일과 같은 크기라 행 높이·스크롤 길이가 그대로다 — 버튼이 아니다. */
function FullTile() {
  return (
    <span
      className={`${TILE} flex items-center justify-center px-4 text-center text-caption-l-regular text-fg-tertiary`}
    >
      {MAX_PLACE_PHOTOS}장까지 올릴 수 있어요
    </span>
  );
}

/**
 * 1. 사진 — 가로 스크롤 스트립(176×128). 사진을 탭하면 전체 화면 뷰어가 열린다.
 * 마지막 칸은 ＋ 타일이라 사진이 있어도 옆에 더 올리고, 10장이 차면 그 자리가 안내 타일로 바뀐다.
 * 사진이 하나도 없으면 같은 크기의 ＋ 타일 하나 + 오른쪽 안내("첫 사진을 올려주세요" / 네이버 링크)로,
 * 있을 때와 행 높이가 같아 사진 유무로 아래 내용이 밀리지 않는다.
 * touch-pan-x: 시트 본문이 pan-y라 가로 스와이프가 시트 드래그로 새지 않게 스트립에서 명시한다.
 */
export function PhotoArea({ place, naverUrl, onUploadPhoto, onOpenPhoto }: PhotoAreaProps) {
  if (place.photos.length === 0) {
    return (
      <div className="relative flex items-center gap-3 px-5 pt-1 pb-3">
        <AddTile />
        <span className="min-w-0 flex-1">
          {/* 행 전체가 탭 대상 (after로 늘림). 네이버 링크만 위(z-1)로 빼서 따로 눌린다. */}
          <button
            type="button"
            onClick={onUploadPhoto}
            className="block w-full text-left text-body-m-medium text-fg after:absolute after:inset-0 after:content-['']"
          >
            첫 사진을 올려주세요
          </button>
          {naverUrl && <NaverPhotoLink href={naverUrl} className="relative z-1 mt-1.5" />}
        </span>
        <span className="icon-[ci--chevron-right] size-4 shrink-0 text-fg-placeholder" aria-hidden="true" />
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
              className={`${TILE} object-cover`}
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
