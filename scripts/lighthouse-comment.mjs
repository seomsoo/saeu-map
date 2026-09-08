/**
 * Lighthouse 리포트 → PR 코멘트 마크다운 (roadmap 백로그, decisions 2026-09-07).
 * 지금까지는 아티팩트를 내려받아야만 점수가 보였다 — PR에서 바로 보이게 한다.
 *
 * 입력: `.lighthouseci/manifest.json`(lhci `upload.target: filesystem`)과 같은 폴더의 리포트 JSON.
 * manifest의 `jsonPath`는 리포트를 만든 잡의 **절대 경로**라 아티팩트를 받은 쪽에서는 없다 —
 * 파일명만 떼어 이 폴더에서 찾는다.
 * 출력: 표 마크다운을 stdout으로. 갱신 대상을 찾는 표식(HTML 주석)이 첫 줄이다.
 */
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";

const DIR = process.argv[2] ?? ".lighthouseci";
/** 갱신 대상을 찾는 표식 — 워크플로는 파일 첫 줄을 그대로 읽어 쓴다(같은 문자열을 두 번 적지 않는다) */
const MARKER = "<!-- lighthouse-report -->";

/** lighthouserc.json의 예산과 같아야 한다 — 표에서 통과 여부를 읽을 수 있게 */
const LCP_BUDGET_MS = 12_000;
const PERF_WARN_MIN = 0.5;

const manifest = JSON.parse(readFileSync(join(DIR, "manifest.json"), "utf8"));
/** numberOfRuns가 여러 번이라 URL마다 대표 실행(중앙값)만 쓴다 */
const runs = manifest.filter((run) => run.isRepresentativeRun);

const rows = runs.map((run) => {
  const report = JSON.parse(readFileSync(join(DIR, basename(run.jsonPath)), "utf8"));
  const lcp = report.audits["largest-contentful-paint"];
  const lcpMs = lcp?.numericValue ?? Number.NaN;
  const score = Math.round((run.summary.performance ?? 0) * 100);
  const path = new URL(run.url).pathname;
  const ok = lcpMs <= LCP_BUDGET_MS && run.summary.performance >= PERF_WARN_MIN;
  return `| \`${path}\` | ${score} | ${lcp?.displayValue ?? "—"} | ${ok ? "✅" : "⚠️"} |`;
});

const budget = `예산: LCP ≤ ${(LCP_BUDGET_MS / 1000).toFixed(0)}s(error) · performance ≥ ${String(PERF_WARN_MIN * 100)}(warn), 각 URL 3회 중앙값`;

process.stdout.write(
  [
    MARKER,
    "### Lighthouse (모바일)",
    "",
    "| URL | performance | LCP | |",
    "|---|---:|---:|---|",
    ...rows,
    "",
    budget,
    "",
  ].join("\n"),
);
