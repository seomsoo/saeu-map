-- secret key(service_role)만 부를 수 있는 RPC 둘. private 스키마는 API에 안 나가므로 public에 얇은 문을 낸다.
-- 문은 EXECUTE 권한이다(public·anon·authenticated에서 회수, service_role에만 부여 — tests/050이 세 역할을 다 본다).
-- 함수 안에서 current_user를 보면 안 된다: SECURITY DEFINER 안의 current_user는 호출자가 아니라 소유자(postgres)라
-- 검사가 항상 실패했다 — 탈퇴가 늘 "delete failed", 익명 승계는 조용히 실패(security-reviewer 2026-09-16 #2, 로컬 재현).

-- 익명 → 카카오 승계 (auth 콜백에서, decisions 2026-09-10)
create or replace function public.admin_merge_users(p_from uuid, p_into uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.merge_users(p_from, p_into);
end;
$$;
revoke execute on function public.admin_merge_users(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_merge_users(uuid, uuid) to service_role;

-- 탈퇴 (spec 5 "개인 데이터 완전 삭제"): 리뷰 소프트 삭제(관리자 기록용) + 리뷰 사진 키 제거(R2 객체는 액션이 먼저 키를 읽어 지운다),
-- 신고의 연락처·내용 제거, 유저 삭제. 나머지 개인 식별자는 FK on delete set null이 뗀다(확인·제보·가게 사진·수정 이력은 집계·되돌리기용으로 남는다).
create or replace function public.admin_delete_user(p_uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.reviews set deleted_at = coalesce(deleted_at, now()), photo_key = null where author_id = p_uid;
  update public.reports set contact = null, message = null where actor = p_uid;
  delete from auth.users where id = p_uid;
end;
$$;
revoke execute on function public.admin_delete_user(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_user(uuid) to service_role;
