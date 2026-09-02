import { cx } from "@/lib/cx";

/** "네이버에서 사진 보기 ↗" — 외부 링크(새 탭, noopener). href는 isAllowedNaverPlaceUrl을 통과한 값만 넘긴다. */
export function NaverPhotoLink({ href, className }: { href: string; className?: string | undefined }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cx(
        "inline-flex items-center gap-0.5 text-caption-l-regular text-fg-tertiary",
        className,
      )}
    >
      네이버에서 사진 보기
      <span className="icon-[ci--external-link] size-3" aria-hidden="true" />
    </a>
  );
}
