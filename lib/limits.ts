/**
 * 데이터 계층의 상수와 **zod 없는** 순수 검증 — 브라우저가 읽는 쪽이다.
 * zod 스키마(lib/schemas.ts)는 여기 상수로 만들어져 폼과 서버 액션이 같은 값을 본다.
 * 둘을 가른 이유(plan perf-diet A1, 2026-09-25): zod 4는 로케일 253개를 통째로 싣고 Turbopack이 못 털어 내
 * 클라이언트 JS의 22%(86KB gz)였다. 이 파일은 zod를 import하지 않는다 — 그게 규칙이다.
 * DB 쪽 상한(가게당 사진 10장·메뉴 5줄·후기 500자)은 supabase/migrations에도 같은 숫자로 박혀 있다 — 여기가 UI의 첫 방어선, DB가 마지막.
 */
import { hasBannedWord } from "./content-filter";

/** 한 가게에 붙일 수 있는 사진 수 (decisions 2026-09-03). 익명 업로드에 상한이 없으면 도배가 가장 싼 공격이다. */
export const MAX_PLACE_PHOTOS = 10;
/**
 * 이 거리(출구에서 직선 m) 밖이면 "역 근처"로 치지 않고 상세에서 역 줄을 지운다.
 * 800m ≈ 실제 도보 1km 남짓. DB에는 2km 안의 사실만 있고 컷은 코드가 갖는다.
 */
export const STATION_NEARBY_MAX_M = 800;
/** 업로드 한 장 상한 (security-reviewer 2026-09-08). 서버 재인코딩(Images 바인딩)이 진짜 방어선이고 이건 "말도 안 되는 파일"을 막는 문. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
/** 한 번에 올리는 합계 — 서버 액션 본문 상한(next.config 32mb) 안. 10장 × 10MB를 다 받으면 워커 메모리가 위험하다 */
export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
export const UPLOAD_TOO_LARGE_MESSAGE = "사진은 한 번에 30MB까지 올릴 수 있어요";
export const PHOTO_TOO_LARGE_MESSAGE = "사진 한 장은 10MB까지";
/** 제보 한 건의 메뉴 줄 수 — 구이 1(필수) + 회 1(선택) + 기타 3. 크롤 가게 중앙값 3줄·최대 5줄(2026-09-09). */
export const REPORT_MENU_MAX = 5;
/** 그중 기타 줄 상한. 회 토글과 무관하게 고정 — 남는 자리로 계산하면 6줄이 되는 구멍(2026-09-09). */
export const REPORT_EXTRA_MENU_MAX = REPORT_MENU_MAX - 2;
/** 메뉴 제안 한 번에 담을 수 있는 기존 줄 수 */
export const MAX_MENU_EDITS = 20;
/** 신고가 이만큼 쌓이면 관리자 화면에서 눈에 띄게 표시한다. 자동 숨김은 없다(decisions 2026-09-08·2026-09-10). */
export const REPORT_ATTENTION_COUNT = 3;
/** 관리자 목록이 한 번에 가져오는 최대 행 수 — SQL LIMIT. */
export const ADMIN_PAGE_SIZE = 100;

/** 메뉴 한 줄(spec 4.3-3) — 이름 길이·가격 범위·단위 표기 길이. 제보 3단계 폼과 `reportMenuSchema`가 같은 숫자를 본다. */
export const MENU_NAME_MAX = 30;
export const MENU_PRICE_MIN = 100;
/** 십만 원대까지(999,999원). 새우 한 판·1kg이 백만 원을 넘을 일이 없어 오타(0 하나 더)를 그 자리에서 막는다 (2026-09-08). */
export const MENU_PRICE_MAX = 999_999;
export const MENU_UNIT_RAW_MAX = 10;

/**
 * 닉네임 — 한글·영문·숫자 2~12자, 단어 사이 공백 하나 (spec 5).
 * NFKC로 정규화하고 문자 종류를 제한한다: 폭 없는 공백·방향 제어문자로 빈 이름이나 남 흉내를 못 만들게 (security-reviewer 2026-09-04).
 * 폼(profile-row)과 `nicknameSchema`(서버)가 **같은 두 함수**로 판정한다.
 */
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 12;
export const NICKNAME_PATTERN = /^[\p{L}\p{N}]+(?: [\p{L}\p{N}]+)*$/u;

export function normalizeNickname(raw: string): string {
  return raw.normalize("NFKC").trim();
}

/** `normalizeNickname`을 지난 값 기준 */
export function isValidNickname(normalized: string): boolean {
  return (
    normalized.length >= NICKNAME_MIN &&
    normalized.length <= NICKNAME_MAX &&
    NICKNAME_PATTERN.test(normalized) &&
    !hasBannedWord(normalized)
  );
}
