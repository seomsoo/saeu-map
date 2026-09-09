#!/usr/bin/env node
/**
 * 가게 JSON(convert_seed.py 출력 또는 lib/mock/places.json 모양) → supabase/seed.sql
 * 로컬·CI 샘플용이다. 실서비스 임포트는 scripts/import-seed.ts(secret key, 멱등 upsert).
 *
 * 사용: node scripts/gen-seed.mjs <places.json> [checkins.json] [reviews.json] > supabase/seed.sql
 *  - seed_ref = "mock:" + id (실 데이터는 네이버 place_id)
 *  - 가게마다 checkins(type='seed', at=lastCheckedAt) 한 줄 — "○일 전 확인"은 수집일 기준
 *  - checkins.json의 visited는 actor 없이(목 actor는 사용자가 아니다), reviews.json은 시드 카카오 유저 하나로
 *  - 사진은 넣지 않는다(키가 R2에 없다)
 */
import { readFileSync } from "node:fs";

const [placesPath, checkinsPath, reviewsPath] = process.argv.slice(2);
if (!placesPath) {
  console.error("usage: gen-seed.mjs <places.json> [checkins.json] [reviews.json]");
  process.exit(1);
}
const places = JSON.parse(readFileSync(placesPath, "utf8"));
const checkins = checkinsPath ? JSON.parse(readFileSync(checkinsPath, "utf8")) : [];
const reviews = reviewsPath ? JSON.parse(readFileSync(reviewsPath, "utf8")) : [];

const q = (s) => (s === null || s === undefined ? "null" : `'${String(s).replaceAll("'", "''")}'`);
const arr = (xs) => `'{${xs.map((x) => `"${String(x).replaceAll('"', '\\"')}"`).join(",")}}'`;
const json = (v) => `${q(JSON.stringify(v))}::jsonb`;
/** date-only("2026-08-25")는 KST 자정으로 */
const ts = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? `'${s}T00:00:00+09:00'` : q(s));

const SEED_USER = "00000000-0000-0000-0000-00000000feed"; // 시드 리뷰 작성자(새우헌터)
const lines = [
  "-- 생성: node scripts/gen-seed.mjs (손으로 고치지 않는다)",
  "-- 시드 리뷰 작성자(카카오 흉내). 로컬 관리자는 첫 로그인 뒤 update profiles set is_admin = true where id = '<uid>'",
  `insert into auth.users (id, instance_id, aud, role, is_anonymous, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values ('${SEED_USER}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', false, '{"nickname":"새우헌터"}', '{"provider":"kakao","providers":["kakao"]}', now(), now())
on conflict (id) do nothing;`,
];

for (const p of places) {
  const sides = Object.entries(p.sides ?? {}).filter(([, v]) => v).map(([k]) => k);
  const menus = (p.menus ?? []).slice(0, 5).map((m) => ({
    raw: m.raw ?? m.name, name: m.name, price: m.price ?? null, unit: m.unit ?? "none", unit_raw: m.unit_raw ?? null,
  }));
  const station = p.nearestStation ? json(p.nearestStation) : "null";
  lines.push(
    `insert into public.places (seed_ref, name, gu, address_road, address_jibun, lat, lng, nearest_station, tags, specialist, naver_place_url, hours_note, menus, sides, source, needs_review, hidden_at, created_at)
values (${q(`mock:${p.id}`)}, ${q(p.name)}, ${q(p.gu)}, ${q(p.addressRoad)}, ${q(p.addressJibun)}, ${p.lat}, ${p.lng}, ${station}, ${arr(p.tags)}, ${p.specialist ? "true" : "false"}, ${q(p.naverPlaceUrl)}, ${q(p.hoursNote ?? null)}, ${json(menus)}, ${arr(sides)}, 'seed', ${p.needsReview ? "true" : "false"}, ${p.needsReview ? "now()" : "null"}, ${p.createdAt ? ts(p.createdAt) : ts(p.lastCheckedAt)});`,
  );
  lines.push(
    `insert into public.checkins (place_id, actor, type, at) select id, null, 'seed', ${ts(p.lastCheckedAt)} from public.places where seed_ref = ${q(`mock:${p.id}`)};`,
  );
}
for (const c of checkins) {
  lines.push(
    `insert into public.checkins (place_id, actor, type, at) select id, null, 'visited', ${ts(c.at)} from public.places where seed_ref = ${q(`mock:${c.placeId}`)};`,
  );
}
for (const r of reviews) {
  lines.push(
    `insert into public.reviews (place_id, author_id, rating, text, created_at) select id, '${SEED_USER}', ${r.rating}, ${q(r.text)}, ${ts(r.at)} from public.places where seed_ref = ${q(`mock:${r.placeId}`)} on conflict do nothing;`,
  );
}
process.stdout.write(lines.join("\n") + "\n");
