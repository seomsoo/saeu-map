begin;
select plan(11);

select tests.create_user('00000000-0000-0000-0000-00000000a002', true) as anon1 \gset
select tests.create_user('00000000-0000-0000-0000-00000000c001', false, '새우헌터') as kakao1 \gset
select tests.create_user('00000000-0000-0000-0000-00000000c002', false, '둘째') as kakao2 \gset
select tests.create_place('리뷰집') as place_id \gset

-- 익명은 리뷰 불가(RESTRICTIVE 대신 정책 안 조건)
select tests.authenticate_as(:'anon1', true);
select throws_ok(format($$insert into public.reviews (place_id, author_id, rating, text) values (%L, %L, 5, '익명')$$, :'place_id', :'anon1'), '42501', null, '익명은 리뷰를 못 쓴다');
-- 익명 다녀왔어요: 첫 번째 OK, 같은 날 두 번째는 유니크
select lives_ok(format($$insert into public.checkins (place_id, actor, type) values (%L, %L, 'visited')$$, :'place_id', :'anon1'), '익명 다녀왔어요');
select throws_ok(format($$insert into public.checkins (place_id, actor, type) values (%L, %L, 'visited')$$, :'place_id', :'anon1'), '23505', null, '같은 가게 같은 날 두 번째 확인은 거부');
select throws_ok(format($$insert into public.checkins (place_id, actor, type) values (%L, %L, 'visited')$$, :'place_id', :'kakao1'), '42501', null, '남의 actor로는 못 쓴다');
select tests.clear_auth();

-- 카카오: 리뷰 → checkins(review)도 생긴다, 핀당 1
select tests.authenticate_as(:'kakao1', false);
insert into public.reviews (place_id, author_id, rating, text) values (:'place_id', :'kakao1', 4, '좋았어요');
select throws_ok(format($$insert into public.reviews (place_id, author_id, rating, text) values (%L, %L, 3, '두 번째')$$, :'place_id', :'kakao1'), '23505', null, '핀당 리뷰 1개');
update public.reviews set text = '고침', edited_at = now() where place_id = :'place_id' and author_id = :'kakao1';
select is((select text from public.reviews where author_id = :'kakao1'), '고침', '본인 리뷰 수정');
select tests.clear_auth();
select tests.authenticate_as(:'kakao2', false);
update public.reviews set text = '남이 고침' where author_id = :'kakao1';
select tests.clear_auth();
select is((select text from public.reviews where author_id = :'kakao1'), '고침', '남의 리뷰는 못 고친다(0행)');

select is((select count(*)::int from public.checkins where place_id = :'place_id' and type = 'review'), 1, '리뷰 등록이 확인 사건을 만든다');
select is((select check_count from public.places_public where id = :'place_id'), 2, '확인 수 = 다녀왔어요 1 + 리뷰 1');
select is((select nickname from public.reviews_public where place_id = :'place_id'), '새우헌터', 'reviews_public에 닉네임이 붙는다');
select is((select rating_avg from public.places_public where id = :'place_id'), null, '리뷰 3개 미만이면 평점 없음');

select * from finish();
rollback;
