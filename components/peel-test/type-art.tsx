import Image from "next/image";
import { cx } from "@/lib/cx";
import { TYPE_ART } from "@/lib/peel-test";
import type { PeelSlug } from "@/lib/types";

/**
 * 유형 아트 (design 화면 11). **캐릭터 4장이 오기 전까지는 넷 다 같은 새우**라 기울기로만 갈린다
 * (decisions 2026-09-09) — 그림이 오면 `TYPE_ART` 4줄만 바뀌고 이 컴포넌트는 그대로다.
 */
const TILT: Record<PeelSlug, string> = {
  jipge: "-rotate-12",
  sonjil: "rotate-6",
  wansik: "rotate-12",
  chojang: "-rotate-6",
};

const SIZE = { md: "size-25", lg: "size-30" } as const;

export function TypeArt({
  slug,
  size = "lg",
  className,
}: {
  slug: PeelSlug;
  size?: keyof typeof SIZE;
  className?: string | undefined;
}) {
  return (
    <div
      className={cx(
        "flex shrink-0 items-center justify-center rounded-max bg-bg-sunken",
        SIZE[size],
        className,
      )}
    >
      {/* priority를 주지 않는다: 궁합 화면은 같은 파일을 두 번 그려서 preload가 하나 남고
          "preloaded but not used" 경고가 뜬다(2026-09-09 콘솔 실측). 138px webp라 얻는 것도 없다. */}
      <Image
        src={TYPE_ART[slug]}
        alt=""
        width={138}
        height={138}
        draggable={false}
        className={cx("size-3/5 object-contain", TILT[slug])}
      />
    </div>
  );
}

/** 표지·"결과 만드는 중"이 쓰는 유형 없는 새우 한 마리. 같은 원 안이라 화면이 뛰지 않는다. */
export function ShrimpArt({ className }: { className?: string | undefined }) {
  return (
    <div
      className={cx(
        "flex size-30 shrink-0 items-center justify-center rounded-max bg-bg-sunken",
        className,
      )}
    >
      <Image
        src="/shrimp.webp"
        alt=""
        width={138}
        height={138}
        priority
        draggable={false}
        className="size-3/5 -rotate-12 object-contain"
      />
    </div>
  );
}
