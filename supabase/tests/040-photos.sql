begin;
select plan(5);

select tests.create_user('00000000-0000-0000-0000-00000000a005', true) as anon1 \gset
select tests.create_place('사진집') as place_id \gset

select tests.authenticate_as(:'anon1', true);
select tests.set_ip('ip-p');
-- 가게당 시간당 10장 = 10장까지 OK
insert into public.photos (place_id, key, uploader_id)
  select :'place_id', 'places/' || :'place_id' || '/' || n || '.webp', :'anon1' from generate_series(1, 10) n;
select is((select count(*)::int from public.photos where place_id = :'place_id'), 10, '10장까지 올라간다');
select throws_ok(format($$insert into public.photos (place_id, key, uploader_id) values (%L, 'places/x/11.webp', %L)$$, :'place_id', :'anon1'), '23514', null, '11번째는 가게당 10장 상한(BEFORE 트리거가 RLS보다 먼저)');
select tests.clear_auth();
select is((select jsonb_array_length(photos) from public.places_public where id = :'place_id'), 10, '공개 뷰에 사진 10장');
select is((select photos -> 0 ? 'uploaderId' from public.places_public where id = :'place_id'), false, '공개 뷰는 uploader를 싣지 않는다');
select is((select count(*)::int from public.photos where place_id = :'place_id'), 10, 'postgres는 표를 본다');

select * from finish();
rollback;
