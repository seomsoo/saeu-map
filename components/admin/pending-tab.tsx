"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { confirmPlace, getPlaces } from "@/lib/data";
import { isAllowedNaverPlaceUrl } from "@/lib/naver-links";
import { formatPrice, unitChipLabel } from "@/lib/places";
import { relativeCheckAgo } from "@/lib/time";
import type { Place } from "@/lib/types";
import { AdminCell, AdminEmpty, AdminListState, AdminRow, AdminTable } from "./admin-table";
import { useAdminList } from "./use-admin-list";

export const CONFIRMED_NOTICE = "확인했어요";
export const CONFIRM_FAILED_NOTICE = "확인을 저장하지 못했어요";

const COLUMNS = [
  { key: "name", label: "상호" },
  { key: "gu", label: "구" },
  { key: "menu", label: "대표 메뉴" },
  { key: "created", label: "등록", align: "right" as const },
  { key: "state", label: "상태", align: "right" as const },
  { key: "actions", label: "", align: "right" as const },
];

/** 대표 메뉴 한 줄 — 이름 + 단위 + 가격. 표에서도 카드에서도 같은 문장을 쓴다. */
function menuLine(place: Place): string {
  const menu = place.menus[0];
  if (!menu) return "메뉴 없음";
  const unit = unitChipLabel(menu);
  const price = menu.price === null ? "가격 미확인" : `${formatPrice(menu.price)}원`;
  return [menu.name, unit, price].filter(Boolean).join(" ");
}

/**
 * 사후 확인 탭 (design 화면 10-1) — 제보로 들어온 가게를 24시간 안에 훑는다(spec 5).
 * **[확인]은 배지만 찍는다**: 카드·마커의 "새로 제보됨"은 7일 타이머라 여기서 건드리지 않는다.
 * **이 탭만 모바일에서 쓴다** — 텔레그램 알림을 받은 자리에서 플레이스 링크를 30초 훑고 끝나야 한다.
 */
export function PendingTab({ now, onNotice }: { now: string; onNotice: (m: string) => void }) {
  const load = useCallback(async () => {
    const places = await getPlaces({}, now);
    return places
      .filter((p) => p.source === "report" && p.verifiedAt === undefined)
      .sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""));
  }, [now]);
  const { rows, status, retry, setRows } = useAdminList<Place>(load);
  const [pending, setPending] = useState<string | null>(null);
  /** 확인이 끝난 핀 — 목록에서 즉시 빼고(낙관) 실패하면 되돌린다 */
  const confirming = useRef<ReadonlySet<string>>(new Set());

  const confirm = (place: Place) => {
    if (pending !== null) return;
    setPending(place.id);
    confirming.current = new Set([...confirming.current, place.id]);
    const rest = rows.filter((p) => p.id !== place.id);
    setRows(rest);
    confirmPlace(place.id, now).then(
      () => {
        confirming.current = new Set([...confirming.current].filter((id) => id !== place.id));
        setPending(null);
        onNotice(CONFIRMED_NOTICE);
      },
      () => {
        // 실패 롤백 — 이미 들어와 있으면 중복을 만들지 않는다
        confirming.current = new Set([...confirming.current].filter((id) => id !== place.id));
        setPending(null);
        setRows(rest.some((p) => p.id === place.id) ? rest : [place, ...rest]);
        onNotice(CONFIRM_FAILED_NOTICE);
      },
    );
  };

  const state = AdminListState({ status, onRetry: retry });
  if (state !== null) return state;
  if (rows.length === 0) return <AdminEmpty title="확인할 새 제보가 없어요" />;

  return (
    <>
      {/* 데스크탑: 표 */}
      <div className="hidden lg:block">
        <AdminTable label="사후 확인" columns={COLUMNS}>
          {rows.map((place) => (
            <AdminRow key={place.id}>
              <AdminCell className="text-body-m-medium text-fg">{place.name}</AdminCell>
              <AdminCell className="text-fg-secondary">{place.gu}</AdminCell>
              <AdminCell className="text-fg-secondary">{menuLine(place)}</AdminCell>
              <AdminCell align="right" className="text-fg-tertiary tabular-nums">
                {relativeCheckAgo(place.createdAt ?? place.lastCheckedAt, now)}
              </AdminCell>
              <AdminCell align="right" className="text-fg-tertiary">
                검증 전
              </AdminCell>
              <AdminCell align="right">
                <PendingActions place={place} pending={pending === place.id} onConfirm={confirm} />
              </AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
      </div>

      {/* 모바일: 카드 — 같은 데이터·같은 훅, 자리만 바꾼다 */}
      <ul aria-label="사후 확인" className="space-y-2 lg:hidden">
        {rows.map((place) => (
          <li key={place.id} className="rounded-12 border border-line-hairline p-4">
            <p className="text-title-s-semibold text-fg">{place.name}</p>
            <p className="mt-0.5 text-caption-l-regular text-fg-tertiary">
              {place.gu} · {place.tags.includes("raw") ? "생새우회" : "새우구이"}
            </p>
            <p className="mt-2 text-body-m-regular text-fg-secondary">{menuLine(place)}</p>
            <p className="mt-1 text-caption-l-regular text-fg-tertiary tabular-nums">
              {relativeCheckAgo(place.createdAt ?? place.lastCheckedAt, now)} 등록
            </p>
            <div className="mt-3 flex gap-2">
              <PendingActions place={place} pending={pending === place.id} onConfirm={confirm} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** 표와 카드가 같은 액션을 쓴다 — [플레이스 열기]는 링크가 우리 화이트리스트를 통과할 때만 */
function PendingActions({
  place,
  pending,
  onConfirm,
}: {
  place: Place;
  pending: boolean;
  onConfirm: (place: Place) => void;
}) {
  const naver = place.naverPlaceUrl;
  return (
    <span className="inline-flex gap-2">
      {naver !== null && isAllowedNaverPlaceUrl(naver) && (
        <a
          href={naver}
          target="_blank"
          rel="noopener noreferrer"
          className="press inline-flex h-8 items-center rounded-8 border border-line px-3 text-caption-l-medium text-fg-secondary"
        >
          플레이스 열기 ↗
        </a>
      )}
      <Button
        variant="brand"
        size="sm"
        disabled={pending}
        onClick={() => {
          onConfirm(place);
        }}
      >
        {pending ? "확인 중…" : "확인"}
      </Button>
    </span>
  );
}
