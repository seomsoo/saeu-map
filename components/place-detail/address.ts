/** 법정동 이름 — "가락동"·"성수동1가"·"종로1가"·"공덕리". 구·군은 "구"·"군"으로 끝나 걸리지 않는다. */
const DONG = /(동|가|리|읍|면)\d*가?$/;

/** 번지 — "600"·"922-14"·"산 12-3"의 번호 부분. */
const LOT = /^산?\d+(-\d+)?$/;

/**
 * "서울 송파구 가락동 600" → "가락동 600".
 * 지번은 도로명 바로 아래 줄이라 시·구 접두어가 두 번 읽힌다 — 그래서 동·번지만 남긴다
 * (design.md 항목 3의 "마포동 123-4"가 원래 표기다).
 * 뒤에 붙은 건물명·층("… 400-1 금강리빙스텔 2층 팔팔수산")은 지번이 아니라 크롤링 잔재라 같이 자른다.
 * 동이나 번지를 못 찾으면 **원문 그대로** 둔다 — 모르는 형식을 잘라 틀린 주소를 만드는 것보다 길게 두는 게 낫다.
 */
export function shortJibun(jibun: string): string {
  const parts = jibun.split(/\s+/).filter(Boolean);
  const dong = parts.findIndex((p) => DONG.test(p));
  if (dong === -1) return jibun;
  const lot = parts.findIndex((p, i) => i > dong && LOT.test(p));
  return parts.slice(dong, lot === -1 ? undefined : lot + 1).join(" ");
}
