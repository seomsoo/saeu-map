import type { PeelMatchKey, PeelQuestion, PeelRole, PeelSlug, PeelType, PlaceTag } from "./types";

/**
 * 까주기 테스트의 순수 규칙 (spec 8 · design 화면 11). 콘텐츠(문항·유형·궁합 카피)는
 * `lib/mock/peel-test.json`이 갖고 여기 있는 건 **구조**뿐이다 — 카피를 다듬어도 이 파일은 안 바뀐다.
 * 데이터 읽기(추천 가게)는 규칙 1대로 `lib/data.ts` 경유.
 */

/** URL 슬러그 4개. 구 슬러그와 같은 ASCII 로마자 — 퍼센트 인코딩된 한글은 공유 링크에서 깨져 보인다. */
export const PEEL_SLUGS = ["jipge", "sonjil", "wansik", "chojang"] as const;

/** 결과에 붙이는 추천 가게 수 (design 화면 11-3·5). */
export const PEEL_PLACE_COUNT = 3;

/**
 * 축 조합 → 유형. JSON의 `role`·`taste`가 이 표와 어긋나면 `peel-test.test.ts`가 깨진다
 * (카피를 고치다 축을 잘못 옮기는 걸 막는 자리다).
 */
const SLUG_BY_AXES: Record<PeelRole, Record<PlaceTag, PeelSlug>> = {
  peel: { grill: "jipge", raw: "sonjil" },
  served: { grill: "wansik", raw: "chojang" },
};

/**
 * 유형 아트. **캐릭터 4장이 오면 이 4줄만 바꾼다**(decisions 2026-09-09) — 그때까지는 넷 다 같은 새우고
 * 화면에서 기울기로만 갈린다. 파일이 없을 때의 폴백은 두지 않는다: 조용히 다른 그림이 나가는 게 더 나쁘다.
 */
export const TYPE_ART: Record<PeelSlug, string> = {
  jipge: "/shrimp.webp",
  sonjil: "/shrimp.webp",
  wansik: "/shrimp.webp",
  chojang: "/shrimp.webp",
};

export function isPeelSlug(value: string): value is PeelSlug {
  return (PEEL_SLUGS as readonly string[]).includes(value);
}

/** URL 세그먼트 → 슬러그. 그 밖(오타·인코딩 깨짐)은 null → 라우트가 404를 낸다. */
export function decodePeelSlug(raw: string): PeelSlug | null {
  try {
    const value = decodeURIComponent(raw);
    return isPeelSlug(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * 채점 — 축마다 어느 쪽이 많았는지만 본다. 축당 문항이 3개(홀수)라 **동점이 없다**.
 * `answers[i]`는 `questions[i]`의 선택지 인덱스(0이 앞쪽 값)이고, 길이가 다르면 답한 만큼만 센다.
 */
export function scoreAnswers(
  questions: readonly PeelQuestion[],
  answers: readonly number[],
): PeelSlug {
  let role = 0;
  let taste = 0;
  questions.forEach((question, i) => {
    const answer = answers[i];
    if (answer === undefined) return;
    // 0 → 앞쪽(까준다·구이) 한 표, 1 → 뒤쪽(받는다·회) 한 표
    const vote = answer === 0 ? 1 : -1;
    if (question.axis === "role") role += vote;
    else taste += vote;
  });
  return SLUG_BY_AXES[role > 0 ? "peel" : "served"][taste > 0 ? "grill" : "raw"];
}

/**
 * 궁합 — 두 유형의 축을 비교하면 관계가 4종으로 떨어진다(decisions 2026-09-09).
 * 역할이 갈리면 잘 맞고(취향까지 같으면 R1), 역할이 같으면 둘 다 까주거나(R3) 둘 다 기다린다(R4).
 */
export function matchKey(
  a: Pick<PeelType, "role" | "taste">,
  b: Pick<PeelType, "role" | "taste">,
): PeelMatchKey {
  if (a.role !== b.role) return a.taste === b.taste ? "R1" : "R2";
  return a.role === "peel" ? "R3" : "R4";
}
