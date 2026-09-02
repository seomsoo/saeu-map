import Image from "next/image";
import type { Place } from "@/lib/types";
import { NaverPhotoLink } from "./naver-photo-link";

interface PhotoAreaProps {
  place: Place;
  /** 사진이 없을 때 행 둘째 줄에 넣을 네이버 링크(화이트리스트 통과분만). 사진이 있으면 리뷰 섹션 끝으로 간다. */
  naverUrl: string | null;
  onUploadPhoto: () => void;
}

/**
 * 1. 사진 — 있으면 시트 폭 160px 타일(카드·마커와 같은 thumbnailUrl).
 * 없으면 큰 빈 타일 대신 입력 행: 카메라 타일 + "첫 사진을 올려주세요" / 네이버 링크 + › (design 화면 2, decisions 2026-09-02).
 */
export function PhotoArea({ place, naverUrl, onUploadPhoto }: PhotoAreaProps) {
  if (place.thumbnailUrl) {
    return (
      <div className="px-5 pt-1">
        {/* images.unoptimized — 업로드 시 리사이즈본을 쓴다 */}
        <Image
          src={place.thumbnailUrl}
          alt={`${place.name} 사진`}
          width={350}
          height={160}
          draggable={false}
          className="h-40 w-full rounded-12 bg-bg-sunken object-cover"
        />
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-3 border-b h-14 border-line-hairline pr-4 pl-5">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-max bg-bg-sunken text-fg-tertiary"
        aria-hidden="true"
      >
        <span className="icon-[ci--camera] size-4" />
      </span>
      <span className="min-w-0 flex-1">
        {/* 행 전체가 탭 대상 (after로 늘림). 네이버 링크만 위(z-1)로 빼서 따로 눌린다. */}
        <button
          type="button"
          onClick={onUploadPhoto}
          className="block w-full text-left text-body-m-medium text-fg after:absolute after:inset-0 after:content-['']"
        >
          첫 사진을 올려주세요
        </button>
        {naverUrl && <NaverPhotoLink href={naverUrl} className="relative z-1" />}
      </span>
      <span className="icon-[ci--chevron-right] size-4 shrink-0 text-fg-placeholder" aria-hidden="true" />
    </div>
  );
}
