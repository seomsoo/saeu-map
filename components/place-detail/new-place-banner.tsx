/** 변형 (a) 신규 핀(7일 이내) — 상호 아래 공지 행. 화면 1 이벤트 행 문법(아이콘 원 + 두 줄), 닫기 없음, 레드 틴트 배경. */
export function NewPlaceBanner() {
  return (
    <div className="flex items-center gap-3 bg-brand-tint px-5 py-3" role="note">
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
