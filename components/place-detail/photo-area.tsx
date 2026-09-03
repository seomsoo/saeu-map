import Image from "next/image";
import { MAX_PLACE_PHOTOS } from "@/lib/data";
import type { Place } from "@/lib/types";
import { NaverPhotoLink } from "./naver-photo-link";

interface PhotoAreaProps {
  place: Place;
  /** 사진이 없을 때 올리기 행 **아래**에 붙는 네이버 링크(화이트리스트 통과분만). 사진이 있으면 리뷰 섹션 끝으로 간다. */
  naverUrl: string | null;
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
      <span className="text-caption-l-medium">사진</span>
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
 * **사진이 없으면 스트립 자리를 비우지 않고 56px 한 줄로 줄인다**(decisions 2026-09-03). 목 50곳 중 47곳이
 * 무사진이라 이 상태가 기본값이다 — 기본값에 128px 회색 타일을 두면 시트 맨 위가 늘 빈 상자다.
 * 올리기(행 전체)와 네이버 보기(아래 캡션 링크)를 겹치지 않는 두 표적으로 떼어 놓는다: 한 행 안에
 * 두 액션이 겹쳐 있으면 오른쪽 chevron이 어느 쪽을 가리키는지 알 수 없다.
 */
export function PhotoArea({ place, naverUrl, onUploadPhoto, onOpenPhoto }: PhotoAreaProps) {
  if (place.photos.length === 0) {
    return (
      <div className="px-5 pt-1 pb-3">
        <button
          type="button"
          onClick={onUploadPhoto}
          className="press flex h-14 w-full items-center gap-2.5 rounded-12 bg-bg-sunken px-4 text-left"
        >
          <span className="icon-[ci--camera] size-5 shrink-0 text-fg-tertiary" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-body-m-medium text-fg">첫 사진을 올려주세요</span>
          <span
            className="icon-[ci--chevron-right] size-4 shrink-0 text-fg-placeholder"
            aria-hidden="true"
          />
        </button>
        {naverUrl && <NaverPhotoLink href={naverUrl} className="mt-2" />}
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
