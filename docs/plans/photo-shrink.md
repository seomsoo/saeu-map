# 사진은 폰에서 먼저 줄인다 (2026-09-24, 런칭 전 — PR #21에 포함)

**상태: 완료(같은 날).** 사용자 "이걸 지금 안 한다는 거야??" → 즉시 착수.

## Context
prod 첫 제보에서 사진이 Next 서버 액션 본문 상한 1MB에 걸려 떨어졌다(Sentry SAEU-MAP-8). 응급 처치는 상한 32MB + 합계 30MB 검사였는데, 근본 원인은 **원본(3~5MB)을 그대로 보내는 구조**다 — 서버는 어차피 1200px webp로 다시 만든다(`lib/server/photos.ts`). Codex PR #21이 두 구멍을 더 잡았다: ① 합계 초과가 가게를 만든 **뒤** 사진 업로드에서만 걸려 "성공처럼 보이는 실패" ② 리뷰 사진 액션이 장당 10MB를 안 봄.

## 변경
- `lib/image-shrink.ts`(신설, 웹 표준만): `createImageBitmap(file, { imageOrientation: "from-image" })` → 캔버스 긴 변 1200 → `toBlob("image/webp", 0.82)` → `.webp` File. 못 줄이면(API 없음·디코딩 실패·더 커짐) 원본 그대로 — 서버가 다시 만든다.
- `lib/data.ts` `prepareUploads()`: 줄이기 → 장당 10MB·합계 30MB 검사(문구) — **제보는 가게를 만들기 전에**, 리뷰는 리뷰를 만들기 전에, 상세 ＋타일은 올리기 전에.
- `use-report-flow`/`report-panel`: 사진 크기 오류는 문구 그대로 토스트 + 4단계(사진)로 복귀(그 외는 일반 실패).
- `lib/server/actions.ts` `attachReviewPhoto`: 공용 `imageFileSchema`로 파싱(Codex #2).
- 서버 상한(32MB·합계 30MB)은 뒷받침으로 남긴다.

## 검증
- vitest: `image-shrink.test.ts` 3(폴백·4000×3000→1200×900 webp·못 줄이면 원본) · `data-write.test.ts` 2(합계 초과는 가게 만들기 전에 throw·범위 안이면 만들고 올림) · `schemas.test.ts` 그대로.
- 배포 뒤 prod: "전라도" 상세 ＋타일로 폰 원본 사진 1장 → 스트립에 뜨고 `photos` 행 1, R2 객체 ~200KB. 제보 한 번 더(사진 2장)로 체감.

## 결과
플랜과 같음. 업로드량 5MB → ~0.2MB(장당). HEIC는 사파리가 `createImageBitmap`에서 디코딩한다(다른 브라우저는 원본 폴백 → 서버 변환).
