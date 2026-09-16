begin;
select plan(14);

-- 커밋 7 관리자 실연결: 검수 필터(admin_places p_needs_review) · 합치기 뒤 옛 주소 리다이렉트(merge_target)

select tests.create_user('00000000-0000-0000-0000-00000000ad06', false, '운영자') as admin1 \gset
update public.profiles set is_admin = true where id = :'admin1';
select tests.create_place('검수집', true) as reviewing \gset
update public.places set needs_review = true where id = :'reviewing';
select tests.create_place('옛집') as p_from \gset
select tests.create_place('새집') as p_into \gset
select tests.create_place('더새집') as p_final \gset

select tests.create_user('00000000-0000-0000-0000-00000000c060', false, '리뷰어') as reviewer \gset
update public.places set needs_review = true where id = :'p_from';
insert into public.reviews (place_id, author_id, rating, text) values (:'p_from', :'reviewer', 4, '옛집 리뷰') returning id as r_old \gset
select tests.set_ip('ip-060');  -- 사진 트리거의 rate_ok는 사람도 IP도 없으면 거부한다
update public.reviews set photo_key = 'reviews/' || :'r_old' || '/1.webp' where id = :'r_old';
insert into public.reviews (place_id, author_id, rating, text) values (:'p_into', :'reviewer', 5, '새집 리뷰');

select tests.authenticate_as(:'admin1', false);
select is((select bool_and(needs_review) from public.admin_places(null, 500, true)), true, '검수 필터는 needs_review 행만');
select ok(exists(select 1 from public.admin_places(null, 500, true) where id = :'reviewing'), '숨긴 채 들어온 검수 대기 시드가 나온다');
select is((select count(*)::int from public.admin_places(null, 1, false, :'p_from')), 1, 'p_id로 한 행만(목록 상한과 무관)');
select is((select count(*)::int from public.admin_places(null, 500, false, null, array[:'p_from', :'p_into']::uuid[])), 2, 'p_ids로 여러 행');
select throws_ok(format($$select * from public.admin_merge_places('00000000-0000-0000-0000-000000000000', %L)$$, :'p_into'), '22023', null, '없는 원본은 합칠 수 없다');
select is((select freed_photo_key from public.admin_merge_places(:'p_from', :'p_into')), 'reviews/' || :'r_old' || '/1.webp', '합치며 지운 중복 리뷰의 사진 키를 돌려준다');
select throws_ok(format($$select * from public.admin_merge_places(%L, %L)$$, :'p_from', :'p_into'), '22023', null, '이미 합쳐진 가게는 또 못 합친다');
select tests.clear_auth();
select is((select needs_review from public.places where id = :'p_from'), false, '합치면 검수 표시도 내려간다');

select tests.authenticate_anon();
select is((select public.merge_target(:'p_from')), :'p_into'::uuid, '옛 주소는 새 가게로(anon도 부른다)');
select is((select public.merge_target(:'p_into')), null::uuid, '보이는 가게는 null — 리다이렉트 없음');
select is((select public.merge_target('00000000-0000-0000-0000-000000000000')), null::uuid, '모르는 id는 null');
select tests.clear_auth();

-- 사슬: 새집을 또 다른 집으로 합치면 옛집도 그리로 간다
select tests.authenticate_as(:'admin1', false);
select count(*) from public.admin_merge_places(:'p_into', :'p_final');
select tests.clear_auth();
select is((select public.merge_target(:'p_from')), :'p_final'::uuid, '병합 사슬을 따라간다');

-- 사장님 요청으로 내린 가게 자리에 온 재제보 → duplicate_suspect_of로 경고(spec 5)
select tests.create_place('사장님내린집', true) as removed \gset
update public.places set removed_by_owner = true where id = :'removed';
select tests.create_user('00000000-0000-0000-0000-00000000a060', true) as reporter \gset
select tests.authenticate_as(:'reporter', true);
select tests.set_ip('ip-061');
select public.submit_report('재제보집', 37.5501, 126.95, '마포구', '{grill}', '[{"raw":"새우구이 1kg 50,000","name":"새우구이","price":50000,"unit":"kg","unit_raw":"1"}]'::jsonb, '{}', '', '', null) as reported \gset
select public.submit_report('먼집', 37.60, 126.95, '마포구', '{grill}', '[{"raw":"새우구이 1kg 50,000","name":"새우구이","price":50000,"unit":"kg","unit_raw":"1"}]'::jsonb, '{}', '', '', null) as far \gset
select tests.clear_auth();
select is((select duplicate_suspect_of from public.places where id = :'reported'), :'removed'::uuid, '150m 안 재제보는 내린 가게를 후보로 단다');
select is((select duplicate_suspect_of from public.places where id = :'far'), null::uuid, '멀면 후보 없음');

select * from finish();
rollback;
