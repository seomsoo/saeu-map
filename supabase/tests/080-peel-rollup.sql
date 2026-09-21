begin;
select plan(9);

-- 까주기 결과 월 접기 — 지난달까지는 합계로, 이번 달은 원본 그대로. 집계 수는 접기 전후가 같아야 한다.

select (date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') as month_start \gset
select (date_trunc('month', (:'month_start'::timestamptz - interval '1 second') at time zone 'Asia/Seoul'))::date as last_month \gset

insert into public.peel_results (type, created_at) values
  ('jipge', :'month_start'::timestamptz - interval '1 second'),   -- 지난달 마지막 1초
  ('jipge', :'month_start'::timestamptz - interval '40 days'),
  ('sonjil', :'month_start'::timestamptz - interval '1 second'),
  ('jipge', :'month_start'::timestamptz),                         -- 이번 달 첫 순간 — 남는다
  ('chojang', now());

select is((select (public.peel_stats() ->> 'total')::int), 5, '접기 전 합계');

select private.rollup_peel_results();
select is((select count(*)::int from public.peel_results), 2, '이번 달 원본만 남는다');
select is((select sum(n)::int from public.peel_monthly where type = 'jipge'), 2, '지난달까지의 jipge 2건이 합계로');
select is((select count(*)::int from public.peel_monthly), 3, '월·유형별로 한 행씩(jipge 두 달 + sonjil)');
select is(public.peel_stats(), '{"total": 5, "byType": {"jipge": 3, "sonjil": 1, "chojang": 1}}'::jsonb, '접은 뒤에도 집계는 같다');

select private.rollup_peel_results();
select is((select (public.peel_stats() ->> 'total')::int), 5, '다시 돌려도 그대로(멱등)');

insert into public.peel_results (type, created_at) values ('jipge', :'month_start'::timestamptz - interval '1 second');
select private.rollup_peel_results();
select is((select n::int from public.peel_monthly where type = 'jipge' and month = :'last_month'::date), 2, '같은 달에 늦게 온 행은 기존 합계에 더한다');

select tests.authenticate_anon();
select throws_ok($$select * from public.peel_monthly$$, '42501', null, '합계 표는 아무에게도 안 열려 있다');
select is((select (public.peel_stats() ->> 'total')::int), 6, '방문자는 RPC로만 집계를 읽는다');

select * from finish();
rollback;
