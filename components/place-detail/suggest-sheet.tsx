"use client";

import { useEffect, useRef, useState } from "react";
import {
  EMPTY_MENU_DRAFT,
  clearMenuErrors,
  validateMenuDraft,
  type MenuDraft,
  type MenuDraftErrors,
} from "@/components/report/menu-draft";
import { MenuFields, menuToDraft } from "@/components/report/menu-fields";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ModalSheet, closeEnclosingDialog } from "@/components/ui/modal-sheet";
import { TextField } from "@/components/ui/text-field";
import { submitSuggestion, type SuggestionInput } from "@/lib/data";
import { sideChips } from "@/lib/places";
import type { Place, Sides, SuggestField } from "@/lib/types";

export const SUGGEST_FAILED_MESSAGE = "보내지 못했어요. 다시 시도해주세요";

const TITLES: Record<SuggestField, string> = {
  hours: "영업시간을 알려주세요",
  address: "주소를 알려주세요",
  menus: "메뉴와 가격을 알려주세요",
  sides: "사이드를 알려주세요",
};

/** 제보 4단계 `hoursNote`·수정 제안 스키마와 같은 상한 — 같은 값을 두 곳에서 다르게 받지 않는다 */
const HOURS_MAX = 80;
const ADDRESS_MAX = 60;
const HOURS_ERROR = "영업시간을 적어주세요";
const ADDRESS_ERROR = "도로명 주소를 적어주세요";

interface SuggestSheetProps {
  place: Place;
  field: SuggestField;
  /** 접수 성공 — 부모가 시트를 닫고 토스트를 낸다 */
  onSubmitted: () => void;
  /** 딤·Escape·✕·뒤로가기 */
  onClose: () => void;
}

/**
 * 값 폼 시트 (design 화면 2 "상세의 쓰기 표면") — 영업시간·주소·대표 메뉴·사이드의 수정 제안.
 * **값이 있으면 채워 두고**(수정) 없으면 빈 채다. 제출해도 화면 값은 그대로다 — 승인 큐 경유라
 * (spec 4.2) 낙관적 업데이트를 하지 않고, 그 사실을 **누르기 전에** "확인 후 반영돼요"로 말한다.
 * 실패는 시트 안 오류 한 줄 + 입력 유지(닫아 버리면 무엇이 실패했는지 사라진다).
 */
