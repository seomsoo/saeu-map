"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import type { Place } from "@/lib/types";
import { shortJibun } from "./address";
import { EditButton } from "./edit-button";
import { formatStationLine, numericLines } from "./station-line";
import { SubwayBadge } from "./subway-badge";

/**
 * 위치 그룹 — 핀 아이콘 열 하나에 [역 줄(헤더)] + [주소(펼침)]이 걸린다.
 *
 * **역 줄이 disclosure 헤더다.** 접힌 기본 상태에선 "가락시장역 2-1번출구에서 90m" 한 줄만 보이고,
 * 눌러야 도로명·지번·[복사]가 핀 아래로 들여쓰기돼 나온다 — 서울에서 먼저 읽히는 값은 역이고,
 * 주소는 길찾기·복사할 때만 필요한 값이라 상시 두 줄을 먹을 이유가 없다(캐치테이블 상세와 같은 문법).
 * **역이 없으면(800m 밖) 헤더가 없으니 chevron도 없고 주소가 그냥 보인다** — 헤더와 본문이 같은
 * disclosure는 만들지 않는다.
 *
 * 배지는 aria-hidden이고 호선은 버튼 `aria-label`이 문장으로 읽어 준다(색은 보조 신호).
 * sr-only 조각으로 두면 접근 이름 계산이 조각을 공백 없이 이어 "9호선송파나루역"으로 읽었다.
 * 숫자 없는 노선은 배지 없이 역명만.
 * 라벨의 truncate는 마지막 안전망 — 정상 데이터는 formatStationLine이 예산 안에서 한 줄로 만든다.
 */
function LocationGroup({ place, onCopy }: { place: Place; onCopy: () => void }) {
  const station = place.nearestStation;
  const [open, setOpen] = useState(false);
  const lines = station === null ? [] : numericLines(station.lines);
  const label = station === null ? "" : formatStationLine(station);

  return (
    <div className="flex gap-1.5">
      {/* 아이콘 열 — 14px 행 높이(19.6) 안에서 광학 정렬(mt-0.5). 값 행의 인덱스라 aria-hidden */}
      <span
        className="icon-[ci--location] mt-0.5 size-4 shrink-0 text-fg-tertiary"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        {station !== null && (
          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v);
            }}
            aria-expanded={open}
            aria-label={[...lines.map((l) => `${l}호선`), label].join(" ")}
            className="press hit-44 flex w-full items-center gap-1.5 text-left"
          >
            {lines.map((line) => (
              <SubwayBadge key={line} line={line} />
            ))}
            <span className="truncate text-body-m-regular text-fg tabular-nums">{label}</span>
            <span
              className={cx(
                "icon-[ci--chevron-down] size-4 shrink-0 text-fg-placeholder transition-transform",
                open && "rotate-180",
              )}
              aria-hidden="true"
            />
          </button>
        )}
        {(station === null || open) && (
          <div className={cx("flex items-start gap-3", station !== null && "mt-0.5")}>
            <div className="min-w-0 flex-1">
              <p className="text-body-m-regular text-fg-secondary">{place.addressRoad}</p>
              {place.addressJibun !== null && (
                <p className="mt-0.5 text-caption-l-regular text-fg-tertiary">
                  {shortJibun(place.addressJibun)}
                </p>
              )}
            </div>
            <Button size="sm" onClick={onCopy} aria-label="주소 복사">
              복사
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface PlaceInfoProps {
  place: Place;
  onCopy: () => void;
  onSuggestHours: () => void;
}

/**
 * 3. 정보 블록 — 위치 그룹(역 줄 14 fg + 접히는 도로명 14 fg-secondary / 지번 12 fg-tertiary)과
 * 영업시간 그룹(14 fg-secondary) 두 덩어리. 그룹마다 16px 아이콘 열(핀·시계)이 앞에 서고
 * 행 사이 보더는 없다 — 아이콘은 장식이 아니라 **행의 종류를 가리키는 인덱스**이고,
 * 접힌 주소가 핀 아래로 들여쓰기되게 하는 정렬 기준이다("아이콘은 액션에만"의 예외 — decisions 2026-09-03).
 * **역 줄이 첫 줄이고 도로명은 한 단계 낮다** — 서울에서는 "어느 역 근처냐"가 도로명보다 먼저 읽힌다.
 * 간격이 곧 묶음이다: 역↔도로명 2(둘 다 "여기가 어디냐"), 도로명↔지번 2(같은 필드),
 * 위치↔영업시간 12, 블록 아래 16. 6이면 지번과의 2와 구분이 안 돼 영업시간이 주소 셋째 줄로 읽힌다.
 * 영업시간이 없을 때만 눈에 띄는 인라인 입구가 된다("영업 중" 판정은 하지 않는다).
 */
export function PlaceInfo({ place, onCopy, onSuggestHours }: PlaceInfoProps) {
  return (
    <div className="px-5 pb-4">
      <LocationGroup place={place} onCopy={onCopy} />

      {place.hoursNote ? (
        <div className="mt-3 flex gap-1.5">
          <span
            className="icon-[ci--clock] mt-0.5 size-4 shrink-0 text-fg-tertiary"
            aria-hidden="true"
          />
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <p className="min-w-0 flex-1 text-body-m-regular text-fg-secondary">{place.hoursNote}</p>
            <EditButton label="영업시간 수정" onClick={onSuggestHours} />
          </div>
        </div>
      ) : (
        // 값이 없을 때는 아이콘까지 한 표적 — 시계만 남기고 옆을 눌러도 안 열리면 이상하다
        <button
          type="button"
          onClick={onSuggestHours}
          className="press mt-3 flex w-full gap-1.5 text-left"
        >
          <span
            className="icon-[ci--clock] mt-0.5 size-4 shrink-0 text-fg-tertiary"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 text-body-m-regular text-fg-secondary">
            영업시간을 알려주세요
          </span>
          <span
            className="icon-[ci--chevron-right] mt-0.5 size-4 shrink-0 text-fg-placeholder"
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  );
}
