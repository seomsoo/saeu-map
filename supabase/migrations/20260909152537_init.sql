-- 새우맵 스키마 v1 (docs/plans/phase6-backend.md 스키마 표 · decisions 2026-09-10)
--
-- 원칙
--  · 확인일·확인수·평점은 컬럼이 아니라 checkins·reviews에서 계산한다(spec 6). 삭제는 전부 소프트다.
--  · 공개 읽기는 invoker 뷰 2개(places_public·reviews_public) + RPC. 표는 **공개 열만 컬럼 GRANT**하고 RLS가 행을 가른다 —
--    reporter_id·uploader_id·hidden_at 같은 열은 anon·authenticated에 아예 GRANT하지 않는다(관리자는 admin_places() RPC).
--  · 사용자 쓰기는 단일 표 = RLS 정책(with check에 속도 제한), 다중 표 = RPC(submit_report·apply_suggestion).
--  · 관리자는 profiles.is_admin → private.is_admin() 정책. 프론트 체크는 장식이다(spec 4.5).
--  · 시리즈용으로 새우 고유명은 아래 허용값 상수 세 줄에만 있다.
--  · private 스키마는 API에 노출되지 않는다(config.toml api.schemas = public). 정책이 부르므로 실행 권한은 준다.

create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ── 허용값 (시리즈: 여기만 바꾼다) ───────────────────────────────────────────
create or replace function private.allowed_tags() returns text[] language sql immutable set search_path = '' as $$
  select array['grill', 'raw']::text[];
$$;
create or replace function private.allowed_sides() returns text[] language sql immutable set search_path = '' as $$
  select array['headButter', 'ramen', 'friedRice']::text[];
$$;
create or replace function private.allowed_units() returns text[] language sql immutable set search_path = '' as $$
  select array['kg', 'g', 'pan', 'count', 'size', 'serving', 'none']::text[];
$$;

-- ── 공통 헬퍼 ──────────────────────────────────────────────────────────────────
-- 요청 헤더의 IP 해시(서버 액션이 sha256(IP + 일별 salt)를 x-ip-hash로 보낸다). 없으면 null.
create or replace function private.request_ip_hash() returns text language sql stable set search_path = '' as $$
  select nullif(current_setting('request.headers', true)::json ->> 'x-ip-hash', '');
$$;

create or replace function private.is_anonymous() returns boolean language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

-- 메뉴 jsonb 모양: [{raw, name, price|null, unit, unit_raw|null}] ≤ 5줄 (lib/types.ts Menu)
create or replace function private.menus_valid(m jsonb) returns boolean language plpgsql immutable set search_path = '' as $$
declare
  item jsonb;
begin
  if m is null or jsonb_typeof(m) <> 'array' or jsonb_array_length(m) > 5 then
    return false;
  end if;
  for item in select * from jsonb_array_elements(m) loop
    if jsonb_typeof(item) <> 'object' then return false; end if;
    if jsonb_typeof(item -> 'name') <> 'string' or char_length(item ->> 'name') not between 1 and 200 then return false; end if;
    if jsonb_typeof(item -> 'raw') <> 'string' then return false; end if;
    if jsonb_typeof(item -> 'price') not in ('number', 'null') then return false; end if;
    if jsonb_typeof(item -> 'price') = 'number' and ((item ->> 'price')::numeric < 0 or (item ->> 'price')::numeric > 999999) then return false; end if;
    if coalesce(item ->> 'unit', 'none') <> all (private.allowed_units()) then return false; end if;
    if jsonb_typeof(item -> 'unit_raw') not in ('string', 'null') then return false; end if;
  end loop;
  return true;
end;
$$;

-- 두 좌표의 직선거리(m) — 최근접역용
create or replace function private.distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable set search_path = '' as $$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- ── 표 ───────────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text check (nickname is null or char_length(nickname) between 2 and 12),
  is_admin boolean not null default false,
  shadow_banned boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.profiles is '사용자 프로필. is_admin이 관리자 판정의 유일한 근거(spec 4.5). shadow_banned면 쓰기가 조용히 버려진다.';

