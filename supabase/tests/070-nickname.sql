begin;
select plan(12);

-- 카카오 닉네임 초기값 — 폼(nicknameSchema)과 같은 규칙으로 고쳐서 받는다(보안 리뷰 2026-09-16 #10)

select is(private.clean_nickname('새우왕'), '새우왕', '멀쩡한 닉네임은 그대로');
select is(private.clean_nickname('  민수   서  '), '민수 서', '앞뒤 공백을 떼고 가운데 공백은 한 칸으로');
select is(private.clean_nickname('민수🍤_!'), '민수', '이모지·기호는 떼어 낸다');
select is(private.clean_nickname(E'관​리‮자'), '관리자', '폭 없는 공백·방향 제어문자로 남 흉내를 못 낸다');
select is(private.clean_nickname('ｓｈｒｉｍｐ①'), 'shrimp1', 'NFKC — 전각·원문자를 접는다');
select is(private.clean_nickname('일이삼사오육칠팔구십일이삼사'), '일이삼사오육칠팔구십일이', '12자에서 자른다');
select is(private.clean_nickname('🍤'), null, '남는 게 2자 미만이면 없음');
select is(private.clean_nickname('씨-발 새우'), null, '금칙어는 기호를 끼워도 걸린다');
select is(private.clean_nickname('ㅅㅂ맨'), null, '호환 자모 금칙어도 걸린다(NFKC 뒤 비교)');
select is(private.clean_nickname(null), null, '닉네임을 안 준 공급자');

-- 트리거: auth.users에 들어온 메타데이터가 고쳐져서 profiles에 남는다
select tests.create_user('00000000-0000-0000-0000-00000000c070', false, E'새​우 🍤 박사') as kakao1 \gset
select is((select nickname from public.profiles where id = :'kakao1'), '새우 박사', '트리거가 고친 닉네임을 넣는다');
select tests.create_user('00000000-0000-0000-0000-00000000c071', false, '병신') as kakao2 \gset
select is((select nickname from public.profiles where id = :'kakao2'), null, '금칙어 닉네임은 없음으로 — 가입은 막지 않는다');

select * from finish();
rollback;
