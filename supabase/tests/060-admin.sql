begin;
select plan(6);

-- 커밋 7 관리자 실연결: 검수 필터(admin_places p_needs_review) · 합치기 뒤 옛 주소 리다이렉트(merge_target)

select tests.create_user('00000000-0000-0000-0000-00000000ad06', false, '운영자') as admin1 \gset
update public.profiles set is_admin = true where id = :'admin1';
select tests.create_place('검수집', true) as reviewing \gset
update public.places set needs_review = true where id = :'reviewing';
select tests.create_place('옛집') as p_from \gset
select tests.create_place('새집') as p_into \gset
select tests.create_place('더새집') as p_final \gset

select tests.authenticate_as(:'admin1', false);
select is((select bool_and(needs_review) from public.admin_places(null, 500, true)), true, '검수 필터는 needs_review 행만');
select ok(exists(select 1 from public.admin_places(null, 500, true) where id = :'reviewing'), '숨긴 채 들어온 검수 대기 시드가 나온다');
select public.admin_merge_places(:'p_from', :'p_into');
select tests.clear_auth();

select tests.authenticate_anon();
select is((select public.merge_target(:'p_from')), :'p_into'::uuid, '옛 주소는 새 가게로(anon도 부른다)');
select is((select public.merge_target(:'p_into')), null::uuid, '보이는 가게는 null — 리다이렉트 없음');
select is((select public.merge_target('00000000-0000-0000-0000-000000000000')), null::uuid, '모르는 id는 null');
select tests.clear_auth();

-- 사슬: 새집을 또 다른 집으로 합치면 옛집도 그리로 간다
select tests.authenticate_as(:'admin1', false);
select public.admin_merge_places(:'p_into', :'p_final');
select tests.clear_auth();
select is((select public.merge_target(:'p_from')), :'p_final'::uuid, '병합 사슬을 따라간다');

select * from finish();
rollback;