create table public.places (
  id uuid primary key default gen_random_uuid(),
  seed_ref text unique,
  name text not null check (char_length(name) between 1 and 60),
  gu text not null check (char_length(gu) between 1 and 40),
  address_road text check (address_road is null or char_length(address_road) between 2 and 120),
  address_jibun text check (address_jibun is null or char_length(address_jibun) <= 120),
  lat double precision not null check (lat between 33 and 39),
  lng double precision not null check (lng between 124 and 132),
  nearest_station jsonb,
  tags text[] not null default '{grill}' check (cardinality(tags) >= 1 and tags <@ private.allowed_tags()),
  specialist boolean not null default false,
  naver_place_url text check (naver_place_url is null or char_length(naver_place_url) <= 300),
  hours_note text check (hours_note is null or char_length(hours_note) <= 80),
  menus jsonb not null default '[]'::jsonb check (private.menus_valid(menus)),
  sides text[] not null default '{}' check (sides <@ private.allowed_sides()),
  source text not null check (source in ('seed', 'report')),
  reporter_id uuid references auth.users (id) on delete set null,
  duplicate_suspect_of uuid references public.places (id) on delete set null,
  merged_into uuid references public.places (id) on delete set null,
  needs_review boolean not null default false,
  verified_at timestamptz,
  hidden_at timestamptz,
  removed_by_owner boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.places is '가게. 숨김·병합은 소프트(hidden_at·merged_into). 확인일·평점·사진은 places_public 뷰가 계산한다.';
create index places_reporter_id_idx on public.places (reporter_id);
create index places_duplicate_suspect_of_idx on public.places (duplicate_suspect_of);
create index places_merged_into_idx on public.places (merged_into);
create index places_created_at_idx on public.places (created_at desc);
create index places_visible_idx on public.places (id) where hidden_at is null and merged_into is null;

create table public.checkins (
  id bigint generated always as identity primary key,
  place_id uuid not null references public.places (id) on delete cascade,
  actor uuid references auth.users (id) on delete set null,
  type text not null check (type in ('visited', 'review', 'seed')),
  at timestamptz not null default now(),
  kst_day date generated always as ((at at time zone 'Asia/Seoul')::date) stored
);
comment on table public.checkins is '확인 사건. 한 줄씩 append — 확인일·확인수·시즌 카운터가 여기서 나온다(spec 6).';
create unique index checkins_visited_daily_once on public.checkins (place_id, actor, kst_day) where type = 'visited';
create index checkins_place_at_idx on public.checkins (place_id, at desc);
create index checkins_actor_idx on public.checkins (actor);
create index checkins_at_idx on public.checkins (at desc);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  text text not null default '' check (char_length(text) <= 500),
  photo_key text check (photo_key is null or char_length(photo_key) <= 200),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create unique index reviews_one_per_place on public.reviews (place_id, author_id) where deleted_at is null;
create index reviews_place_id_idx on public.reviews (place_id) where deleted_at is null;
create index reviews_author_id_idx on public.reviews (author_id);

create table public.bookmarks (
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);
create index bookmarks_place_id_idx on public.bookmarks (place_id);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  key text not null unique check (char_length(key) <= 200),
  uploader_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  removed_at timestamptz
);
comment on column public.photos.key is 'R2 키(places/<placeId>/<uuid>.webp). URL이 아니다 — 저장소 이전은 복사 + 서빙 함수 교체로 끝난다.';
create index photos_place_id_idx on public.photos (place_id) where removed_at is null;
create index photos_uploader_id_idx on public.photos (uploader_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('place_flag', 'place_report', 'photo_report', 'owner_request')),
  place_id uuid not null references public.places (id) on delete cascade,
  photo_id uuid references public.photos (id) on delete set null,
  reason text check (reason is null or char_length(reason) <= 40),
  owner_kind text check (owner_kind is null or owner_kind in ('edit', 'remove')),
  contact text check (contact is null or char_length(contact) <= 60),
  message text check (message is null or char_length(message) <= 300),
  actor uuid references auth.users (id) on delete set null,
  ip_hash text,
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (kind <> 'photo_report' or photo_id is not null),
  check (kind <> 'owner_request' or (owner_kind is not null and contact is not null))
);
create index reports_place_id_idx on public.reports (place_id);
create index reports_photo_id_idx on public.reports (photo_id);
create index reports_actor_idx on public.reports (actor);
create index reports_status_created_idx on public.reports (status, created_at desc);

create table public.place_edits (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  actor uuid references auth.users (id) on delete set null,
  field text not null check (field in ('hours', 'address', 'menus', 'sides')),
  before jsonb not null,
  at timestamptz not null default now()
);
comment on table public.place_edits is '즉시 반영된 수정의 이전 값(되돌리기용, spec 4.2). places UPDATE 트리거가 쓴다.';
create index place_edits_place_id_idx on public.place_edits (place_id);
create index place_edits_actor_idx on public.place_edits (actor);
create index place_edits_at_idx on public.place_edits (at desc);

create table public.rate_events (
  id bigint generated always as identity primary key,
  kind text not null,
  actor uuid,
  ip_hash text,
  place_id uuid,
  at timestamptz not null default now()
);
comment on table public.rate_events is '속도 제한용 발자국. 쓰기 표의 AFTER INSERT 트리거가 남기고 24시간 뒤 pg_cron이 지운다. FK 없음(사용자·가게가 지워져도 카운트는 남는다).';
create index rate_events_kind_at_idx on public.rate_events (kind, at desc);
create index rate_events_actor_idx on public.rate_events (actor);
create index rate_events_ip_hash_idx on public.rate_events (ip_hash);
create index rate_events_place_id_idx on public.rate_events (place_id);

