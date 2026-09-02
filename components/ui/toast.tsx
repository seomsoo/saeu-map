/** 토스트 — 짧은 안내 한 줄(bg-toast). 표시·타이머는 부모(showNotice)가 관리한다. */
export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="mx-auto rounded-12 bg-toast px-4 py-3 text-body-m-regular text-fg-on-brand"
    >
      {message}
    </p>
  );
}
