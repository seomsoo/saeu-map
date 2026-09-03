/**
 * Tailwind는 보간한 클래스명(`bg-subway-${n}`)을 emit하지 못한다 — 리터럴 매핑이어야 한다.
 * 값은 공식 노선색(globals.css `--color-subway-*`). 숫자 호선만 있으니 9줄로 닫힌다.
 */
const SUBWAY_BG: Record<string, string> = {
  "1": "bg-subway-1",
  "2": "bg-subway-2",
  "3": "bg-subway-3",
  "4": "bg-subway-4",
  "5": "bg-subway-5",
  "6": "bg-subway-6",
  "7": "bg-subway-7",
  "8": "bg-subway-8",
  "9": "bg-subway-9",
};

/**
 * 16px 노선색 원 — 옆 14px 글자의 행 높이(19.6px)보다 작아야 배지가 버튼처럼 읽히지 않는다.
 * 20px은 행을 꽉 채워서 탭할 수 있는 것처럼 보였다(2026-09-03 축소).
 * **색은 보조 신호라 배지는 aria-hidden**이고, 호선은 역 줄 버튼의 `aria-label`이 문장으로 읽어 준다
 * (9호선 #A49D87 위 흰 숫자는 대비 2.4:1 — 색만으로 정보를 주면 안 된다).
 */
export function SubwayBadge({ line }: { line: string }) {
  const bg = SUBWAY_BG[line];
  if (!bg) return null;
  return (
    <span
      aria-hidden="true"
      className={`${bg} flex size-4 shrink-0 items-center justify-center rounded-max text-caption-l-semibold text-fg-on-brand tabular-nums`}
    >
      {line}
    </span>
  );
}
