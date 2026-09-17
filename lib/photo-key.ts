/**
 * 사진 키(R2 객체 이름) — DB에는 이것만 저장한다(URL이 아니다, decisions 2026-09-10). 서빙 라우트가 `/photos/<key>`로 읽는다.
 * 모양을 좁게 고정해 서빙 라우트가 임의 키를 R2에서 꺼내지 못하게 한다(경로 탐색·다른 버킷 객체 없음).
 */
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const PHOTO_KEY = new RegExp(`^(?:places|reviews)/${UUID}/${UUID}\\.webp$`, "u");

export function placePhotoKey(placeId: string, photoId: string): string {
  return `places/${placeId}/${photoId}.webp`;
}

export function reviewPhotoKey(reviewId: string, photoId: string): string {
  return `reviews/${reviewId}/${photoId}.webp`;
}

export function isPhotoKey(key: string): boolean {
  return PHOTO_KEY.test(key);
}
