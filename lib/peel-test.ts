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
 * 유형 캐릭터 (2026-09-09 투입). 화면은 webp 320(15KB), **OG 카드는 PNG 400** — satori가 webp를 못 읽을 수
 * 있어 두 벌이다(`{slug}-og.png`). 폴백은 두지 않는다: 파일이 없으면 조용히 다른 그림이 나가는 게 더 나쁘다.
 */
export const TYPE_ART: Record<PeelSlug, string> = {
  jipge: "/peel-test/jipge.webp",
  sonjil: "/peel-test/sonjil.webp",
  wansik: "/peel-test/wansik.webp",
  chojang: "/peel-test/chojang.webp",
};

/**
 * 문항 일러스트 (2026-09-09 투입). 문항 id → 파일. 없는 id는 그림 없이 그린다 —
 * 폴백으로 아무 그림이나 넣으면 문항과 어긋난 장면이 나간다.
 */
export const QUESTION_ART: Record<string, string> = {
  q1: "/peel-test/q1.webp",
  q2: "/peel-test/q2.webp",
  q3: "/peel-test/q3.webp",
  q4: "/peel-test/q4.webp",
  q5: "/peel-test/q5.webp",
  q6: "/peel-test/q6.webp",
};

/** OG 카드용 파일명 — `lib/og/art.ts`가 `public/` 아래에서 읽어 data URI로 인라인한다 */
export function typeOgArtFile(slug: PeelSlug): string {
  return `peel-test/${slug}-og.png`;
}

/* ── 경로 ─────────────────────────────────────────────────────────────────
 * `lib/seo.ts`가 아니라 여기 있는 이유: seo는 서버 전용(t3-env)이고 이 경로들은
 * 결과 화면의 공유 버튼(클라이언트)도 쓴다.
 * ────────────────────────────────────────────────────────────────────────── */

export function peelTypePath(slug: PeelSlug): string {
  return `/test/${slug}`;
}

/** 궁합 초대 링크 — 이걸 공유하면 친구가 풀고 궁합으로 떨어진다(decisions 2026-09-09) */
export function peelInvitePath(slug: PeelSlug): string {
  return `/test/with/${slug}`;
}

export function peelMatchPath(a: PeelSlug, b: PeelSlug): string {
  return `/test/${a}/${b}`;
}

export function isPeelSlug(value: string): value is PeelSlug {
  return (PEEL_SLUGS as readonly string[]).includes(value);
}

/**
 * URL 세그먼트 → 슬러그. 그 밖(오타·다른 문자)은 null → 라우트가 404를 낸다.
 * **`decodeURIComponent`를 부르지 않는다**: Next가 이미 디코드한 `params`가 오므로 한 번 더 풀면
 * `/test/%256aipge`가 `jipge`로 통과한다(security-reviewer 2026-09-09). 슬러그는 ASCII 4개뿐이라 그대로 대조한다.
 */
export function decodePeelSlug(raw: string): PeelSlug | null {
  return isPeelSlug(raw) ? raw : null;
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
