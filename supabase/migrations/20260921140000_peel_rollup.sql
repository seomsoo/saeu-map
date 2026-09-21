-- 까주기 결과 표 정리 (최종 보안 리뷰 2026-09-16 #6 백로그).
-- peel_results는 완주마다 한 행이고 바이럴 장치라 상한 없이 자란다(Free DB 500MB). 지난달까지는 월·유형별 합계로 접고 원본을 지운다.
-- 집계에 필요한 건 유형별 수뿐이라 잃는 정보는 "그 달 안의 시각"뿐이다.

create table public.peel_monthly (
  month date not null,  -- KST 기준 그 달 1일
  type text not null check (type in ('jipge', 'sonjil', 'wansik', 'chojang')),
  n bigint not null check (n > 0),
  primary key (month, type)
);
comment on table public.peel_monthly is '까주기 결과의 지난달까지 월·유형별 합계. peel_stats()(DEFINER)와 월 1회 크론만 읽고 쓴다 — 정책·GRANT 없음.';
alter table public.peel_monthly enable row level security;
revoke all on public.peel_monthly from anon, authenticated;

-- 지우기와 더하기가 한 문장이라 중간에 죽어도 세는 수가 달라지지 않는다
create or replace function private.rollup_peel_results() returns void language sql security definer set search_path = '' as $$
  with moved as (
    delete from public.peel_results
    where created_at < (date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
    returning type, created_at
  )
  insert into public.peel_monthly (month, type, n)
  select (date_trunc('month', created_at at time zone 'Asia/Seoul'))::date, type, count(*)
  from moved group by 1, 2
  on conflict (month, type) do update set n = public.peel_monthly.n + excluded.n;
$$;
revoke execute on function private.rollup_peel_results() from public, anon, authenticated;

-- 참여 집계 = 접힌 합계 + 아직 안 접힌 이번 달 원본
create or replace function public.peel_stats() returns jsonb language sql stable security definer set search_path = '' as $$
  with counts as (
    select type, sum(n) as n from (
      select type, n from public.peel_monthly
      union all
      select type, count(*) from public.peel_results group by type
    ) folded_and_raw group by type
  )
  select jsonb_build_object(
    'total', coalesce((select sum(n) from counts), 0),
    'byType', coalesce((select jsonb_object_agg(type, n) from counts), '{}'::jsonb)
  );
$$;

-- 매월 1일 19:30 UTC(= 2일 04:30 KST) — 익명 정리(19:00 UTC) 뒤. KST로 달이 바뀐 지 하루 넘게 지나 경계에 걸리는 행이 없다
select cron.schedule('rollup-peel-results', '30 19 1 * *', $$select private.rollup_peel_results()$$);
