begin;
select plan(13);

select tests.create_user('00000000-0000-0000-0000-00000000a003', true) as anon1 \gset
select tests.create_user('00000000-0000-0000-0000-00000000a004', true) as banned \gset
select tests.create_user('00000000-0000-0000-0000-00000000ad03', false, '운영자') as admin1 \gset
select tests.create_user('00000000-0000-0000-0000-00000000c003', false, '카카오') as kakao1 \gset
update public.profiles set is_admin = true where id = :'admin1';
update public.profiles set shadow_banned = true where id = :'banned';
select tests.create_place('원본집') as p_from \gset
select tests.create_place('진짜집') as p_into \gset

-- 신고: 익명 접수 → 비관리자는 0행, 관리자는 본다
select tests.authenticate_as(:'anon1', true);
select tests.set_ip('ip-r');
insert into public.reports (kind, place_id, reason, actor) values ('place_report', :'p_from', 'fake', :'anon1');
select is((select count(*)::int from public.reports), 0, '비관리자는 신고를 못 읽는다');
select throws_ok($$select public.admin_stats()$$, '42501', null, '비관리자는 admin_stats 거부');
-- 정보 달라요 핀당 일 1
insert into public.reports (kind, place_id, reason, actor) values ('place_flag', :'p_from', 'menu', :'anon1');
select throws_ok(format($$insert into public.reports (kind, place_id, reason, actor) values ('place_flag', %L, 'menu', %L)$$, :'p_from', :'anon1'), '42501', null, '정보 달라요는 핀당 일 1');
select tests.clear_auth();

-- 섀도 밴: 오류 없이 0행, 제보는 숨긴 채 생성
select tests.authenticate_as(:'banned', true);
select lives_ok(format($$insert into public.reports (kind, place_id, reason, actor) values ('place_report', %L, 'fake', %L)$$, :'p_from', :'banned'), '밴 사용자의 신고는 오류 없이');
select public.submit_report('밴제보', 37.5, 127, '마포구', '{grill}', '[]'::jsonb, '{}', '', '', null) as banned_place \gset
select tests.clear_auth();
select is((select count(*)::int from public.reports where actor = :'banned'), 0, '…하지만 저장되지 않는다');
select is((select hidden_at is not null from public.places where id = :'banned_place'), true, '밴 사용자의 제보는 숨긴 채 생긴다');

-- 관리자: 신고를 보고 처리, 가게 합치기
select tests.authenticate_as(:'admin1', false);
select is((select count(*)::int from public.reports where place_id = :'p_from'), 2, '관리자는 신고를 본다');
update public.reports set status = 'done', resolved_at = now() where place_id = :'p_from' and kind = 'place_report';
select is((select status from public.reports where place_id = :'p_from' and kind = 'place_report'), 'done', '관리자가 처리한다');
select tests.clear_auth();
insert into public.checkins (place_id, actor, type) values (:'p_from', :'anon1', 'visited');
insert into public.bookmarks (user_id, place_id) values (:'anon1', :'p_from'), (:'anon1', :'p_into');
select tests.authenticate_as(:'admin1', false);
select public.admin_merge_places(:'p_from', :'p_into');
select tests.clear_auth();
select is((select merged_into from public.places where id = :'p_from'), :'p_into'::uuid, '원본에 merged_into');
select tests.authenticate_as(:'anon1', true);
select is((select count(*)::int from public.places_public where id = :'p_from'), 0, '원본은 공개 뷰에서 사라진다(RLS — postgres·service_role은 뷰로도 숨긴 행을 본다)');
select tests.clear_auth();
select is((select check_count from public.places_public where id = :'p_into'), 1, '확인이 옮겨진다');
select is((select count(*)::int from public.bookmarks where user_id = :'anon1'), 1, '찜은 중복 없이 합쳐진다');

-- 익명 → 카카오 병합
insert into public.reviews (place_id, author_id, rating, text) values (:'p_into', :'kakao1', 5, '카카오 리뷰');
select private.merge_users(:'anon1', :'kakao1');
select is((select count(*)::int from auth.users where id = :'anon1'), 0, '병합 뒤 익명 유저는 지워진다');

select * from finish();
rollback;
