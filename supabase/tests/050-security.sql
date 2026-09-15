begin;
select plan(20);

-- security-reviewer 2026-09-16(중간 리뷰) 반영분. 순서 주의: set_ip는 트랜잭션 끝까지 남으므로 "IP 없음" 케이스가 맨 앞이다.

select tests.create_user('00000000-0000-0000-0000-00000000a006', true) as anon1 \gset
select tests.create_user('00000000-0000-0000-0000-00000000a007', true) as anon2 \gset
select tests.create_user('00000000-0000-0000-0000-00000000c006', false, '카카오') as kakao1 \gset
select tests.create_user('00000000-0000-0000-0000-00000000c007', false, '카카오둘') as kakao2 \gset
select tests.create_place('보안집') as place_id \gset

-- rate_ok fail closed: 사람도 IP도 모르면 거부(#5·#15)
select tests.authenticate_anon();
select throws_ok($$insert into public.peel_results (type) values ('jipge')$$, '42501', null, '방문자가 IP 해시 없이 쓰면 거부(fail closed)');
select tests.set_ip('ip-s');
select lives_ok($$insert into public.peel_results (type) values ('jipge')$$, 'IP 해시가 있으면 통과');
select throws_ok($$insert into public.peel_results (type, created_at) values ('jipge', now())$$, '42501', null, 'created_at은 못 정한다(컬럼 GRANT)');
select throws_ok($$select public.photo_slot_ok()$$, '42501', null, 'anon은 photo_slot_ok를 못 부른다');
select tests.clear_auth();

-- checkins: 시각은 서버만(#15)
select tests.authenticate_as(:'anon2', true);
select throws_ok(format($$insert into public.checkins (place_id, actor, type, at) values (%L, %L, 'visited', now() - interval '30 days')$$, :'place_id', :'anon2'), '42501', null, '확인 시각은 서버가 정한다(컬럼 GRANT)');

-- photo_slot_ok: 자리 있으면 true, 가게당 시간 10장을 채우면 false(#7)
select is((select public.photo_slot_ok(:'place_id')), true, '자리가 있으면 true');
insert into public.photos (place_id, key, uploader_id)
  select :'place_id', 'places/' || :'place_id' || '/' || n || '.webp', :'anon2' from generate_series(1, 10) n;
select is((select public.photo_slot_ok(:'place_id')), false, '한 시간 10장을 채우면 false');
select is((select public.photo_slot_ok()), false, '가게를 안 주면 사람 기준으로 센다 — 같은 사람이라 false');
select tests.clear_auth();

-- 리뷰 사진: 붙이기는 한 번, 교체 거부, 월 상한에 같이 센다(#6)
insert into public.reviews (place_id, author_id, rating, text) values (:'place_id', :'kakao2', 4, '사진 리뷰') returning id as review_id \gset
select tests.authenticate_as(:'kakao2', false);
select tests.set_ip('ip-s2');
select is((select photo_slot_ok()), true, '리뷰 작성자에게 사진 자리가 있다');
select lives_ok(format($$update public.reviews set photo_key = 'reviews/%s/1.webp' where id = %L$$, :'review_id', :'review_id'), '첫 사진은 붙는다');
select throws_ok(format($$update public.reviews set photo_key = 'reviews/%s/2.webp' where id = %L$$, :'review_id', :'review_id'), '23514', null, '두 번째는 교체 거부');
select tests.clear_auth();
select is((select photo_at is not null from public.reviews where id = :'review_id'), true, 'photo_at이 찍힌다');
select is((select private.photos_this_month()), 11, '월 집계 = 가게 사진 10 + 리뷰 사진 1');
select tests.authenticate_as(:'kakao1', false);
select tests.set_ip('ip-s3');
insert into public.reviews (place_id, author_id, rating, text, photo_key) values (:'place_id', :'kakao1', 3, '사진 실은 리뷰', 'reviews/y/1.webp');
select tests.clear_auth();
select is((select photo_at is not null from public.reviews where text = '사진 실은 리뷰'), true, 'insert에 사진을 실어도 같은 트리거가 photo_at을 찍는다(직접 호출 경로)');

-- 서비스 역할 RPC: 문은 EXECUTE 권한 — anon·authenticated 거부, service_role 통과(#2)
select tests.authenticate_anon();
select throws_ok(format($$select public.admin_delete_user(%L)$$, :'anon1'), '42501', null, 'anon은 admin_delete_user 거부');
select tests.clear_auth();
select tests.authenticate_as(:'kakao1', false);
select throws_ok(format($$select public.admin_merge_users(%L, %L)$$, :'anon1', :'kakao1'), '42501', null, 'authenticated는 admin_merge_users 거부');
select tests.clear_auth();
insert into public.bookmarks (user_id, place_id) values (:'anon1', :'place_id');
set local role service_role;
select lives_ok(format($$select public.admin_merge_users(%L, %L)$$, :'anon1', :'kakao1'), 'service_role은 병합한다');
select lives_ok(format($$select public.admin_delete_user(%L)$$, :'kakao2'), 'service_role은 탈퇴 처리한다');
reset role;
select is((select count(*)::int from public.bookmarks where user_id = :'kakao1'), 1, '찜이 카카오로 넘어가고 익명 유저는 지워진다');
select is((select photo_key is null and deleted_at is not null from public.reviews where id = :'review_id'), true, '탈퇴한 리뷰는 소프트 삭제 + 사진 키 제거');

select * from finish();
rollback;
