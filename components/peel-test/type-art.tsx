import Image from "next/image";
import { cx } from "@/lib/cx";
import { TYPE_ART } from "@/lib/peel-test";
import type { PeelSlug } from "@/lib/types";

/**
 * 유형 캐릭터 (design 화면 11). 네 장이 각자 장면을 갖는다(집게·접시·받아먹기·초장) — 구도가 이미 잡혀 있어
 * **기울이지 않는다**(2026-09-09 에셋 투입 전에는 같은 새우를 회전으로 갈랐다).
 *
 * 원 바탕은 회색(`bg-bg-sunken`)이 아니라 **브랜드 틴트**다: 결과가 주인공인 화면이라 정보형 회색이면
 * 밋밋하고, 틴트는 활성 칩·잘 맞는 유형 카드와 같은 문법이라 새 색을 만들지 않는다(2026-09-09).
 */
/** sm 44(표지의 유형 미리보기 4개) · md 100(궁합에 둘이 나란히) · lg 160(결과의 주인공, design 화면 11-3) */
const SIZE = { sm: "size-11", md: "size-25", lg: "size-40" } as const;

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
        "flex shrink-0 items-center justify-center rounded-max bg-brand-tint",
        SIZE[size],
        className,
      )}
    >
      {/* priority를 주지 않는다: 궁합 화면은 같은 파일을 두 번 그려서 preload가 하나 남고
          "preloaded but not used" 경고가 뜬다(2026-09-09 콘솔 실측). 138px webp라 얻는 것도 없다. */}
      <Image
        src={TYPE_ART[slug]}
        alt=""
        width={320}
        height={320}
        draggable={false}
        className="size-4/5 object-contain"
      />
    </div>
  );
}

/**
 * 표지·"결과 만드는 중"이 쓰는 유형 없는 새우 한 마리. 같은 원 안이라 화면이 뛰지 않는다.
 * `bob`을 주면 **새우만** 통통 뛴다(기다리는 자리) — 원까지 흔들면 자리가 출렁인다.
 */
export function ShrimpArt({
  bob = false,
  className,
}: {
  bob?: boolean;
  className?: string | undefined;
}) {
  return (
    <div
      className={cx(
        "flex size-30 shrink-0 items-center justify-center rounded-max bg-brand-tint",
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
        className={cx("size-3/5 object-contain", bob ? "saeu-bob" : "-rotate-12")}
      />
    </div>
  );
}