create table public.subway_exits (
  id bigint generated always as identity primary key,
  station text not null,
  lines text[] not null default '{}',
  exit_no text,
  lat double precision not null,
  lng double precision not null
);
comment on table public.subway_exits is '역·출구 좌표(OSM ODbL, scripts/add_nearest_station.py 내보내기). places INSERT 트리거가 최근접역을 계산한다.';
create index subway_exits_lat_lng_idx on public.subway_exits (lat, lng);

create table public.peel_results (
  id bigint generated always as identity primary key,
  type text not null check (type in ('jipge', 'sonjil', 'wansik', 'chojang')),
  created_at timestamptz not null default now()
);
create index peel_results_created_at_idx on public.peel_results (created_at desc);

-- ── 권한 판정 · 속도 제한 · 섀도 밴 (private, SECURITY DEFINER — 정책이 부른다) ──
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = (select auth.uid())), false);
$$;

create or replace function private.is_shadow_banned() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.shadow_banned from public.profiles p where p.id = (select auth.uid())), false);
$$;

create or replace function private.place_visible(p_place uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.places p where p.id = p_place and p.hidden_at is null and p.merged_into is null);
$$;

-- 최근 p_window 동안 같은 사람(actor) 또는 같은 IP가 p_kind를 p_limit 미만으로 했는가. p_place가 있으면 그 가게에 한해서.
create or replace function private.rate_ok(p_kind text, p_limit integer, p_window interval, p_place uuid default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select (
    select count(*) from public.rate_events e
    where e.kind = p_kind
      and e.at >= now() - p_window
      and (p_place is null or e.place_id = p_place)
      and (
        (e.actor is not null and e.actor = (select auth.uid()))
        or (e.ip_hash is not null and e.ip_hash = private.request_ip_hash())
      )
  ) < p_limit;
$$;

-- 이번 달(KST) 올라온 사진 수 — Images 변환 무료 5,000장 안에서 정지시키는 전역 상한(4,500)용
create or replace function private.photos_this_month() returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.photos
  where created_at >= (date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
$$;

-- ── 트리거 함수 ────────────────────────────────────────────────────────────────
create or replace function private.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  nick text := nullif(trim(coalesce(meta ->> 'nickname', meta ->> 'name', meta ->> 'preferred_username', meta ->> 'user_name', '')), '');
begin
  if nick is not null then
    nick := left(nick, 12);
    if char_length(nick) < 2 then nick := null; end if;
  end if;
  insert into public.profiles (id, nickname) values (new.id, nick)
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger places_touch_updated_at before update on public.places
  for each row execute function private.touch_updated_at();

-- 섀도 밴이면 행을 조용히 버린다(BEFORE INSERT에서 null = 삽입 안 함, 오류 없음 = 성공한 척)
create or replace function private.drop_if_shadow_banned() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.is_shadow_banned() then
    return null;
  end if;
  return new;
end;
$$;

-- 속도 제한 발자국. tg_argv[0] = kind('@kind'면 행의 kind 열), tg_argv[1] = 가게 열 이름('self' = 이 행의 id)
create or replace function private.log_rate_event() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  row_json jsonb := to_jsonb(new);
  v_kind text := case when tg_argv[0] = '@kind' then row_json ->> 'kind' else tg_argv[0] end;
  v_place uuid := case
    when tg_argv[1] = 'self' then (row_json ->> 'id')::uuid
    when tg_argv[1] = 'place_id' then (row_json ->> 'place_id')::uuid
    else null end;
begin
  insert into public.rate_events (kind, actor, ip_hash, place_id)
  values (v_kind, (select auth.uid()), private.request_ip_hash(), v_place);
  return new;
end;
$$;

-- 신고 행에 요청 IP 해시를 찍는다 — "신고 3회"를 사람 기준으로 세려면 actor(익명 회전 가능) 말고 IP도 있어야 한다(decisions 2026-09-08). 24시간 해시라 개인 식별은 못 한다
create or replace function private.stamp_ip_hash() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.ip_hash := private.request_ip_hash();
  return new;
end;
$$;

-- 가게당 사진 10장 (MAX_PLACE_PHOTOS) — UI·액션이 먼저 막고 여기가 마지막 방어선
create or replace function private.enforce_photo_cap() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.photos where place_id = new.place_id and removed_at is null) >= 10 then
    raise exception 'photo limit reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- 리뷰 등록은 확인이기도 하다(spec 5)
create or replace function private.checkin_on_review() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.checkins (place_id, actor, type, at) values (new.place_id, new.author_id, 'review', new.created_at);
  return new;
end;
$$;

-- 수정 이력: 네 필드 중 하나라도 바뀌면 바뀌기 직전 값을 통째로 남긴다. field는 apply_suggestion이 GUC로 알려주고, 없으면 첫 변경 열.
create or replace function private.log_place_edit() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_field text := nullif(current_setting('app.edit_field', true), '');
begin
  if old.hours_note is distinct from new.hours_note
     or old.address_road is distinct from new.address_road
     or old.menus is distinct from new.menus
     or old.sides is distinct from new.sides then
    if v_field is null then
      v_field := case
        when old.hours_note is distinct from new.hours_note then 'hours'
        when old.address_road is distinct from new.address_road then 'address'
        when old.menus is distinct from new.menus then 'menus'
        else 'sides' end;
    end if;
    insert into public.place_edits (place_id, actor, field, before)
    values (new.id, (select auth.uid()), v_field,
      jsonb_build_object('hoursNote', old.hours_note, 'addressRoad', old.address_road, 'menus', old.menus, 'sides', old.sides));
  end if;
  return new;
end;
$$;

-- 최근접역: 비어 있을 때만 계산(시드는 미리 계산한 값을 그대로 넣을 수 있다). 2km 밖이면 null — 800m 컷은 코드(STATION_NEARBY_MAX_M)가 한다.
create or replace function private.fill_nearest_station() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  hit record;
begin
  if new.nearest_station is not null then
    return new;
  end if;
  select s.station, s.exit_no, s.lines, private.distance_m(new.lat, new.lng, s.lat, s.lng) as d
    into hit
  from public.subway_exits s
  where s.lat between new.lat - 0.02 and new.lat + 0.02
    and s.lng between new.lng - 0.025 and new.lng + 0.025
  order by d asc
  limit 1;
  if hit.station is not null and hit.d <= 2000 then
    new.nearest_station := jsonb_build_object(
      'name', hit.station, 'exit', hit.exit_no, 'distanceM', round(hit.d)::integer, 'lines', to_jsonb(hit.lines));
  end if;
  return new;
end;
$$;

create trigger places_fill_nearest_station before insert on public.places
  for each row execute function private.fill_nearest_station();
create trigger places_log_edit after update on public.places
  for each row execute function private.log_place_edit();

create trigger checkins_shadow before insert on public.checkins
  for each row execute function private.drop_if_shadow_banned();

create trigger reviews_shadow before insert on public.reviews
  for each row execute function private.drop_if_shadow_banned();
create trigger reviews_rate after insert on public.reviews
  for each row execute function private.log_rate_event('review', 'place_id');
create trigger reviews_checkin after insert on public.reviews
  for each row execute function private.checkin_on_review();

create trigger photos_shadow before insert on public.photos
  for each row execute function private.drop_if_shadow_banned();
create trigger photos_cap before insert on public.photos
  for each row execute function private.enforce_photo_cap();
create trigger photos_rate after insert on public.photos
  for each row execute function private.log_rate_event('photo', 'place_id');

create trigger reports_shadow before insert on public.reports
  for each row execute function private.drop_if_shadow_banned();
create trigger reports_stamp_ip before insert on public.reports
  for each row execute function private.stamp_ip_hash();
create trigger reports_rate after insert on public.reports
  for each row execute function private.log_rate_event('@kind', 'place_id');

create trigger peel_results_rate after insert on public.peel_results
  for each row execute function private.log_rate_event('peel', 'none');

-- ── 공개 뷰 (security_invoker — 아래 컬럼 GRANT·RLS가 실제 방어선이다) ──
create view public.places_public with (security_invoker = true) as
select
  p.id, p.name, p.gu, p.address_road, p.address_jibun, p.lat, p.lng, p.nearest_station,
  p.tags, p.specialist, p.naver_place_url, p.hours_note, p.menus, p.sides, p.source, p.created_at,
  coalesce(c.check_count, 0) as check_count,
  c.last_checked_at,
  coalesce(r.rating_count, 0) as rating_count,
  case when r.rating_count >= 3 then r.rating_avg end as rating_avg,
  coalesce(ph.photos, '[]'::jsonb) as photos,
  (p.source = 'report' and p.created_at >= now() - interval '7 days') as is_new
from public.places p
left join lateral (
  select count(*)::integer as check_count, max(c.at) as last_checked_at
  from public.checkins c where c.place_id = p.id
) c on true
left join lateral (
  select count(*)::integer as rating_count, round(avg(r.rating)::numeric, 2) as rating_avg
  from public.reviews r where r.place_id = p.id and r.deleted_at is null
) r on true
left join lateral (
  select jsonb_agg(jsonb_build_object('id', x.id, 'key', x.key, 'uploadedAt', x.created_at) order by x.created_at, x.id) as photos
  from public.photos x where x.place_id = p.id and x.removed_at is null
) ph on true
;
comment on view public.places_public is '사용자에게 보이는 가게 + 집계. 숨김·병합 제외는 places의 RLS가, 개인 식별자 미노출은 컬럼 GRANT가 한다. **service_role(secret key)로 읽으면 숨긴 가게도 나온다** — 서버 읽기는 항상 사용자 세션 클라이언트로.';

create view public.reviews_public with (security_invoker = true) as
select r.id, r.place_id, r.author_id, r.rating, r.text, r.photo_key, r.created_at, r.edited_at,
  pr.nickname
from public.reviews r
join public.places p on p.id = r.place_id   -- 숨긴 가게의 리뷰는 places RLS가 거른다
left join public.profiles pr on pr.id = r.author_id
where r.deleted_at is null;
comment on view public.reviews_public is '보이는 리뷰 + 작성자 닉네임(profiles는 id·nickname 열만 GRANT).';

-- ── RPC (public, SECURITY DEFINER — 각자 auth.uid()·속도·섀도 밴을 검사한다) ──
-- 제보 등록 (spec 4.3). 가게 하나를 통째로 만드는 가장 비싼 쓰기 — 시간당 5.
create or replace function public.submit_report(
  p_name text, p_lat double precision, p_lng double precision, p_gu text,
  p_tags text[], p_menus jsonb, p_sides text[], p_hours_note text,
  p_naver_place_url text, p_duplicate_of uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'login required' using errcode = 'insufficient_privilege';
  end if;
  if not private.rate_ok('report', 5, interval '1 hour') then
    raise exception 'rate limited' using errcode = 'too_many_rows';
  end if;
  insert into public.places (
    name, lat, lng, gu, tags, menus, sides, hours_note, naver_place_url, duplicate_suspect_of,
    source, reporter_id, hidden_at
  ) values (
    p_name, p_lat, p_lng, p_gu, p_tags, p_menus, p_sides, nullif(p_hours_note, ''), nullif(p_naver_place_url, ''), p_duplicate_of,
    'report', v_uid,
    case when private.is_shadow_banned() then now() end  -- 섀도 밴: 만들어지되 아무에게도 안 보인다
  ) returning id into v_id;
  insert into public.rate_events (kind, actor, ip_hash, place_id) values ('report', v_uid, private.request_ip_hash(), v_id);
  return v_id;
end;
$$;
revoke execute on function public.submit_report(text, double precision, double precision, text, text[], jsonb, text[], text, text, uuid) from public, anon;
grant execute on function public.submit_report(text, double precision, double precision, text, text[], jsonb, text[], text, text, uuid) to authenticated;

-- 값 제안 — 즉시 반영 + 이력(트리거) (spec 4.2). 핀당 일 5.
create or replace function public.apply_suggestion(p_place uuid, p_field text, p_value jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'login required' using errcode = 'insufficient_privilege';
  end if;
  if not private.place_visible(p_place) then
    raise exception 'place not found' using errcode = 'no_data_found';
  end if;
  if private.is_shadow_banned() then
    return;  -- 성공한 척
  end if;
  if not private.rate_ok('suggest', 5, interval '1 day', p_place) then
    raise exception 'rate limited' using errcode = 'too_many_rows';
  end if;
  perform set_config('app.edit_field', p_field, true);
  case p_field
    when 'hours' then
      update public.places set hours_note = left(p_value #>> '{}', 80) where id = p_place;
    when 'address' then
      update public.places set address_road = left(p_value #>> '{}', 120) where id = p_place;
    when 'sides' then
      update public.places set sides = (select coalesce(array_agg(x), '{}') from jsonb_array_elements_text(p_value) x) where id = p_place;
    when 'menus' then
      update public.places set menus = p_value where id = p_place;
    else
      raise exception 'unknown field' using errcode = 'invalid_parameter_value';
  end case;
  insert into public.rate_events (kind, actor, ip_hash, place_id) values ('suggest', v_uid, private.request_ip_hash(), p_place);
end;
$$;
revoke execute on function public.apply_suggestion(uuid, text, jsonb) from public, anon;
grant execute on function public.apply_suggestion(uuid, text, jsonb) to authenticated;

-- 내 프로필 — is_admin·shadow_banned 열은 아무에게도 GRANT하지 않는다(누가 관리자인지 열거되지 않게). 본인 것만 RPC로.
create or replace function public.me() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'nickname', p.nickname, 'isAdmin', p.is_admin)
  from public.profiles p where p.id = (select auth.uid());
$$;
revoke execute on function public.me() from public, anon;
grant execute on function public.me() to authenticated;

-- 관리자 읽기 — 숨긴 가게·병합·검수·reporter_id까지 전부(GRANT 안 된 열이라 RPC). 상호 부분 일치, 상한 200.
create or replace function public.admin_places(p_query text default null, p_limit integer default 200)
returns setof public.places language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  return query
    select * from public.places p
    where p_query is null or p.name ilike '%' || p_query || '%'
    order by p.created_at desc
    limit least(greatest(p_limit, 1), 500);
end;
$$;
revoke execute on function public.admin_places(text, integer) from public, anon;
grant execute on function public.admin_places(text, integer) to authenticated;

-- 내 제보 — reporter_id를 공개 열에 싣지 않으려고 RPC로
create or replace function public.my_reports() returns setof public.places_public language sql stable security definer set search_path = '' as $$
  select v.* from public.places_public v
  join public.places p on p.id = v.id
  where p.reporter_id = (select auth.uid())
  order by p.created_at desc;
$$;
revoke execute on function public.my_reports() from public, anon;
grant execute on function public.my_reports() to authenticated;

-- 시즌 카운터 (spec 4.1) — KST 오늘·이번 주(월요일 00:00~)
create or replace function public.season_stats() returns jsonb language sql stable security definer set search_path = '' as $$
  with bounds as (
    select
      (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') as day_start,
      (date_trunc('week', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') as week_start
  ),
  visible as (select id, name from public.places where hidden_at is null and merged_into is null),
  week as (
    select c.place_id, count(*) as n, max(c.at) as latest
    from public.checkins c join visible v on v.id = c.place_id, bounds b
    where c.at >= b.week_start and c.at <= now()
    group by c.place_id
  )
  select jsonb_build_object(
    'todayCheckinCount', (select count(*) from public.checkins c join visible v on v.id = c.place_id, bounds b where c.at >= b.day_start and c.at <= now()),
    'weekPlaceCount', (select count(*) from week),
    'newPlaceCount', (select count(*) from public.places p where p.hidden_at is null and p.merged_into is null and p.source = 'report' and p.created_at >= now() - interval '7 days'),
    'topPlace', (select jsonb_build_object('id', w.place_id, 'name', v.name, 'count', w.n) from week w join visible v on v.id = w.place_id order by w.n desc, w.latest desc limit 1)
  );
$$;
grant execute on function public.season_stats() to anon, authenticated;

-- 까주기 테스트 참여 집계 (design 11-e, 화면은 Phase 7)
create or replace function public.peel_stats() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'total', (select count(*) from public.peel_results),
    'byType', coalesce((select jsonb_object_agg(type, n) from (select type, count(*) as n from public.peel_results group by type) t), '{}'::jsonb)
  );
$$;
grant execute on function public.peel_stats() to anon, authenticated;

-- 관리자 통계 (design 화면 10-5) — 우리 DB로 셀 수 있는 것만
create or replace function public.admin_stats() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  today_start timestamptz := (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
  result jsonb;
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  select jsonb_build_object(
    'openReports', (select count(*) from public.reports where status = 'open'),
    'unverified', (select count(*) from public.places where source = 'report' and verified_at is null and hidden_at is null and merged_into is null),
    'daily', (
      select jsonb_agg(jsonb_build_object(
        'day', to_char(d.day_start at time zone 'Asia/Seoul', 'YYYY-MM-DD'),
        'reports', (select count(*) from public.places p where p.source = 'report' and p.created_at >= d.day_start and p.created_at < d.day_start + interval '1 day'),
        'checkins', (select count(*) from public.checkins c where c.at >= d.day_start and c.at < d.day_start + interval '1 day'),
        'reviews', (select count(*) from public.reviews r where r.deleted_at is null and r.created_at >= d.day_start and r.created_at < d.day_start + interval '1 day'),
        'edits', (select count(*) from public.place_edits e where e.at >= d.day_start and e.at < d.day_start + interval '1 day')
      ) order by d.day_start)
      from (select today_start - (n || ' days')::interval as day_start from generate_series(13, 0, -1) n) d
    ),
    'participants', (
      select jsonb_build_object(
        'anonymous', count(*) filter (where u.is_anonymous),
        'kakao', count(*) filter (where not u.is_anonymous))
      from auth.users u
      where exists (select 1 from public.checkins c where c.actor = u.id)
         or exists (select 1 from public.reviews r where r.author_id = u.id)
         or exists (select 1 from public.place_edits e where e.actor = u.id)
    ),
    'topPlaces', (
      select coalesce(jsonb_agg(jsonb_build_object('placeId', v.id, 'name', v.name, 'checkCount', v.check_count) order by v.check_count desc, v.name), '[]'::jsonb)
      from (select id, name, check_count from public.places_public order by check_count desc, name limit 10) v
    )
  ) into result;
  return result;
end;
$$;
revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- 가게 합치기 (spec 4.3 엣지 "이전 가게", 중복 의심 큐) — 사진·확인·리뷰·찜·신고·이력을 옮기고 원본은 숨긴다. 되돌리기 없음.
create or replace function public.admin_merge_places(p_from uuid, p_into uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if p_from = p_into or not exists (select 1 from public.places where id = p_into and merged_into is null) then
    raise exception 'invalid merge target' using errcode = 'invalid_parameter_value';
  end if;
  update public.photos set place_id = p_into where place_id = p_from;
  -- 같은 사람이 같은 날 두 가게를 확인했으면 한 건만 남긴다(유니크 인덱스)
  delete from public.checkins c where c.place_id = p_from and c.type = 'visited'
    and exists (select 1 from public.checkins t where t.place_id = p_into and t.type = 'visited' and t.actor is not distinct from c.actor and t.kst_day = c.kst_day);
  update public.checkins set place_id = p_into where place_id = p_from;
  -- 같은 사람의 리뷰가 양쪽에 있으면 원본 쪽을 소프트 삭제
  update public.reviews r set deleted_at = now() where r.place_id = p_from and r.deleted_at is null
    and exists (select 1 from public.reviews t where t.place_id = p_into and t.deleted_at is null and t.author_id is not distinct from r.author_id);
  update public.reviews set place_id = p_into where place_id = p_from;
  insert into public.bookmarks (user_id, place_id, created_at)
    select user_id, p_into, created_at from public.bookmarks where place_id = p_from
    on conflict (user_id, place_id) do nothing;
  delete from public.bookmarks where place_id = p_from;
  update public.reports set place_id = p_into where place_id = p_from;
  update public.place_edits set place_id = p_into where place_id = p_from;
  update public.places set duplicate_suspect_of = null where duplicate_suspect_of = p_from;
  update public.places set merged_into = p_into, hidden_at = coalesce(hidden_at, now()) where id = p_from;
end;
$$;
revoke execute on function public.admin_merge_places(uuid, uuid) from public, anon;
grant execute on function public.admin_merge_places(uuid, uuid) to authenticated;

-- 익명 → 카카오 승계 (decisions 2026-09-10: signInWithOAuth + 콜백 서버 병합). secret key(service_role)만 부른다.
create or replace function private.merge_users(p_from uuid, p_into uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_from = p_into or p_from is null or p_into is null then
    return;
  end if;
  update public.profiles t set shadow_banned = t.shadow_banned or coalesce((select f.shadow_banned from public.profiles f where f.id = p_from), false) where t.id = p_into;
  insert into public.bookmarks (user_id, place_id, created_at)
    select p_into, place_id, created_at from public.bookmarks where user_id = p_from
    on conflict (user_id, place_id) do nothing;
  delete from public.bookmarks where user_id = p_from;
  delete from public.checkins c where c.actor = p_from and c.type = 'visited'
    and exists (select 1 from public.checkins t where t.actor = p_into and t.type = 'visited' and t.place_id = c.place_id and t.kst_day = c.kst_day);
  update public.checkins set actor = p_into where actor = p_from;
  update public.reviews r set deleted_at = now() where r.author_id = p_from and r.deleted_at is null
    and exists (select 1 from public.reviews t where t.author_id = p_into and t.deleted_at is null and t.place_id = r.place_id);
  update public.reviews set author_id = p_into where author_id = p_from;
  update public.places set reporter_id = p_into where reporter_id = p_from;
  update public.photos set uploader_id = p_into where uploader_id = p_from;
  update public.reports set actor = p_into where actor = p_from;
  update public.place_edits set actor = p_into where actor = p_from;
  update public.rate_events set actor = p_into where actor = p_from;
  delete from auth.users where id = p_from and is_anonymous;
end;
$$;
revoke execute on function private.merge_users(uuid, uuid) from public, anon, authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.checkins enable row level security;
alter table public.reviews enable row level security;
alter table public.bookmarks enable row level security;
alter table public.photos enable row level security;
alter table public.reports enable row level security;
alter table public.place_edits enable row level security;
alter table public.rate_events enable row level security;
alter table public.subway_exits enable row level security;
alter table public.peel_results enable row level security;

-- profiles: 닉네임은 공개(리뷰 작성자 표시). is_admin·shadow_banned는 GRANT 자체가 없다. 본인 닉네임만 수정
create policy profiles_select on public.profiles for select to anon, authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- places: 보이는 가게는 누구나(공개 열만 GRANT), 관리자는 전부. 사용자 쓰기는 RPC(submit_report·apply_suggestion)
create policy places_select on public.places for select to anon, authenticated
  using ((hidden_at is null and merged_into is null) or (select private.is_admin()));
create policy places_admin_update on public.places for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- checkins: 다녀왔어요(본인, 보이는 가게). 하루 1회는 유니크 인덱스. 읽기는 관리자만(집계는 뷰)
create policy checkins_insert on public.checkins for insert to authenticated
  with check ((select auth.uid()) = actor and type = 'visited' and (select private.place_visible(place_id)));
create policy checkins_select on public.checkins for select to anon, authenticated using (true);  -- actor 열은 GRANT 없음

-- reviews: 카카오(비익명)만, 핀당 1(유니크), 일 10. 본인 것만 읽고 고친다(삭제 = deleted_at). 공개 읽기는 뷰
create policy reviews_select on public.reviews for select to anon, authenticated
  using (deleted_at is null or (select private.is_admin()));
create policy reviews_insert on public.reviews for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and not (select private.is_anonymous())
    and (select private.place_visible(place_id))
    and (select private.rate_ok('review', 10, interval '1 day'))
  );
create policy reviews_update_own on public.reviews for update to authenticated
  using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);

-- bookmarks: 전부 본인
create policy bookmarks_own on public.bookmarks for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- photos: 올리기(본인, 보이는 가게, 가게당 시간 10, 월 전역 4,500). 읽기·내리기는 관리자(공개는 뷰)
create policy photos_insert on public.photos for insert to authenticated
  with check (
    (select auth.uid()) = uploader_id
    and (select private.place_visible(place_id))
    and (select private.rate_ok('photo', 10, interval '1 hour', place_id))
    and (select private.photos_this_month()) < 4500
  );
create policy photos_select on public.photos for select to anon, authenticated
  using (removed_at is null or (select private.is_admin()));  -- uploader_id 열은 GRANT 없음
create policy photos_admin_update on public.photos for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- reports: 접수(본인, 보이는 가게, 종류별 상한). 읽기·처리는 관리자
create policy reports_insert on public.reports for insert to authenticated
  with check (
    (select auth.uid()) = actor
    and (select private.place_visible(place_id))
    and case kind
      when 'place_flag' then (select private.rate_ok('place_flag', 1, interval '1 day', place_id))
      when 'owner_request' then (select private.rate_ok('owner_request', 2, interval '1 day', place_id))
      else (select private.rate_ok(kind, 10, interval '1 day'))
    end
  );
create policy reports_admin_select on public.reports for select to authenticated using ((select private.is_admin()));
create policy reports_admin_update on public.reports for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- place_edits: 읽기는 관리자만(누가 무엇을 고쳤는지는 운영 기록). 쓰기는 트리거만
create policy place_edits_admin_select on public.place_edits for select to authenticated using ((select private.is_admin()));

-- peel_results: 누구나 한 줄(IP당 일 20). 읽기는 집계 RPC만
create policy peel_results_insert on public.peel_results for insert to anon, authenticated
  with check ((select private.rate_ok('peel', 20, interval '1 day')));

-- rate_events·subway_exits: 정책 없음 = 아무도 직접 못 본다(private 함수만)

-- ── GRANT (2026-04-28부터 표는 자동 노출되지 않는다 — 여기가 노출 목록이다) ──
revoke all on all tables in schema public from anon, authenticated;
grant select on public.places_public, public.reviews_public to anon, authenticated;
grant select (id, nickname) on public.profiles to anon, authenticated;
grant update (nickname) on public.profiles to authenticated;
-- places 공개 열만. reporter_id·duplicate_suspect_of·merged_into·needs_review·verified_at·hidden_at·removed_by_owner·updated_at은 admin_places()로
grant select (id, seed_ref, name, gu, address_road, address_jibun, lat, lng, nearest_station, tags, specialist,
  naver_place_url, hours_note, menus, sides, source, created_at) on public.places to anon, authenticated;
grant update on public.places to authenticated;                        -- 행은 관리자 정책(places_admin_update)이 가른다
grant select (id, place_id, type, at, kst_day) on public.checkins to anon, authenticated;
grant insert on public.checkins to authenticated;
grant select, insert on public.reviews to anon, authenticated;
revoke insert on public.reviews from anon;
grant update (rating, text, photo_key, edited_at, deleted_at) on public.reviews to authenticated;
grant select, insert, delete on public.bookmarks to authenticated;
grant select (id, place_id, key, created_at, removed_at) on public.photos to anon, authenticated;
grant insert on public.photos to authenticated;
grant update (removed_at) on public.photos to authenticated;
grant select, insert on public.reports to authenticated;
grant update (status, resolved_at) on public.reports to authenticated;
grant select on public.place_edits to authenticated;
grant insert on public.peel_results to anon, authenticated;
grant usage on all sequences in schema public to authenticated;
grant execute on function private.is_admin(), private.is_shadow_banned(), private.place_visible(uuid),
  private.rate_ok(text, integer, interval, uuid), private.photos_this_month(), private.request_ip_hash(), private.is_anonymous()
  to anon, authenticated;

-- ── pg_cron ─────────────────────────────────────────────────────────────────
-- 속도 제한 발자국은 하루면 쓸모를 다한다(가장 긴 창이 1일). 03:00 KST = 18:00 UTC
select cron.schedule('purge-rate-events', '0 18 * * *', $$delete from public.rate_events where at < now() - interval '1 day'$$);
-- 30일 무활동 익명 유저 월 1회 정리(spec 5) — 기록이 하나라도 있으면 남긴다. 매월 1일 04:00 KST
select cron.schedule('purge-idle-anonymous', '0 19 1 * *', $$
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - interval '30 days'
    and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '30 days'
    and not exists (select 1 from public.checkins c where c.actor = u.id)
    and not exists (select 1 from public.bookmarks b where b.user_id = u.id)
    and not exists (select 1 from public.places p where p.reporter_id = u.id)
    and not exists (select 1 from public.photos ph where ph.uploader_id = u.id)
    and not exists (select 1 from public.reports r where r.actor = u.id)
    and not exists (select 1 from public.place_edits e where e.actor = u.id)
$$);
