begin;
select plan(16);

select tests.create_user('00000000-0000-0000-0000-00000000a001', true) as anon1 \gset
select tests.create_user('00000000-0000-0000-0000-00000000ad01', false, '운영자') as admin1 \gset
update public.profiles set is_admin = true where id = :'admin1';
select tests.create_place('보이는집') as visible_id \gset
select tests.create_place('숨긴집', true) as hidden_id \gset

-- anon: 뷰는 보이고 숨긴 가게는 빠진다, 표는 못 본다
select tests.authenticate_anon();
select is((select count(*)::int from public.places_public where id in (:'visible_id', :'hidden_id')), 1, 'anon은 places_public에서 보이는 가게만 본다');
select throws_ok($$select reporter_id from public.places$$, '42501', null, 'anon은 reporter_id 열을 못 읽는다');
select throws_ok($$select public.submit_report('x', 37.5, 127, '마포구', '{grill}', '[]'::jsonb, '{}', '', '', null)$$, '42501', null, 'anon은 submit_report를 못 부른다');
select tests.clear_auth();

-- 익명 사용자(authenticated + is_anonymous): 제보 → 보이고, 신규, 확인 0 → last_checked_at null
select tests.authenticate_as(:'anon1', true);
select tests.set_ip('ip-a');
select public.submit_report('새 제보집', 37.51, 127.01, '강남구', '{grill,raw}',
  '[{"raw":"새우구이 1kg 50000","name":"새우구이","price":50000,"unit":"kg","unit_raw":"1"}]'::jsonb, '{headButter}', '23시 라스트오더', '', null) as reported \gset
select is((select is_new from public.places_public where id = :'reported'), true, '제보 핀은 is_new');
select is((select check_count from public.places_public where id = :'reported'), 0, '제보 핀은 확인 0');
select is((select last_checked_at from public.places_public where id = :'reported'), null, '확인 0회면 last_checked_at이 비어 "○일 전 등록"');
select is((select count(*)::int from public.places where id = :'reported'), 1, '익명도 보이는 가게의 공개 열은 읽는다');
select throws_ok($$select hidden_at from public.places$$, '42501', null, '익명은 hidden_at 열을 못 읽는다');
select is((select count(*)::int from public.my_reports() where id = :'reported'), 1, 'my_reports에 내 제보가 있다');

-- 제보 시간당 5: 4번 더는 되고 6번째는 거부
select lives_ok($$select public.submit_report('제보2', 37.51, 127.01, '강남구', '{grill}', '[]'::jsonb, '{}', '', '', null)$$, '2번째');
select public.submit_report('제보3', 37.51, 127.01, '강남구', '{grill}', '[]'::jsonb, '{}', '', '', null);
select public.submit_report('제보4', 37.51, 127.01, '강남구', '{grill}', '[]'::jsonb, '{}', '', '', null);
select public.submit_report('제보5', 37.51, 127.01, '강남구', '{grill}', '[]'::jsonb, '{}', '', '', null);
select throws_ok($$select public.submit_report('제보6', 37.51, 127.01, '강남구', '{grill}', '[]'::jsonb, '{}', '', '', null)$$, 'P0003', null, '6번째 제보는 시간당 5에 걸린다');

-- 수정 제안: 즉시 반영 + 이력에 이전 값 + actor
select public.apply_suggestion(:'visible_id', 'hours', to_jsonb('월 휴무'::text));
select tests.clear_auth();
select is((select hours_note from public.places where id = :'visible_id'), '월 휴무', '영업시간이 즉시 반영된다');
select is((select (before ->> 'hoursNote') is null and field = 'hours' and actor = :'anon1' from public.place_edits where place_id = :'visible_id'), true, '이력에 이전 값(null)·field·actor가 남는다');

-- 관리자: 숨긴 가게까지 보고 숨김을 푼다
select tests.authenticate_as(:'admin1', false);
select is((select count(*)::int from public.admin_places() where id in (:'visible_id', :'hidden_id')), 2, '관리자는 admin_places로 숨긴 가게까지 본다');
select is((select (public.me() ->> 'isAdmin')::boolean), true, 'me()가 관리자를 알려준다');
update public.places set hidden_at = null where id = :'hidden_id';
select is((select hidden_at from public.admin_places() where id = :'hidden_id'), null, '관리자가 숨김을 풀 수 있다(읽기는 admin_places — hidden_at 열은 GRANT 밖)');

select * from finish();
rollback;
