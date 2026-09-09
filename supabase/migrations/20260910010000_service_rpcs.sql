-- secret key(service_role)만 부를 수 있는 RPC 둘. private 스키마는 API에 안 나가므로 public에 얇은 문을 낸다.
-- 둘 다 current_user가 service_role인지 본다 — anon·authenticated는 EXECUTE도 없다.

-- 익명 → 카카오 승계 (auth 콜백에서, decisions 2026-09-10)
create or replace function public.admin_merge_users(p_from uuid, p_into uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if current_user <> 'service_role' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  perform private.merge_users(p_from, p_into);
end;
$$;
revoke execute on function public.admin_merge_users(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_merge_users(uuid, uuid) to service_role;

-- 탈퇴 (spec 5 "개인 데이터 완전 삭제"): 리뷰 소프트 삭제(관리자 기록용), 신고의 연락처·내용 제거, 유저 삭제.
-- 나머지 개인 식별자는 FK on delete set null이 뗀다(확인·제보·사진·수정 이력은 집계·되돌리기용으로 남는다).
create or replace function public.admin_delete_user(p_uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if current_user <> 'service_role' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  update public.reviews set deleted_at = coalesce(deleted_at, now()) where author_id = p_uid;
  update public.reports set contact = null, message = null where actor = p_uid;
  delete from auth.users where id = p_uid;
end;
$$;
revoke execute on function public.admin_delete_user(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_user(uuid) to service_role;
