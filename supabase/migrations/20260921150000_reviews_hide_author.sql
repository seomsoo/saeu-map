-- 리뷰 작성자의 auth uid를 아무에게도 내주지 않는다 (보안 리뷰 2026-09-16 #9).
-- 다른 표는 이미 그렇다(checkins.actor · photos.uploader_id · places.reporter_id는 GRANT가 없다). reviews만 표 전체가 SELECT로 열려 있어
-- 뷰에서 열을 빼도 `/rest/v1/reviews?select=author_id`로 그대로 읽혔다 — 그래서 뷰가 아니라 **컬럼 GRANT**를 거둔다.
-- "내 리뷰인가"는 uid 비교 대신 me()가 돌려주는 내 리뷰 id 목록으로 판정한다(상세는 anon 공유 캐시라 행마다 is_mine을 실을 수 없다).

-- 작성자 닉네임 — invoker 뷰는 author_id를 못 읽게 되므로 조인 대신 이 함수가 읽어 준다. 돌려주는 건 이미 공개인 닉네임뿐이다.
-- 전제: profiles.nickname이 누구에게나 공개(profiles_select)다. 그 정책을 좁히면 이 DEFINER가 RLS 우회로가 된다 — 같이 손봐야 한다(security-reviewer 2026-09-22 ⑤).
create or replace function private.review_nickname(p_review_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select pr.nickname from public.reviews r join public.profiles pr on pr.id = r.author_id where r.id = p_review_id;
$$;
revoke execute on function private.review_nickname(uuid) from public;
grant execute on function private.review_nickname(uuid) to anon, authenticated;

-- 열을 빼는 건 create or replace로 안 된다 — 지우고 다시 만든다(이 뷰에 기대는 객체 없음)
drop view public.reviews_public;
create view public.reviews_public with (security_invoker = true) as
select r.id, r.place_id, r.rating, r.text, r.photo_key, r.created_at, r.edited_at,
  private.review_nickname(r.id) as nickname
from public.reviews r
join public.places p on p.id = r.place_id   -- 숨긴 가게의 리뷰는 places RLS가 거른다
where r.deleted_at is null;
comment on view public.reviews_public is '보이는 리뷰 + 작성자 닉네임. 작성자 uid는 없다 — 본인 판정은 me().reviewIds로.';
grant select on public.reviews_public to anon, authenticated;

revoke select on public.reviews from anon, authenticated;
grant select (id, place_id, rating, text, photo_key, created_at, edited_at, deleted_at) on public.reviews to anon, authenticated;

-- 내 프로필 + 내 리뷰 id(최신순) — 화면이 [수정][삭제]·[리뷰 수정]을 이걸로 가른다
create or replace function public.me() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'nickname', p.nickname, 'isAdmin', p.is_admin,
    'reviewIds', coalesce(
      (select jsonb_agg(r.id order by r.created_at desc) from public.reviews r where r.author_id = p.id and r.deleted_at is null),
      '[]'::jsonb)
  )
  from public.profiles p where p.id = (select auth.uid());
$$;
