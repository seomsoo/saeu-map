/**
 * 시간 유틸 — 저장은 UTC ISO, 계산·표시는 Asia/Seoul 고정 (CLAUDE.md 컨벤션).
 *
 * Asia/Seoul은 DST 없이 UTC+9 고정이라 오프셋 상수로 달력일을 계산한다.
 * 렌더 중 `new Date()`를 직접 부르지 말고 서버가 내려준 `now`(ISO)를 인자로 넘긴다
 * (Workers는 UTC, 브라우저는 KST → 하이드레이션 불일치 방지).
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 6개월 무활동 판정 기준 일수 (≈ 6 × 30.5) */
export const INACTIVE_AFTER_DAYS = 183;

export type DateInput = string | number | Date;

export function toMs(input: DateInput): number {
  if (input instanceof Date) return input.getTime();
  if (typeof input === "number") return input;
  const ms = Date.parse(input);
  if (Number.isNaN(ms)) throw new Error(`Invalid date: ${input}`);
  return ms;
}

/** KST 기준 달력일 인덱스 (1970-01-01 KST = 0). 두 값의 차가 달력일 차이. */
export function kstDayIndex(input: DateInput): number {
  return Math.floor((toMs(input) + KST_OFFSET_MS) / DAY_MS);
}

/** KST 달력일 차이: b - a (일). */
export function daysBetweenKst(a: DateInput, b: DateInput): number {
  return kstDayIndex(b) - kstDayIndex(a);
}

/** KST 그날 00:00을 UTC ms로. */
export function startOfDayKst(input: DateInput): number {
  return kstDayIndex(input) * DAY_MS - KST_OFFSET_MS;
}

/** KST 이번 주 월요일 00:00을 UTC ms로. */
export function startOfWeekKst(input: DateInput): number {
  const day = kstDayIndex(input);
  // 1970-01-01은 목요일 → 요일(0=일) = (day + 4) % 7. 월요일 시작 오프셋 = (요일 + 6) % 7
  const weekday = (((day + 4) % 7) + 7) % 7;
  const mondayOffset = (weekday + 6) % 7;
  return (day - mondayOffset) * DAY_MS - KST_OFFSET_MS;
}

/** "YYYY-MM-DD"(KST 달력일)을 그날 KST 00:00의 UTC ISO로. 목 JSON의 date-only 값을 컨벤션에 맞출 때 사용. */
export function kstDateOnlyToIso(dateOnly: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) throw new Error(`Expected YYYY-MM-DD, got: ${dateOnly}`);
  const [, y, m, d] = match;
  return new Date(
    Date.UTC(Number(y), Number(m) - 1, Number(d)) - KST_OFFSET_MS,
  ).toISOString();
}

/** ISO에 일수를 더한 ISO. */
export function addDaysIso(iso: string, days: number): string {
  return new Date(toMs(iso) + days * DAY_MS).toISOString();
}

function kstParts(input: DateInput): { y: number; m: number; d: number } {
  const shifted = new Date(toMs(input) + KST_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() };
}

/** "2026.08.27" — KST 달력일. 절대 날짜는 전부 이 형식(연도 포함) — 짧은 "8.27"은 폐기했다. */
export function formatKstDate(input: DateInput): string {
  const { y, m, d } = kstParts(input);
  return `${String(y)}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")}`;
}

/** "3일 전" — 확인 시점만. KST 달력일 기준. 라벨과 문장("3일 전 확인됐어요")이 같이 쓴다. */
export function relativeCheckAgo(checkedAt: DateInput, now: DateInput): string {
  const days = Math.max(0, daysBetweenKst(checkedAt, now));
  if (days === 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

/** "○일 전 확인" 라벨. */
export function relativeCheckLabel(checkedAt: DateInput, now: DateInput): string {
  return `${relativeCheckAgo(checkedAt, now)} 확인`;
}

/** 6개월(183일) 이상 확인 없음 → 마커 투명도 낮춤 대상. */
export function isInactive(lastCheckedAt: DateInput, now: DateInput): boolean {
  return daysBetweenKst(lastCheckedAt, now) >= INACTIVE_AFTER_DAYS;
}

/** 등록 후 7일 이내 → "새로 제보됨" (spec 5 신규 7일 라벨). */
export function isWithinNewWindow(createdAt: DateInput, now: DateInput): boolean {
  const days = daysBetweenKst(createdAt, now);
  return days >= 0 && days < 7;
}
