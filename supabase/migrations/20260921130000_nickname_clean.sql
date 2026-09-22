-- 카카오 닉네임 초기값을 폼(lib/schemas.ts nicknameSchema)과 같은 규칙으로 (보안 리뷰 2026-09-16 #10).
-- auth.users 행은 GoTrue가 만들어서 우리 서버 액션을 지나지 않는다 — 카카오 닉네임이 그대로 profiles에 들어가 리뷰에 찍혔다.
-- 폭 없는 공백·방향 제어문자(남 흉내)·이모지·욕설이 들어올 수 있는 유일한 길이라 트리거에서 막는다.
-- 폼은 어긋나면 거절하지만 여기는 거절할 상대가 없으므로 **고쳐서** 받는다: NFKC → 글자·숫자·공백만 → 공백 접기 → 12자.
-- 남은 게 2자 미만이거나 금칙어면 null(닉네임 없음 — 내 활동에서 직접 정한다).

-- 금칙어 — lib/content-filter.ts BANNED와 같은 목록이다. 한쪽만 고치면 lib/__tests__/banned-words-sync.test.ts가 깨진다.
create or replace function private.banned_words() returns text[] language sql immutable set search_path = '' as $$
  select array[
    '시발', '씨발', '씨팔', '시팔', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '개새끼', '개새키', '새끼야', '좆', '존나', '지랄',
    '느금', '니미', '엠창', '미친년', '미친놈', '창녀', '걸레년'
  ];
$$;

-- content-filter.ts flatten과 같은 길: NFKC(호환 자모 ㅅ → 조합 자모) → 공백·. - _ * 제거 → 소문자
create or replace function private.flatten_text(t text) returns text language sql immutable set search_path = '' as $$
  select lower(regexp_replace(normalize(t, NFKC), '[\s.\-_*]', '', 'g'));
$$;

create or replace function private.has_banned_word(t text) returns boolean language sql immutable set search_path = '' as $$
  select exists (
    select 1 from unnest(private.banned_words()) w
    where position(private.flatten_text(w) in private.flatten_text(t)) > 0
  );
$$;

create or replace function private.clean_nickname(raw text) returns text language plpgsql immutable set search_path = '' as $$
declare
  nick text;
begin
  if raw is null then return null; end if;
  -- [[:alnum:]]는 DB ctype(en_US.UTF-8)에서 한글·한자·가나를 글자로 본다(로컬·실서비스 17.6에서 확인, 2026-09-21)
  nick := regexp_replace(normalize(raw, NFKC), '[^[:alnum:] ]', '', 'g');
  nick := btrim(regexp_replace(nick, ' +', ' ', 'g'));
  nick := btrim(left(nick, 12));
  if char_length(nick) < 2 or private.has_banned_word(nick) then return null; end if;
  return nick;
end;
$$;

create or replace function private.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  nick text := private.clean_nickname(coalesce(meta ->> 'nickname', meta ->> 'name', meta ->> 'preferred_username', meta ->> 'user_name'));
begin
  insert into public.profiles (id, nickname) values (new.id, nick)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function private.banned_words(), private.flatten_text(text), private.has_banned_word(text), private.clean_nickname(text)
  from public, anon, authenticated;

-- 이 전에 가입한 프로필도 같은 규칙으로 한 번 고친다 — 트리거만 바꾸면 이미 들어온 이모지·금칙어 닉네임이 리뷰 옆에 남는다(Codex PR #18 #2).
-- 폼(updateNickname)으로 바꾼 닉네임은 이미 같은 규칙을 지났으니 그대로다. 결과가 같은 행은 건드리지 않는다(updated_at 없음, 캐시 무관).
update public.profiles set nickname = private.clean_nickname(nickname)
where nickname is not null and nickname is distinct from private.clean_nickname(nickname);
