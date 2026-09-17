-- pgTAP 공통 헬퍼. 다른 파일과 달리 롤백하지 않는다(다음 파일이 쓴다). supabase test db가 알파벳 순으로 돌린다.
create extension if not exists pgtap;
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- auth.users 행을 만든다(트리거가 profiles를 만든다). 익명이면 is_anonymous = true.
create or replace function tests.create_user(p_id uuid, p_anonymous boolean, p_nickname text default null)
returns uuid language plpgsql set search_path = '' as $$
begin
  insert into auth.users (id, instance_id, aud, role, is_anonymous, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_anonymous,
    case when p_nickname is null then '{}'::jsonb else jsonb_build_object('nickname', p_nickname) end,
    '{"provider":"kakao","providers":["kakao"]}'::jsonb, now(), now());
  return p_id;
end;
$$;

-- 이 사용자로 요청하는 척: role + JWT 클레임(sub·is_anonymous). RLS·auth.uid()·auth.jwt()가 이걸 읽는다.
create or replace function tests.authenticate_as(p_id uuid, p_anonymous boolean default false)
returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'is_anonymous', p_anonymous)::text, true);
  execute 'set local role authenticated';
end;
$$;

create or replace function tests.authenticate_anon() returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end;
$$;

create or replace function tests.clear_auth() returns void language plpgsql set search_path = '' as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- 요청 IP 해시 흉내(private.request_ip_hash가 읽는 헤더)
create or replace function tests.set_ip(p_hash text) returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('request.headers', json_build_object('x-ip-hash', p_hash)::text, true);
end;
$$;

-- 보이는 가게 하나(postgres로 만든다). 시드가 없는 테스트 트랜잭션 안에서 쓴다.
create or replace function tests.create_place(p_name text default '테스트새우', p_hidden boolean default false)
returns uuid language plpgsql set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.places (name, gu, lat, lng, tags, menus, sides, source, hidden_at)
  values (p_name, '마포구', 37.55, 126.95, '{grill}', '[{"raw":"새우소금구이 1kg 60,000","name":"새우소금구이","price":60000,"unit":"kg","unit_raw":"1"}]'::jsonb, '{ramen}', 'seed',
    case when p_hidden then now() end)
  returning id into v_id;
  return v_id;
end;
$$;

-- 역할을 바꾼 뒤(authenticated·anon)에도 헬퍼를 부를 수 있어야 한다
grant execute on all functions in schema tests to anon, authenticated;

-- pg_prove가 이 파일도 TAP으로 읽는다 — 플랜 없는 파일은 파싱 실패로 친다
select plan(1);
select ok(true, 'tests 헬퍼 준비');
select * from finish();
