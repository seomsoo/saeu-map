# 결정 로그 (decisions)

형식: 날짜 / 결정 / 맥락 / 근거 / 재검토 조건. 스펙과 달라진 것, 보류한 것만 적는다.

## 2026-08-31 — 지도 SDK: 카카오 → 네이버(NCP 신규 Maps)
- **맥락**: 카카오맵 무료 쿼터가 "계정당 첫 번째 활성화 앱 한정" 정책으로 확인됨. 개발자 계정에 카카오맵 사용 중인 기존 앱이 있어 새우맵은 두 번째 앱 → 무료 쿼터 없이 비즈월렛(유료) 필요.
- **결정**: 네이버 클라우드 신규 'Maps' 상품의 Web Dynamic Map 사용. 지오코딩도 VWorld 대신 네이버 Geocoding으로 통일.
- **근거**: 신규 Maps는 월 600만 건 무료 + 초과 0.1원/건 (구 AI NAVER API의 무료 종료와 별개 — 2025-06-23 NCP 공지 확인). 우리 예상 규모(월 수십만 로드)의 10배 여유. 11/30까지 NCP 크레딧 20만원이 초과분 방어. 데이터·플레이스 링크·길찾기·검색 API(API HUB)가 네이버 생태계라 콘솔 통일.
- **운영 조건**: NCP 콘솔에 월 사용량 알림 400만 건 설정(차단 아님). React 래퍼가 얇으므로(react-naver-maps) SDK 사용 시 context7로 공식 문서 확인.
- **재검토 조건**: 네이버 Maps 무료 정책 변경 시, 또는 월 로드 400만 건 접근 시.
- **유지**: 카카오 로그인·카톡 공유는 지도 SDK와 무관하므로 카카오 유지.

## 2026-09-01 — TypeScript 6.0.3 (7.0 대신)
- **맥락**: TS 7.0.2가 최신이지만 typescript-eslint 8.69.0이 TS 7.0을 아직 미지원 (>=7.1 추적 중).
- **결정**: TypeScript 6.0.3 사용. Next.js 16.3.3과 호환 확인됨.
- **재검토 조건**: typescript-eslint이 TS 7.x 지원 시 업그레이드.

## 2026-09-01 — Vercel 비용 방어 정책
- **맥락**: DAU 2천 서비스가 월 $86 청구된 실사례 분석 (Threads @kindainvestor). 원인은 트래픽이 아니라 **ISR 남용**: `revalidate: 60` × 동적 URL 9,649개 → 재생성마다 Function Duration + ISR Writes 이중 과금. 부가 요인: next.config `headers()`의 Cache-Control이 페이지 `revalidate`를 덮어써 s-maxage=60 고정(두 번 배포하고 발견), 크롤러 트래픽, Observability 과금.
- **우리 방어선 (Phase 5~6에서 지킬 것)**:
  1. **페이지 캐시는 on-demand 우선**: 쓰기(제보·다녀왔다면·리뷰)가 우리 앱을 거치므로 `revalidateTag`/`revalidatePath`로 변경 시에만 재생성. 주기 revalidate는 보조로 3600s 이상. **`revalidate: 60` 같은 분 단위 금지** — 우리 데이터는 분 단위 신선도가 필요 없다.
  2. **next.config `headers()`에 페이지 경로 Cache-Control 금지** — 페이지 revalidate를 무력화한다. 폰트·정적 자산(`/fonts/*` 등)만 허용.
  3. URL 규모 자각: /place/[id] 452 + /gu/[name] 25 ≈ 477개 (그 사례의 1/20). on-demand면 재생성은 실제 데이터 변경 횟수에 비례.
  4. Observability Plus 켜지 않는다.
  5. **Hobby 플랜 유지** — 한도 초과 시 과금이 아니라 정지라 요금 폭탄이 구조적으로 불가능. Pro 전환 시 Spend Management 지출 상한을 반드시 같이 설정.
  6. 폰트는 dynamic subset (아래 결정).
- **재검토 조건**: Pro 전환 시, 또는 Phase 5 SSR 페이지 추가 시 이 목록 재확인.

