"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef } from "react";

interface PhotoPickerProps {
  files: readonly File[];
  max: number;
  onChange: (files: File[]) => void;
}

/**
 * 4단계 사진 — 기기 사진 선택기(이미지만, 여러 장) + 88px 미리보기 타일 (design 화면 3-4).
 * 맨 앞 ＋ 타일은 화면 2 스트립의 ＋ 타일 문법, 미리보기는 오른쪽 위 제거 ✕. max가 차면 ＋ 타일이 사라진다.
 * 미리보기 URL(createObjectURL)은 목록이 바뀌거나 언마운트되면 바로 revoke한다.
 */
export function PhotoPicker({ files, max, onChange }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  // 목록이 바뀔 때만 새 URL을 만들고, 이전 목록의 URL은 effect 정리에서 revoke한다
  const urls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(
    () => () => {
      for (const url of urls) URL.revokeObjectURL(url);
    },
    [urls],
  );

  const pick = (list: FileList | null) => {
    if (!list) return;
    const images = Array.from(list).filter((file) => file.type.startsWith("image/"));
    onChange([...files, ...images].slice(0, max));
    if (inputRef.current) inputRef.current.value = ""; // 같은 파일을 다시 고를 수 있게
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="사진 파일"
        onChange={(e) => {
          pick(e.target.files);
        }}
      />
      <ul aria-label="고른 사진" className="no-scrollbar flex gap-2 overflow-x-auto py-1">
        {files.length < max && (
          <li className="shrink-0">
            <button
              type="button"
              aria-label="사진 추가"
              onClick={() => inputRef.current?.click()}
              className="press flex size-22 flex-col items-center justify-center gap-1 rounded-12 bg-bg-sunken text-fg-secondary"
            >
              <span className="icon-[ci--add-plus] size-5" aria-hidden="true" />
              <span className="text-caption-l-medium">사진 추가</span>
            </button>
          </li>
        )}
        {files.map((file, i) => (
          <li key={`${file.name}-${String(file.size)}-${String(i)}`} className="relative shrink-0">
            {urls[i] && (
              <Image
                src={urls[i]}
                alt={`고른 사진 ${String(i + 1)}`}
                width={88}
                height={88}
                unoptimized
                draggable={false}
                className="size-22 rounded-12 object-cover"
              />
            )}
            <button
              type="button"
              aria-label={`사진 ${String(i + 1)} 제거`}
              onClick={() => {
                onChange(files.filter((_, j) => j !== i));
              }}
              className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-max bg-bg-immersive-raised text-fg-on-immersive"
            >
              <span className="icon-[ci--close-sm] size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
