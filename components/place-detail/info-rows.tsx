import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import type { NearestStation, Place } from "@/lib/types";
import { EditButton } from "./edit-button";
import { formatStationLine, numericLines } from "./station-line";
import { SubwayBadge } from "./subway-badge";

/**
 * 역 줄 — 노선색 배지 + 역명 + 출구 + 거리. 복사 버튼이 붙은 flex 행 **바깥**의 독립 문단이다:
 * 주소 컬럼 안에 넣으면 items-start가 복사 버튼을 이 줄 옆에 붙여 "역을 복사"로 읽힌다.
 * 배지는 aria-hidden이고 호선은 sr-only 텍스트로 읽힌다(색은 보조 신호). 숫자 없는 노선은 배지 없이 역명만.
 */
function StationRow({ station }: { station: NearestStation }) {
  const lines = numericLines(station.lines);
  return (
    <p className="flex items-center gap-1.5 text-body-m-regular text-fg">
      {lines.map((line) => (
        <SubwayBadge key={line} line={line} />
      ))}
      {lines.length > 0 && <span className="sr-only">{lines.map((l) => `${l}호선`).join(" ")}</span>}
      {/* truncate는 데이터가 오염됐을 때의 마지막 안전망 — 정상 데이터는 formatStationLine이 한 줄로 만든다 */}
      <span className="truncate tabular-nums">{formatStationLine(station)}</span>
    </p>
  );
}

interface PlaceInfoProps {
  place: Place;
  onCopy: () => void;
  onSuggestHours: () => void;
}

/**
 * 3. 정보 블록 — 최근접역(14 fg) / 도로명(14 fg-secondary) / 지번(12 fg-tertiary) / 영업시간(14 fg-secondary).
 * 행마다 아이콘 + 헤어라인으로 나누던 걸 합쳤다: 아이콘은 액션에만 쓰고, 위계는 회색 계층으로만 만든다.
 * **역 줄이 첫 줄이고 도로명은 한 단계 낮다** — 서울에서는 "어느 역 근처냐"가 도로명보다 먼저 읽힌다.
 * 역이 800m 밖이면(`nearestStation === null`) 그 줄을 안 그리고 주소만 남는다.
 * 간격이 곧 묶음이다: 역↔도로명 2(둘 다 "여기가 어디냐"), 도로명↔지번 2(같은 필드), 주소↔영업시간 12, 블록 아래 16.
 * 6이면 지번과의 2와 구분이 안 돼 영업시간이 주소 셋째 줄로 읽힌다.
 * 영업시간이 없을 때만 눈에 띄는 인라인 입구가 된다("영업 중" 판정은 하지 않는다).
 */
export function PlaceInfo({ place, onCopy, onSuggestHours }: PlaceInfoProps) {
  return (
    <div className="px-5 pb-4">
      {place.nearestStation && <StationRow station={place.nearestStation} />}
      <div className={cx("flex items-start gap-3", place.nearestStation && "mt-0.5")}>
        <div className="min-w-0 flex-1">
          <p className="text-body-m-regular text-fg-secondary">{place.addressRoad}</p>
          {place.addressJibun && (
            <p className="mt-0.5 text-caption-l-regular text-fg-tertiary">{place.addressJibun}</p>
          )}
        </div>
        <Button size="sm" onClick={onCopy} aria-label="주소 복사">
          복사
        </Button>
      </div>

      {place.hoursNote ? (
        <div className="mt-3 flex items-center gap-3">
          <p className="min-w-0 flex-1 text-body-m-regular text-fg-secondary">{place.hoursNote}</p>
          <EditButton label="영업시간 수정" onClick={onSuggestHours} />
        </div>
      ) : (
        <button
          type="button"
          onClick={onSuggestHours}
          className="press mt-3 flex w-full items-center gap-1 text-left"
        >
          <span className="min-w-0 flex-1 text-body-m-regular text-fg-secondary">
            영업시간을 알려주세요
          </span>
          <span
            className="icon-[ci--chevron-right] size-4 shrink-0 text-fg-placeholder"
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  );
}
