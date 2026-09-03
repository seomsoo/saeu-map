/**
 * 값이 있는 필드의 수정 입구 — 옅은 캡션 텍스트 하나로 통일한다(spec 4.2 "수정 입구는 필드마다").
 * 값이 없을 때는 이걸 쓰지 않는다: 그때는 필드 자리 자체가 눈에 띄는 인라인 입구가 된다.
 */
export function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="press shrink-0 text-caption-l-medium text-fg-tertiary hit-44"
    >
      수정
    </button>
  );
}
