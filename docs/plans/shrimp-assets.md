# 새우 에셋 투입 — 목 사진 · 마커/카드 플레이스홀더 · OG

## Context
- 브랜치 `feat/assets-desktop` (main 90b3ebc = Phase 5 PR #9 머지본에서 분기).
- 사용자가 GPT로 생성한 4장이 `~/Downloads/새우맵/`에 있다. 리디자인은 **에셋 투입 뒤 별도**로 한다(사용자 지시).
- `docs/decisions.md` "커스텀 에셋 필요 목록" 8줄 중 이번에 닫는 건 2줄이다. 나머지는 실측으로 보류(아래 범위 밖).

## 실측 (sips 축소 → 확대해 육안 확인)
| 에셋 | 16px | 20px | 36px | 64px |
|---|---|---|---|---|
| `새우.png` 원본 | 형체 없음 | 얼룩 | 읽힘 | 읽힘 |
| `새우.png` 여백 크롭 | **뭉갬** | 얼룩 | **선명** | 선명 |
| `새우냄비안.png` | — | 얼룩 | 읽힘(버너·불꽃 소실) | 읽힘 |

- 원본은 새우가 프레임의 55%라 36px 마커에 넣으면 실제 새우는 20px가 된다 → **여백 크롭이 필수**.
- 16px에서 살아남는 그림은 없다 → 파비콘은 이번에 안 건드린다.
- **투명화는 불필요**: `.saeu-marker`가 `overflow:hidden` + 원형 클립이고 이미지가 100%를 채운다(사진과 같은 경로). 카테고리는 바깥 링(코랄/틸)이 이미 말하므로 안쪽 그림은 한 색으로 고정해도 정보 손실이 없다.

## 도구
- `sips`(macOS 내장)로 크롭·리사이즈. **WebP는 sips가 못 쓴다**(`Error: Can't write format: org.webmproject.webp`) → `node_modules/.pnpm`에 이미 있는 `sharp`를 일회성 스크립트로 호출한다. **package.json에 의존성 추가 없음.**
- 변환 스크립트는 스크래치패드에 두고 리포에 커밋하지 않는다(1회성).

## 변경

### 1. 목 사진 — `public/mock/` · `lib/mock/places.json` · `lib/mock/reviews.json`
- `photo-1.webp` ← `새우구이목.png` (소금구이 냄비), `photo-2.webp` ← `생새우목.png` (얼음 위 생새우). 1200×800, quality 78.
- `thumb-1.webp` `thumb-2.webp` ← 위 두 장의 정사각 크롭 160×160(표시 64px의 2x).
- 기존 `photo-1~4.svg` · `thumb-1~4.svg` 삭제, `places.json`의 photo 참조를 2장 순환으로 정리, `reviews.json`의 `photoUrl` 교체.
- **사진이 2장뿐이라 10장짜리 가게(`places.json` 264행)는 같은 그림이 5번 반복된다.** 지금도 4장을 2.5회씩 돌려쓰므로 퇴행은 아니다. 머리버터구이·한 상 차림 2장을 나중에 받으면 슬롯만 늘리면 된다.

### 2. 마커 플레이스홀더 — `app/globals.css`
- `public/shrimp.webp` ← `새우.png` 여백 크롭 → 128×128(마커 26px·카드 40px 양쪽의 2x 상한).
- `.saeu-marker__dot`(8px 카테고리 색점)의 `background`를 새우 이미지로, 크기 26px. **`marker-icons.ts`는 안 건드린다** — innerHTML 문자열·캐시 키가 그대로라 `safeAssetPath` 가드 경로도 그대로다. CSS 한 규칙이 최소 변경이다.

### 3. 카드 썸네일 플레이스홀더 — `components/map-screen/place-card.tsx`
- `PlaceThumbnail`의 색점 `<span>`(`size-2` + `DOT_CLASS`)을 같은 `/shrimp.webp` 40px로 교체. `DOT_CLASS`·`markerCategory` import가 여기서만 쓰이면 같이 정리(삭제 전 트리 grep).

### 4. OG 공유 카드 — `components/og/share-card.tsx` (**사용자 확인 필요**)
- 주석이 "사진은 넣지 않는다(외부 fetch 없음, **로고 에셋 대기**)"라 자리가 예약돼 있다.
- root(홈) variant의 우측 160px 마커 모티프(원 + 색점) 자리에 `새우냄비안.png`를 넣는다. 빌드 시 생성이라 fs로 읽어 base64 data URI로 인라인(satori는 외부 URL을 못 받는다).
- place/gu variant는 **그대로 둔다** — 카테고리색 모티프라 구이 편향 이미지가 맞지 않는다(생새우회 카드에 끓는 냄비).

### 5. 문서 — `docs/decisions.md`
- 커스텀 에셋 목록에서 **"새우 마커·카드 썸네일 플레이스홀더"** 줄 삭제.
- `## 2026-09-07 — 새우 에셋 투입` 항목: 위 실측 표, 투명화 불필요 근거, WebP 경로(sharp), 보류 4건과 그 수치 근거.

## 변경 파일
- 추가: `public/shrimp.webp`, `public/mock/photo-1~2.webp`, `public/mock/thumb-1~2.webp`
- 삭제: `public/mock/photo-1~4.svg`, `public/mock/thumb-1~4.svg`
- 수정: `lib/mock/places.json`, `lib/mock/reviews.json`, `app/globals.css`, `components/map-screen/place-card.tsx`, `components/og/share-card.tsx`, `docs/decisions.md`
- 테스트: `components/map/__tests__/marker-icons.test.ts`·`components/place-detail/__tests__/place-detail.test.tsx`가 `/mock/thumb-1.svg`·`/mock/photo-N.svg` 문자열을 쓴다 → 경로만 교체(동작 검증은 그대로).

## 검증
- `pnpm typecheck && pnpm lint && pnpm test`
- Playwright 390×702: 지도 마커(플레이스홀더 새우 + 카테고리 링), 카드 썸네일, 상세 사진 스트립, 사진 뷰어, 리뷰 첨부.
- 1440×900: 좌측 패널 카드 · 상세 패널.
- 용량: 교체 전후 `public/` 합계. 사진 1장 2.7MB PNG → WebP 목표 200KB 이하.
- OG는 `pnpm build` 뒤 생성된 PNG를 눈으로.

## 커밋 단위 (한 턴 = 한 커밋)
1. `chore(assets)`: 이미지 생성·변환 결과물 투입 + 목 데이터 경로 교체 (1)
2. `feat(marker)`: 마커·카드 플레이스홀더를 새우로 (2·3)
3. `feat(og)`: root 공유 카드 새우 아트 (4) — 사용자 확인 뒤
4. `docs`: decisions 기록 + 에셋 목록 정리 (5)

## 범위 밖 (에셋 대기 — decisions 목록에 남긴다)
- **파비콘** — 16px에서 어떤 그림도 뭉갠다. `app/icon.svg` 코랄 색점 유지. 더듬이·다리 뺀 단순화 버전이 필요.
- **현위치 새우 마커** — 20px 실측 얼룩. 파란 점 + 흰 링 유지.
- **제보 핀** — CSS 도형 유지. 앵커가 바닥 중앙이라 전용 세로형 아트가 필요.
- **제보 완료 화면 일러스트** — `docs/design.md:186`이 "체크 애니메이션 자리는 없다"로 장식을 명시적으로 배제한다. 넣으려면 decisions + design 정정이 한 작업 단위로 같이 가야 하는 **결정 변경**이라 이 플랜에 넣지 않았다.
- **카카오 심볼** — 브랜드 가이드 에셋이라 생성 대상이 아니다.
- **데스크탑 리디자인** — 에셋 투입 뒤 별도 플랜(사용자 지시).
