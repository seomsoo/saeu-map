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
 * 20px 노선색 원. **색은 보조 신호라 배지는 aria-hidden**이고, 호선은 줄 앞 `sr-only` 텍스트가 읽힌다
 * (9호선 #A49D87 위 흰 숫자는 대비 2.4:1 — 색만으로 정보를 주면 안 된다).
 */
export function SubwayBadge({ line }: { line: string }) {
  const bg = SUBWAY_BG[line];
  if (!bg) return null;
  return (
    <span
      aria-hidden="true"
      className={`${bg} flex size-5 shrink-0 items-center justify-center rounded-max text-caption-l-semibold text-fg-on-brand tabular-nums`}
    >
      {line}
    </span>
  );
}