export function SuggestSheet({ place, field, onSubmitted, onClose }: SuggestSheetProps) {
  const [hours, setHours] = useState(place.hoursNote ?? "");
  const [address, setAddress] = useState(place.addressRoad ?? "");
  const [sides, setSides] = useState<Sides>(place.sides);
  /*
   * 메뉴는 제보와 같은 순서다: 첫 줄이 구이, 둘째 줄이 회(submitReport가 그 순서로 넣는다).
   * 시드 가게에 메뉴가 더 많아도 제안은 **대표 메뉴 한두 줄**이라(spec 4.2-5) 앞 두 줄만 채운다.
   */
  const [grill, setGrill] = useState<MenuDraft>(() => menuToDraft(place.menus[0]));
  const [raw, setRaw] = useState<MenuDraft>(() => menuToDraft(place.menus[1]));
  const [rawToo, setRawToo] = useState(place.menus.length > 1);
  const [menuErrors, setMenuErrors] = useState<{ grill: MenuDraftErrors; raw: MenuDraftErrors }>({
    grill: {},
    raw: {},
  });
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** 화면 값 → 제출 입력. 검증에 걸리면 오류만 세우고 null. */
  const build = (): SuggestionInput | null => {
    switch (field) {
      case "hours": {
        const hoursNote = hours.trim();
        if (hoursNote.length === 0) {
          setFieldError(HOURS_ERROR);
          return null;
        }
        return { field, placeId: place.id, hoursNote };
      }
      case "address": {
        const addressRoad = address.trim();
        if (addressRoad.length < 2) {
          setFieldError(ADDRESS_ERROR);
          return null;
        }
        return { field, placeId: place.id, addressRoad };
      }
      case "menus": {
        const grillResult = validateMenuDraft(grill, false);
        const rawResult = rawToo ? validateMenuDraft(raw, true) : null;
        setMenuErrors({ grill: grillResult.errors ?? {}, raw: rawResult?.errors ?? {} });
        if (grillResult.menu === null || rawResult?.menu === null) return null;
        const menus = rawResult ? [grillResult.menu, rawResult.menu] : [grillResult.menu];
        return { field, placeId: place.id, menus };
      }
      case "sides":
        return { field, placeId: place.id, sides };
    }
  };

  const submit = () => {
    if (pending) return;
    const input = build();
    if (input === null) return;
    setPending(true);
    setError(null);
    submitSuggestion(input).then(
      () => {
        if (!alive.current) return;
        setPending(false);
        onSubmitted();
      },
      () => {
        if (!alive.current) return;
        setPending(false);
        setError(SUGGEST_FAILED_MESSAGE);
      },
    );
  };

  /**
   * 값이 있던 자리는 [보내기], 비어 있던 자리는 [알려주기] — 입구 카피와 같은 말을 쓴다.
   * 사이드는 boolean 셋이라 "없는 상태"가 없다(전부 꺼짐도 값이다) → 늘 [보내기]다.
   */
  const hadValue =
    field === "hours"
      ? place.hoursNote !== null
      : field === "address"
        ? place.addressRoad !== null
        : field === "menus"
          ? place.menus.length > 0
          : true;

  return (
    <ModalSheet form label={`${place.name} ${TITLES[field]}`} onClose={onClose}>
      <div className="flex items-center justify-between pr-2 pl-5">
        <h2 className="text-body-m-medium text-fg">{TITLES[field]}</h2>
        <button
          ref={closeRef}
          type="button"
          onClick={() => {
            closeEnclosingDialog(closeRef.current);
          }}
          aria-label="닫기"
          className="press flex size-11 items-center justify-center"
        >
          <span className="icon-[ci--close-md] size-5 text-fg-secondary" aria-hidden="true" />
        </button>
      </div>

      <div className="saeu-modal-body px-5 pt-1 pb-3">
        {field === "hours" && (
          <TextField
            label="영업시간"
            placeholder="예: 23:00 라스트오더, 월 휴무"
            maxLength={HOURS_MAX}
            value={hours}
            onChange={(e) => {
              setHours(e.target.value);
              setFieldError(null);
            }}
            error={fieldError}
            autoComplete="off"
          />
        )}
        {field === "address" && (
          /* 자동완성이 없는 건 의도다 — 지오코더 응답은 저장할 수 없고(규칙 2) 사용자가 친 값만 남긴다 */
          <TextField
            label="도로명 주소"
            placeholder="예: 서울 마포구 마포대로12길 34"
            maxLength={ADDRESS_MAX}
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setFieldError(null);
            }}
            error={fieldError}
            autoComplete="off"
          />
        )}
        {field === "menus" && (
          <MenuFields
            grill={grill}
            raw={raw}
            rawToo={rawToo}
            errors={menuErrors}
            onChangeGrill={(changes) => {
              setMenuErrors((prev) => ({ ...prev, grill: clearMenuErrors(prev.grill, changes) }));
              setGrill((prev) => ({ ...prev, ...changes }));
            }}
            onChangeRaw={(changes) => {
              setMenuErrors((prev) => ({ ...prev, raw: clearMenuErrors(prev.raw, changes) }));
              setRaw((prev) => ({ ...prev, ...changes }));
            }}
            onRawTooChange={(next) => {
              setRawToo(next);
              // 껐다 켜면 빈 줄부터 — 지웠다고 생각한 값이 되살아나지 않는다
              if (!next) setRaw(EMPTY_MENU_DRAFT);
            }}
          />
        )}
        {field === "sides" && (
          /* 보던 것과 고치는 것이 같은 생김새다 — 화면 2-6의 칩 그대로, 누르면 켜고 끈다 */
          <ul aria-label="사이드 고르기" className="flex flex-wrap gap-1.5">
            {sideChips(sides).map((chip) => (
              <li key={chip.key}>
                <button
                  type="button"
                  aria-pressed={chip.active}
                  onClick={() => {
                    setSides((prev) => ({ ...prev, [chip.key]: !prev[chip.key] }));
                  }}
                  className="press hit-44"
                >
                  <Chip size="sm" tone={chip.active ? "outline" : "disabled"}>
                    {chip.active && <span className="icon-[ci--check] size-3.5" aria-hidden="true" />}
                    {chip.label}
                  </Chip>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-5 pb-2">
        {/* 스크롤되는 본문 밖이다 — 메뉴처럼 긴 입력에서는 본문 안에 두면 CTA만 보인 채 눌리고,
            "왜 값이 안 바뀌지?"는 누른 뒤에 말하면 늦다(design 화면 2 값 폼 시트) */}
        <p className="mb-2 text-caption-l-regular text-fg-tertiary">확인 후 반영돼요</p>
        {error && (
          <p role="alert" className="mb-2 text-caption-l-regular text-brand-fg">
            {error}
          </p>
        )}
        <Button variant="brand" size="xl" className="w-full" disabled={pending} onClick={submit}>
          {pending ? "보내는 중…" : hadValue ? "보내기" : "알려주기"}
        </Button>
      </div>
    </ModalSheet>
  );
}
