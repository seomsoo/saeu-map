import type { ReactNode } from "react";
import type { LoadStatus } from "@/components/activity/use-activity";
import { Button } from "@/components/ui/button";
import { Chip, ChipButton } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cx } from "@/lib/cx";
import { formatKstDate } from "@/lib/time";

export interface AdminColumn {
  key: string;
  label: string;
  /** 숫자·날짜는 오른쪽 tabular (design 화면 10) */
  align?: "right";
  className?: string;
}

/**
 * 관리자 표 (design 화면 10). 운영 도구의 표는 **밀도가 값**이라 장식을 걷는다:
 * 띠·줄무늬·카드 그림자 없음, 행 44px, 헤어라인 하나. 대신 읽는 걸 돕는 세 가지를 둔다 —
 * **머무는 행 강조**(hover) · **헤더 고정**(길어져도 열 이름이 안 사라진다) · **액션은 머물 때만**.
 * 좁은 화면에서는 가로 스크롤이다(안내 문구를 쓰지 않는다 — 스크롤은 보이면 안다).
 */
export function AdminTable({
  label,
  columns,
  children,
}: {
  label: string;
  columns: readonly AdminColumn[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table aria-label={label} className="w-full min-w-160 border-collapse text-body-m-regular">
        <thead className="sticky top-0 z-1 bg-bg">
          <tr className="border-b border-line">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cx(
                  "px-3 pb-2 text-caption-l-medium font-normal text-fg-tertiary",
                  c.align === "right" ? "text-right" : "text-left",
                  c.className,
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/**
 * 데이터 행 — `group`이라 액션 열이 hover·포커스에 반응한다. 높이는 내용이 정하되 최소 44.
 * 키보드만 쓰는 사람에게도 액션이 보여야 하므로 `focus-within`을 같이 건다.
 */
export function AdminRow({ children }: { children: ReactNode }) {
  return (
    <tr className="group border-b border-line-hairline transition-colors hover:bg-bg-sunken focus-within:bg-bg-sunken">
      {children}
    </tr>
  );
}

export function AdminCell({
  children,
  align,
  className,
}: {
  children: ReactNode;
  align?: "right";
  className?: string;
}) {
  return (
    <td
      className={cx(
        "h-11 px-3 align-middle",
        align === "right" ? "text-right" : "",
        className,
      )}
    >
      {children}
    </td>
  );
}

/**
 * 액션 열 — **행에 머물거나 포커스가 들어왔을 때만** 진해진다. 항상 선명하면 표가 버튼밭이 되어
 * 정작 읽어야 할 값이 안 읽힌다(리니어·버셀 표의 규칙). 숨기지 않고 흐리게만 두는 이유는
 * 터치 기기엔 hover가 없어서다 — 눌리기는 늘 눌린다.
 *
 * **여기 들어가는 버튼은 전부 아웃라인이다.** 채운 레드를 행마다 두면 화면에 레드가 행 수만큼 생겨
 * "화면당 채운 레드 한 곳"이 깨지고, 흐리게 만들면 채운 색이 탁해져 글자가 안 읽힌다(2026-09-08 실측).
 * 위험한 것(삭제)만 `danger`로 — 그것도 채우지 않고 색으로만 말한다.
 */
export function AdminActions({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex gap-2 opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
      {children}
    </span>
  );
}

/** 상태 한 칸 — 글자만 두면 훑을 때 안 걸린다. 형태(pill)로 말한다. */
export function AdminStatus({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: "muted" | "active" | "subtle";
}) {
  return (
    <Chip size="xs" tone={tone}>
      {label}
    </Chip>
  );
}

/** 상대 시각 + 절대 시각 툴팁 — "3일 전"만으로는 언제인지 못 짚는다. */
export function AdminWhen({ at, relative }: { at: string; relative: string }) {
  return (
    <time dateTime={at} title={formatKstDate(at)} className="text-fg-tertiary tabular-nums">
      {relative}
    </time>
  );
}

/** 탭 맨 위 한 줄 — 지금 몇 건을 보고 있는지. 표를 세지 않아도 되게. */
export function AdminCount({ children }: { children: ReactNode }) {
  return <p className="pb-2 text-caption-l-regular text-fg-tertiary">{children}</p>;
}

/**
 * 요약 한 칸 — 큰 숫자 하나 + 라벨, 그 아래 비교값 한 줄. 운영자가 화면을 열자마자 보는 값이라
 * **오늘만 두면 많은지 적은지 모른다** — 최근 7일을 같이 놓아야 오늘이 읽힌다.
 */
export function AdminStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="rounded-12 border border-line-hairline px-4 py-3">
      <p className="text-caption-l-regular text-fg-tertiary">{label}</p>
      <p className="mt-1 text-title-s-semibold text-fg tabular-nums">{value}</p>
      {sub !== undefined && (
        <p className="mt-0.5 text-caption-l-regular text-fg-tertiary tabular-nums">{sub}</p>
      )}
    </div>
  );
}

/** 기간 칩이 고를 수 있는 값 — `null`은 전체. */
export type AdminPeriod = 7 | 30 | null;

const PERIODS: { value: AdminPeriod; label: string }[] = [
  { value: 7, label: "최근 7일" },
  { value: 30, label: "최근 30일" },
  { value: null, label: "전체" },
];

/**
 * 기간 칩 — 이력·신고는 계속 쌓이는 목록이라 **언제 것까지 볼지**를 고를 수 있어야 한다.
 * 상한(`ADMIN_PAGE_SIZE`)과 짝이다: 기간으로 좁히고, 그래도 넘치면 [더 보기]로 늘린다.
 */
export function AdminPeriodChips({
  value,
  onChange,
}: {
  value: AdminPeriod;
  onChange: (next: AdminPeriod) => void;
}) {
  return (
    <ul aria-label="기간" className="flex gap-1.5 pb-3">
      {PERIODS.map((p) => (
        <li key={String(p.value)}>
          <ChipButton
            size="sm"
            pressed={value === p.value}
            onClick={() => {
              onChange(p.value);
            }}
          >
            {p.label}
          </ChipButton>
        </li>
      ))}
    </ul>
  );
}

/**
 * [더 보기] — 받아온 수가 상한과 같으면 더 있을 수 있다는 뜻이다(정확히 같을 때 한 번 헛걸음하는 건
 * 감수한다 — 총 개수를 세려고 쿼리를 하나 더 던지는 게 더 비싸다).
 */
export function AdminMore({ shown, limit, onMore }: { shown: number; limit: number; onMore: () => void }) {
  if (shown < limit) return null;
  return (
    <div className="flex justify-center pt-4">
      <Button variant="outline" size="sm" onClick={onMore}>
        더 보기
      </Button>
    </div>
  );
}

/**
 * 로딩·에러를 표 대신 그린다. **정상·빈 상태는 호출자가 그린다** — 빈 상태의 문구가 탭마다 다르다.
 */
export function AdminListState({
  status,
  onRetry,
}: {
  status: LoadStatus;
  onRetry: () => void;
}): ReactNode {
  if (status === "loading") {
    return (
      <div className="space-y-1.5 pt-2" aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-11" />
        ))}
      </div>
    );
  }
  if (status === "error") return <ErrorState title="불러오지 못했어요" onRetry={onRetry} />;
  return null;
}

/** 탭마다 문구가 다른 빈 상태 — 표 헤더 없이 한 줄만. */
export function AdminEmpty({ title }: { title: string }) {
  return <EmptyState title={title} className="py-12" />;
}