## 2026-09-01 — 호스팅: Vercel Hobby 유지, Cloudflare 이전은 트리거 기반
- **맥락**: Vercel 요금 폭탄 실사례 조사 — Cara $96k(1주 유저 65만, 함수 5,600만/일), DDoS $23k, 크롤러 8.4TB $1.5k, 봇 95% 트래픽 과금 등. 공통점: 전부 **Pro 이상 + Spend Management 미설정**. Hobby는 초과 시 과금이 아니라 정지라 폭탄 불가능.
- **결정**: PMF 확인까지 Vercel Hobby 유지. 단 이전 비용을 싸게 유지하는 패턴 준수 — Vercel 전용 기능 미사용, 사진 외부 스토리지(R2 예정), on-demand ISR (전부 OpenNext 호환 패턴).
- **Cloudflare(Workers + OpenNext) 트레이드오프**: 장점 = egress 무료(대역폭 폭탄 원천 차단), 요청당 과금($5/월에 1,000만 req), WAF·봇 방어가 본업, 스펙의 R2·Turnstile과 궁합. 단점 = OpenNext 어댑터 레이어(Next 신버전 시차·런타임 갭 디버깅), ISR 캐시 직접 구성(KV/R2/DO), 프리뷰 DX 열세.
- **이전 트리거** (하나라도 해당 시 재검토): ① Pro 전환 필요 시점(Hobby 정지 경험 또는 상업화) ② 봇·크롤러 트래픽 유의미 ③ 사진 트래픽 본격화(R2 이전과 동시 진행이 자연스러움).
- **Pro로 가게 되면**: 전환 당일 Spend Management 상한 설정이 선행 조건 (기본값이 무상한 — 사례들의 공통 원인).

## 2026-09-01 — 호스팅 변경: Cloudflare Workers 선(先)채택 (당일 "Vercel Hobby 유지" 결정 뒤집음)
- **맥락**: 스파이크 결과 OpenNext 어댑터가 Next 16.3.3을 정확히 지원, 자동 마이그레이션·로컬 workerd 렌더·배포까지 당일 완료. 이전 비용이 최저점(페이지 1개, ISR·이미지 없음)이고, 사용자의 Vercel 계정은 다른 프로젝트들과 Hobby 무료 한도(계정 단위 100GB)를 공유 중이었음.
- **결정**: 처음부터 Cloudflare Workers(OpenNext)로 배포. Vercel은 쓰지 않는다. 프로덕션: https://saeu-map.saeu-map.workers.dev (Phase 7에서 새우맵.kr 연결 예정).
- **요금 안전**: Workers Free는 한도 초과 시 과금이 아니라 에러(하루 10만 요청). Cloudflare 폭탄 사례는 R2 Infrequent Access 오해($9~10)가 대부분 — **R2는 Standard 등급만 쓴다**.
- **운영 수칙**: ① Next 업그레이드 전 @opennextjs/cloudflare 호환(peerDeps) 확인 ② 배포 전 `pnpm preview`(workerd, :8787)로 런타임 확인 ③ ISR 도입 시(Phase 5~6) R2 incremental cache 바인딩 설정 필요 (지금은 미설정 — 정적이라 무관)
- **재검토 조건**: OpenNext가 Next 메이저를 4주 이상 못 쫓아오거나, 런타임 갭 디버깅이 반복될 때.

## 2026-09-01 — Pretendard dynamic subset 전환 (단일 2MB woff2 폐기)
- **맥락**: PretendardVariable.woff2 단일 파일 2MB를 전 방문자가 다운로드하는 구조였음. DAU 2천 가정 시 폰트만 월 60~120GB 전송 → Hobby 무료 한도(100GB) 위협.
- **결정**: pretendard 패키지의 dynamic subset(unicode-range 92분할)으로 전환. 화면에 쓰인 글자 범위의 조각만 다운로드 — 방문당 ~100KB, 약 95% 절감. `/fonts/*`는 immutable 캐시 헤더.
- **트레이드오프**: next/font 최적화(preload) 포기. FOUT은 font-display: swap + 시스템 폴백으로 수용.
- TanStack Query — 서버 컴포넌트 구조라 클라이언트 fetch 없음. 재검토: 지도 뷰포트 단위 로딩 도입 시.
- 가격 뱃지·가격 지수 — kg 단위 표본 20곳 미만. 재검토: 시즌 중 표본 충족 시.
- 다크 모드(야장모드) — 라이트 우선, 토큰 두 벌만 준비. 재검토: 런칭 후.
- 무인 장시간 루프(/goal 야간 실행 등) — 정지 조건·비용 상한 설계 후. 재검토: 11월.

## 커스텀 에셋 필요 목록
- 새우 마커·로고 (그 전까지 카테고리 색점)
