import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BANNED } from "../content-filter";

const MIGRATIONS = join(process.cwd(), "supabase/migrations");

/** 가장 나중 마이그레이션의 `private.banned_words()` 본문에서 목록을 읽는다 — 목록을 고친 새 마이그레이션이 이긴다 */
function bannedWordsInDb(): string[] {
  const bodies = [...readdirSync(MIGRATIONS)]
    .sort()
    .flatMap((file) => [...readFileSync(join(MIGRATIONS, file), "utf8").matchAll(/function private\.banned_words\(\)[^$]*\$\$([\s\S]*?)\$\$/gu)])
    .map((m) => m[1] ?? "");
  const latest = bodies.at(-1) ?? "";
  return [...latest.matchAll(/'([^']+)'/gu)].map((m) => m[1] ?? "");
}

describe("금칙어 목록 — 폼(content-filter)과 DB(banned_words)가 같다", () => {
  it("한쪽만 고치면 깨진다", () => {
    expect(bannedWordsInDb().sort()).toEqual([...BANNED].sort());
  });
});
