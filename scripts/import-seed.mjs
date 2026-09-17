#!/usr/bin/env node
/**
 * 시드 임포트 — supabase/seed/places.json(+ subway_exits.csv) → Supabase (secret key, RLS 우회).
 * **멱등**: seed_ref가 이미 있는 가게는 건드리지 않는다(사용자가 고친 영업시간·메뉴를 덮어쓰지 않으려고). 새 행만 넣는다.
 * needsReview 가게는 hidden_at을 찍어 넣는다 → 관리자 검색 탭 "검수 필요"에서 눈으로 보고 [복구] (decisions 2026-09-10).
 * 가게마다 checkins(type='seed', at=collectedAt) 한 줄 — "○일 전 확인"은 수집일 기준.
 *
 * 사용:
 *   SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/import-seed.mjs [--places supabase/seed/places.json] [--exits supabase/seed/subway_exits.csv] [--dry-run]
 * 로컬: `supabase status -o env`가 찍어 주는 API_URL·SECRET_KEY.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * @typedef {{ seedRef: string; name: string; gu: string; addressRoad: string | null; addressJibun: string | null;
 *   lat: number; lng: number; tags: string[]; specialist: boolean; naverPlaceUrl: string | null; menus: unknown[];
 *   sides: Record<string, boolean>; needsReview: boolean; collectedAt: string }} SeedPlace
 */

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const dryRun = args.includes("--dry-run");
const placesPath = opt("--places", "supabase/seed/places.json");
const exitsPath = opt("--exits", "supabase/seed/subway_exits.csv");

const url = process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_SECRET_KEY"];
if (!url || !key) {
  console.error("SUPABASE_URL·SUPABASE_SECRET_KEY가 필요하다 (.env 또는 supabase status -o env)");
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const fail = (step, error) => {
  console.error(`${step}: ${error.message}`);
  process.exit(1);
};


/** RFC 4180 한 줄 파서 — 역 이름에 쉼표가 있어 따옴표로 감싼 필드가 있다("동대문역사문화공원역"은 아니지만 "…,…" 역이 있다) */
/** @param {string} line @returns {string[]} */
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i] ?? "";
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function readExits(path) {
  const [header, ...lines] = readFileSync(path, "utf8").trim().split(/\r?\n/);
  const cols = header.split(",");
  return lines.map((line) => {
    const row = Object.fromEntries(splitCsvLine(line).map((v, i) => [cols[i], v]));
    return {
      station: row.station,
      lines: row.lines ? row.lines.split(";") : [],
      exit_no: row.exit_no || null,
      lat: Number(row.lat),
      lng: Number(row.lng),
    };
  });
}

async function importExits() {
  const rows = readExits(exitsPath);
  console.log(`역·출구 ${rows.length}행 (${exitsPath})`);
  if (dryRun) return;
  // 자연 키가 없어 통째로 교체한다 — 최근접역은 INSERT 시점에만 계산되므로 기존 가게는 영향 없다
  const del = await db.from("subway_exits").delete().gte("id", 0);
  if (del.error) fail("subway_exits 비우기", del.error);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("subway_exits").insert(rows.slice(i, i + 500));
    if (error) fail("subway_exits 넣기", error);
  }
}

async function existingSeedRefs() {
  const refs = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("places").select("seed_ref").not("seed_ref", "is", null).range(from, from + 999);
    if (error) fail("seed_ref 읽기", error);
    for (const r of data) refs.add(r.seed_ref);
    if (data.length < 1000) break;
  }
  return refs;
}

async function importPlaces() {
  /** @type {SeedPlace[]} */
  const places = JSON.parse(readFileSync(placesPath, "utf8"));
  const have = await existingSeedRefs();
  const fresh = places.filter((p) => !have.has(p.seedRef));
  console.log(`가게 ${places.length}곳 중 새로 넣을 것 ${fresh.length}곳 (이미 있음 ${places.length - fresh.length})`);
  if (dryRun || fresh.length === 0) return;
  let inserted = 0;
  let hidden = 0;
  for (let i = 0; i < fresh.length; i += 200) {
    const batch = fresh.slice(i, i + 200);
    const rows = batch.map((p) => ({
      seed_ref: p.seedRef,
      name: p.name,
      gu: p.gu,
      address_road: p.addressRoad,
      address_jibun: p.addressJibun,
      lat: p.lat,
      lng: p.lng,
      tags: p.tags,
      specialist: p.specialist,
      naver_place_url: p.naverPlaceUrl,
      menus: p.menus,
      sides: Object.entries(p.sides).filter(([, v]) => v).map(([k]) => k),
      source: "seed",
      needs_review: p.needsReview,
      hidden_at: p.needsReview ? new Date().toISOString() : null,
      created_at: `${p.collectedAt}T00:00:00+09:00`,
    }));
    const { data, error } = await db.from("places").insert(rows).select("id, seed_ref");
    if (error) fail(`places 넣기 (${i})`, error);
    /** @type {{ id: string; seed_ref: string }[]} */
    const created = data ?? [];
    const at = new Map(batch.map((p) => [p.seedRef, `${p.collectedAt}T00:00:00+09:00`]));
    const checkins = created.map((r) => ({ place_id: r.id, actor: null, type: "seed", at: at.get(r.seed_ref) }));
    const c = await db.from("checkins").insert(checkins);
    if (c.error) fail("checkins(seed) 넣기", c.error);
    inserted += created.length;
    hidden += batch.filter((p) => p.needsReview).length;
  }
  console.log(`넣음 ${inserted}곳 (그중 검수 필요로 숨김 ${hidden}곳)`);
}

if (exitsPath !== "none") await importExits();
await importPlaces();
const { count } = await db.from("places").select("id", { count: "exact", head: true }).not("seed_ref", "is", null);
const { count: stationed } = await db.from("places").select("id", { count: "exact", head: true }).not("seed_ref", "is", null).not("nearest_station", "is", null);
console.log(`DB 시드 가게 ${count}곳, 최근접역 채워짐 ${stationed}곳`);
