/**
 * 변형 (a) 신규 핀(7일 이내) — 상호 아래 공지 행. 화면 1 이벤트 행 문법(아이콘 원 + 두 줄), 닫기 없음, 레드 틴트 배경.
 * 아래 16은 이 행이 갖는다 — 정보 블록엔 위 패딩이 없어서(공지 없이도 상호 블록 pb-5가 여백이다)
 * 여기서 안 주면 틴트 띠 바닥에 주소가 그대로 붙는다.
 */
export function NewPlaceBanner() {
  return (
    <div className="mb-4 flex items-center gap-3 bg-brand-tint px-5 py-3" role="note">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-max bg-bg text-brand-fg"
        aria-hidden="true"
      >
        <span className="icon-[ci--map-pin] size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-body-m-semibold text-brand-fg">새로 제보된 곳이에요</span>
        <span className="block text-caption-l-regular text-fg-secondary">
          아직 검증 전이에요. 다녀오셨다면 확인해주세요
        </span>
      </span>
    </div>
  );
}
