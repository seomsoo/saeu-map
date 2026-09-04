import type { Session } from "@/lib/types";

/**
 * 검색 바 오른쪽 끝 — 내 활동 입구 (design 화면 5). 익명 = 사람 아이콘, 로그인 = 28px 틴트 원 + 닉네임 첫 글자.
 * 카카오 프로필 사진은 외부 도메인이라 쓰지 않는다(규칙 3). 세션을 아직 모르면(null) 익명으로 그린다.
 */
export function ProfileButton({
  session,
  onClick,
}: {
  session: Session | null;
  onClick: () => void;
}) {
  const initial =
    session?.provider === "kakao" ? (session.nickname?.trim().charAt(0) ?? "") : "";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="내 활동"
      className="press -mr-2 flex size-10 shrink-0 items-center justify-center"
    >
      {initial ? (
        <span
          aria-hidden="true"
          className="flex size-7 items-center justify-center rounded-max bg-brand-tint text-caption-l-semibold text-brand-fg"
        >
          {initial}
        </span>
      ) : (
        <span className="icon-[ci--user] size-6 text-fg-secondary" aria-hidden="true" />
      )}
    </button>
  );
}
