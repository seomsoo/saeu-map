/**
 * 내용 필터 (spec 5 스팸 4겹 3) — 익명이 즉시 반영하는 자유 텍스트(영업시간·주소·메뉴명·후기·요청 내용)에 건다.
 * zod refine으로 폼과 서버 액션이 같은 판정을 쓴다. 과하게 막지 않는다: 링크와 노골적 욕설만.
 */

/** http(s)://, www., 도메인.tld/… — 한글 문장 안의 "가락동 600"은 안 걸린다(점 뒤 tld가 없다) */
const URL_PATTERN =
  /(?:https?:\/\/|www\.)|(?:^|[\s(])[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|kr|co|io|me|shop|site|xyz|info|biz|link|page|app)(?:[\s/)]|$)/iu;

/**
 * 노골적인 욕설만. 음식 이름·일상어를 잘못 잡지 않게 짧게 유지한다(재검토 조건: 실제 신고에서 반복되는 말).
 * DB에도 같은 목록이 있다(`private.banned_words()` — 카카오 닉네임 초기값은 서버 액션을 안 지난다). 고치면 새 마이그레이션으로
 * 그쪽도 고친다 — 어긋나면 `lib/__tests__/banned-words-sync.test.ts`가 깨진다.
 */
export const BANNED = [
  "시발", "씨발", "씨팔", "시팔", "ㅅㅂ", "ㅆㅂ", "병신", "ㅂㅅ", "개새끼", "개새키", "새끼야", "좆", "존나", "지랄",
  "느금", "니미", "엠창", "미친년", "미친놈", "창녀", "걸레년",
];

export function hasUrl(text: string): boolean {
  return URL_PATTERN.test(text);
}

/** 비교 전 정규화 — NFKC는 호환 자모(ㅅ U+3145)를 조합 자모로 접으므로 목록도 같은 길을 지나야 맞는다 */
function flatten(text: string): string {
  return text.normalize("NFKC").replaceAll(/[\s.\-_*]/gu, "").toLowerCase();
}
const BANNED_FLAT = BANNED.map(flatten);

export function hasBannedWord(text: string): boolean {
  const flat = flatten(text);
  return BANNED_FLAT.some((word) => flat.includes(word));
}

export const URL_MESSAGE = "링크는 넣을 수 없어요";
export const BANNED_MESSAGE = "쓸 수 없는 말이 있어요";

/** zod `.refine`용 — 둘 다 통과해야 true */
export function isCleanText(text: string): boolean {
  return !hasUrl(text) && !hasBannedWord(text);
}
