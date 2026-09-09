#!/usr/bin/env node
/**
 * 시드 JSON(convert_seed.py 출력) → supabase/seed.sql — 로컬·CI 샘플용.
 * 실서비스 임포트는 scripts/import-seed.mjs(secret key, 멱등)가 한다.
 *
 * 사용: node scripts/gen-seed.mjs <places.json> [--exits supabase/seed/subway_exits.csv] > supabase/seed.sql
 *  - seed_ref = 네이버 place_id, created_at = 수집일, checkins(type='seed', at=수집일) 한 줄
 *  - needsReview면 hidden_at을 찍는다(관리자 검수 필터 경로가 로컬에서도 보이게)
 *  - --exits: 샘플 가게 근처(위도 ±0.02°·경도 ±0.025°, 트리거의 탐색 상자와 같다)의 역·출구만 넣는다 → places INSERT 트리거가 최근접역을 계산한다
 *  - 사진은 넣지 않는다(키가 R2에 없다)
 */
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const placesPath = args.find((a) => !a.startsWith("--"));
const exitsIdx = args.indexOf("--exits");
const exitsPath = exitsIdx >= 0 ? args[exitsIdx + 1] : null;
if (!placesPath) {
  console.error("usage: gen-seed.mjs <places.json> [--exits subway_exits.csv]");
  process.exit(1);
}
const places = JSON.parse(readFileSync(placesPath, "utf8"));

const q = (s) => (s === null || s === undefined ? "null" : `'${String(s).replaceAll("'", "''")}'`);
const arr = (xs) => `'{${xs.map((x) => `"${String(x).replaceAll('"', '\\"')}"`).join(",")}}'`;
const json = (v) => `${q(JSON.stringify(v))}::jsonb`;
const kst = (dateOnly) => `'${dateOnly}T00:00:00+09:00'`;


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

const lines = [
  "-- 생성: node scripts/gen-seed.mjs (손으로 고치지 않는다). 로컬 관리자는 첫 로그인 뒤 update profiles set is_admin = true where id = '<uid>'",
];

if (exitsPath) {
  const [header, ...rows] = readFileSync(exitsPath, "utf8").trim().split(/\r?\n/);
  const cols = header.split(",");
  const near = rows
    .map((line) => Object.fromEntries(splitCsvLine(line).map((v, i) => [cols[i], v])))
    .filter((r) => places.some((p) => Math.abs(p.lat - Number(r.lat)) < 0.02 && Math.abs(p.lng - Number(r.lng)) < 0.025));
  lines.push(`-- 역·출구 ${near.length}행 (샘플 가게 근처만)`);
  for (const r of near) {
    lines.push(
      `insert into public.subway_exits (station, lines, exit_no, lat, lng) values (${q(r.station)}, ${arr(r.lines ? r.lines.split(";") : [])}, ${q(r.exit_no || null)}, ${r.lat}, ${r.lng});`,
    );
  }
}

for (const p of places) {
  const sides = Object.entries(p.sides ?? {}).filter(([, v]) => v).map(([k]) => k);
  lines.push(
    `insert into public.places (seed_ref, name, gu, address_road, address_jibun, lat, lng, tags, specialist, naver_place_url, menus, sides, source, needs_review, hidden_at, created_at)
values (${q(p.seedRef)}, ${q(p.name)}, ${q(p.gu)}, ${q(p.addressRoad)}, ${q(p.addressJibun)}, ${p.lat}, ${p.lng}, ${arr(p.tags)}, ${p.specialist ? "true" : "false"}, ${q(p.naverPlaceUrl)}, ${json(p.menus)}, ${arr(sides)}, 'seed', ${p.needsReview ? "true" : "false"}, ${p.needsReview ? "now()" : "null"}, ${kst(p.collectedAt)});`,
  );
  lines.push(
    `insert into public.checkins (place_id, actor, type, at) select id, null, 'seed', ${kst(p.collectedAt)} from public.places where seed_ref = ${q(p.seedRef)};`,
  );
}
process.stdout.write(lines.join("\n") + "\n");
