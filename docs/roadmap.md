# 새우맵 로드맵

규칙: 순서는 바꿔도 되지만 완료 조건은 낮추지 않는다. 항목이 끝나면 [x]. 새 세션은 이 파일에서 다음 미완료 항목을 집는다.
상세 계획은 각 Phase 시작 시 플랜 모드로 docs/plans/phaseN-*.md 에 작성.

## Phase 0 — 스캐폴드 · 하네스
- [x] Next.js(App Router, TS) + Tailwind + Pretendard self-host + coolicons(Iconify ci)
- [x] 프리셋: @tsconfig/strictest, typescript-eslint strict-type-checked, eslint-plugin-jsx-a11y, eslint-plugin-boundaries, t3-env, react-hook-form+zod, cva, PR 템플릿
- [x] CLAUDE.md + docs/ 배치 (spec, design-prompts, roadmap, decisions, plans/)
- [x] lib/mock/ 에 places·checkins·reviews JSON + lib/data.ts 읽기 함수
- [x] 훅: 편집 후 lint / Stop 시 typecheck·lint·test / 시크릿 쓰기 차단 + gitleaks
- [x] ci.yml (typecheck→lint→test→gitleaks→build→스모크)
- [x] .claude/agents/reviewer.md (+ gap-sweeper.md 스펙 대조 감사)
- [x] Codex PR 리뷰 연결: GitHub 앱 설치 + repo에서 Code review·Automatic reviews 켜기 + AGENTS.md 배치 (동작 검증은 Phase 1 첫 PR에서)
- [x] 네이버 지도(NCP Maps, Client ID) + 목 핀 렌더 → ~~Vercel~~ **Cloudflare Workers 배포** (decisions.md 2026-09-01) + 콘솔 사용량 알림 설정
- 완료: ✅ 2026-09-01 — 폰에서 https://saeu-map.saeu-map.workers.dev 핀 50개 확인, CI 초록, 로컬 3종 통과

## Phase 1 — 지도 메인 (spec 4.1 · design 화면 1)
- [ ] 자동 배포 배선: GH Actions main→deploy / PR→프리뷰 업로드 (decisions.md 2026-09-01, 시크릿 등록 선행)
- [ ] 마커: 카테고리 색점, 클러스터링, 신규 점선, 6개월 무활동 투명도
- [ ] 바텀시트 + 카드 리스트 (카드 구성 spec 4.1 마지막 줄)
- [ ] 탭 전체/구이/회 · 칩 새로 들어온 집/찜한 곳 · 정렬 3종 · 검색(우리 데이터)
- [ ] 시즌 카운터 · 이벤트 카드 슬롯(설정값, 닫기)
- 완료: design 화면 1의 1~9 전부 존재, 320/390/430 확인, 스모크 통과, 갭 스윕 미구현 0건

## Phase 2 — 상세 (spec 4.2 · design 화면 2)
- [ ] 화면 2의 1~10 순서 그대로 (요약/전체 확장 인터랙션 포함)
- [ ] "다녀왔다면" 낙관적 업데이트 + 실패 롤백 (목: delay 400ms, 10% 실패)
- [ ] 수정 입구 6곳 + 신규 배너 변형 + 4상태
- [ ] security-reviewer 에이전트 추가 (첫 쓰기 동작 도입 시점)
- 완료: 목업 스크린샷 비교로 차이 0, 다녀왔다면이 +1/롤백 동작, 갭 스윕 0건

## Phase 3 — 제보 플로우 (spec 4.3 · design 화면 3)
- [ ] 4단계 + 완료 화면, 진행바
- [ ] 1단계 가게명 검색 → 기존 가게 전환 갈림길
- [ ] 2단계 지도 핀 + 주소 검색 + 150m·유사도 중복 재검사(same_place 이식)
- [ ] zod 검증, 제출 시 즉시 노출(목: places에 추가 + isNew)
- 완료: 중복 가게 제보 시 기존 상세로 전환됨, 신규 제보가 지도에 바로 뜸, 갭 스윕 0건

## Phase 4 — 신규 패널 · 내 활동 · 로그인 분기 (spec 4.4 · design 화면 4·5)
- [ ] 신규 패널: 리스트 + 맞아요/달라요 + 검증 전/확인됨 + 빈 상태
- [ ] 찜(하트 토글 + 칩 필터 + 목 유지), 내 활동 탭 3개, 로그아웃·탈퇴 자리
- [ ] 로그인 분기 목 토글 (익명/카카오), 리뷰 진입 시 로그인 시트
- [ ] 리뷰 작성 폼 (별점 필수·후기 선택), 3개 미만 평균 숨김, 본인 수정·삭제
- 완료: 익명↔로그인 토글로 모든 분기 확인 가능, 갭 스윕 0건

## Phase 5 — 데스크탑 그릇 · 라우트 (design 화면 6~9)
- [ ] 1024px: 좌측 패널 400px + 지도, 상세 패널 전환, 플로우 모달 480px, 호버 동기화
- [ ] /place/[id] · /gu/[name] SSR, 공유 딥링크, next/og 공유 카드
- [ ] Lighthouse CI 예산 추가 (모바일 LCP)
- 완료: 같은 컴포넌트가 두 그릇에서 렌더(중복 구현 없음), 데스크탑서 카드→상세→지도 동기화 동작

## Phase 6 — 백엔드 교체
- [ ] 스키마 확정 (checkins 이벤트·reviews·bookmarks·profiles.is_admin·소프트 삭제)
- [ ] convert_seed.py 전체 452곳 임포트 (needsReview·excluded 37곳 검수 반영)
- [ ] lib/data.ts → Supabase 교체, 익명 auth + 카카오 linkIdentity
- [ ] RLS + RLS 테스트, Turnstile, Upstash 속도 제한, sharp 업로드(NCP)
- [ ] /admin 4탭, 텔레그램 알림, Sentry, 익명 정리 크론, 캐시(revalidate)
- [ ] 런칭 전 보안 스윕 (쓰기 경로 × 검증·권한·제한·에러 표)
- 완료: 목 JSON 삭제해도 전 기능 동작, RLS 테스트 통과, 폰 머니패스 실 DB로 한 바퀴

## Phase 7 — 런칭 준비 (별도 결정 후)
- [ ] 도메인 연결, 서치어드바이저, 축제 페이지, 까주기 테스트, 시즌 카운터 실데이터
- [ ] SNS 채널·런칭일·판단 숫자·태그라인·신규 패널 이름 확정 (spec 9장)
