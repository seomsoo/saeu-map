import type { ReactNode } from "react";
import type { LoadStatus } from "@/components/activity/use-activity";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cx } from "@/lib/cx";

export interface AdminColumn {
  key: string;
  label: string;
  /** 숫자·날짜는 오른쪽 tabular (design 화면 10) */
  align?: "right";
  className?: string;
}

/**
 * 관리자 표 (design 화면 10) — 헤더 행 + 데이터 행, 행 사이 헤어라인, hover에 가라앉은 배경.
 * **띠·줄무늬·카드 그림자를 쓰지 않는다**: 표는 밀도가 값이라 장식이 읽기를 방해한다.
 * 좁은 화면에서는 표가 가로 스크롤된다 — 안내 문구를 쓰지 않는다(스크롤은 보이면 안다).
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
        <thead>
          <tr className="border-b border-line-hairline">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cx(
                  "px-3 py-2 text-caption-l-regular font-normal text-fg-tertiary",
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

/** 데이터 행 — 높이 52, hover에 가라앉은 배경. */
export function AdminRow({ children }: { children: ReactNode }) {
  return (
    <tr className="h-13 border-b border-line-hairline transition-colors hover:bg-bg-sunken">
      {children}
    </tr>
  );
}

/** 셀. 액션 열은 `align="right"`로 오른쪽 끝에 붙인다. */
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
    <td className={cx("px-3 align-middle", align === "right" ? "text-right" : "", className)}>
      {children}
    </td>
  );
}

/**
 * 로딩·에러를 표 대신 그린다. **정상·빈 상태는 호출자가 그린다** — 빈 상태의 문구가 탭마다 다르고,
 * 표 헤더를 남길지도 탭이 정한다.
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
      <div className="space-y-2 pt-2" aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-13" />
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
