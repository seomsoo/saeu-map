import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  daysBetweenKst,
  formatKstDate,
  formatKstShortDate,
  isInactive,
  isWithinNewWindow,
  kstDateOnlyToIso,
  kstDayIndex,
  relativeCheckLabel,
  startOfDayKst,
  startOfWeekKst,
} from "../time";

const DAY = 24 * 60 * 60 * 1000;

describe("KST 달력일", () => {
  it("자정 경계는 KST 기준으로 나뉜다 (UTC 아님)", () => {
    // 2026-09-01 00:10 KST == 2026-08-31 15:10 UTC
    expect(kstDayIndex("2026-08-31T15:10:00Z")).toBe(
      kstDayIndex("2026-09-01T08:00:00+09:00"),
    );
    expect(
      daysBetweenKst("2026-08-31T23:50:00+09:00", "2026-09-01T00:10:00+09:00"),
    ).toBe(1);
  });

  it("startOfDayKst는 KST 00:00의 UTC 시각", () => {
    expect(new Date(startOfDayKst("2026-09-01T10:00:00+09:00")).toISOString()).toBe(
      "2026-08-31T15:00:00.000Z",
    );
  });

  it("주 시작은 월요일 00:00 KST", () => {
    // 2026-09-01은 화요일 → 월요일 8/31
    expect(new Date(startOfWeekKst("2026-09-01T10:00:00+09:00")).toISOString()).toBe(
      "2026-08-30T15:00:00.000Z",
    );
    // 일요일 9/6도 같은 주
    expect(new Date(startOfWeekKst("2026-09-06T23:00:00+09:00")).toISOString()).toBe(
      "2026-08-30T15:00:00.000Z",
    );
    // 월요일 00:00 정각은 그 주의 시작
    expect(new Date(startOfWeekKst("2026-08-31T00:00:00+09:00")).toISOString()).toBe(
      "2026-08-30T15:00:00.000Z",
    );
  });

  it("date-only는 KST 달력일로 읽어 UTC ISO로 낸다", () => {
    expect(kstDateOnlyToIso("2026-08-25")).toBe("2026-08-24T15:00:00.000Z");
    expect(() => kstDateOnlyToIso("2026/08/25")).toThrow();
  });

  it("addDaysIso는 시각을 유지한 채 일수를 더한다", () => {
    expect(addDaysIso("2026-08-28T12:00:00.000Z", 3)).toBe(
      "2026-08-31T12:00:00.000Z",
    );
  });
});

describe("relativeCheckLabel", () => {
  const now = "2026-09-01T12:00:00+09:00";
  const ago = (days: number) => new Date(Date.parse(now) - days * DAY).toISOString();

  it.each([
    [0, "오늘 확인"],
    [1, "어제 확인"],
    [6, "6일 전 확인"],
    [7, "1주 전 확인"],
    [29, "4주 전 확인"],
    [30, "1개월 전 확인"],
    [200, "6개월 전 확인"],
    [400, "1년 전 확인"],
  ])("%i일 전 → %s", (days, label) => {
    expect(relativeCheckLabel(ago(days), now)).toBe(label);
  });

  it("자정 직전 확인은 다음날 새벽에 '어제'", () => {
    expect(
      relativeCheckLabel("2026-08-31T23:59:00+09:00", "2026-09-01T00:01:00+09:00"),
    ).toBe("어제 확인");
  });

  it("시계 오차로 미래면 오늘로 취급", () => {
    expect(relativeCheckLabel(ago(-1), now)).toBe("오늘 확인");
  });
});

describe("isInactive / isWithinNewWindow", () => {
  const now = "2026-09-01T12:00:00+09:00";
  const ago = (days: number) => new Date(Date.parse(now) - days * DAY).toISOString();

  it("183일부터 무활동", () => {
    expect(isInactive(ago(182), now)).toBe(false);
    expect(isInactive(ago(183), now)).toBe(true);
  });

  it("등록 7일 이내만 신규", () => {
    expect(isWithinNewWindow(ago(0), now)).toBe(true);
    expect(isWithinNewWindow(ago(6), now)).toBe(true);
    expect(isWithinNewWindow(ago(7), now)).toBe(false);
    expect(isWithinNewWindow(ago(-1), now)).toBe(false);
  });
});

describe("formatKstDate / formatKstShortDate", () => {
  it("KST 달력일로 표기 (UTC 자정 직전은 KST 다음 날)", () => {
    // 2026-08-26 23:30 UTC == 2026-08-27 08:30 KST
    expect(formatKstDate("2026-08-26T23:30:00Z")).toBe("2026.08.27");
    expect(formatKstShortDate("2026-08-26T23:30:00Z")).toBe("8.27");
  });
  it("월·일 두 자리는 긴 형식만 0 채움", () => {
    expect(formatKstDate("2026-11-05T12:00:00+09:00")).toBe("2026.11.05");
    expect(formatKstShortDate("2026-11-05T12:00:00+09:00")).toBe("11.5");
  });
});
