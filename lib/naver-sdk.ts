/**
 * 네이버 지도 SDK 스크립트 주소 — HTML 단계에서 미리 받기 위한 것(plan perf-diet A5).
 * react-naver-maps(0.2.2)는 하이드레이션 뒤에야 `<script>`를 꽂는다(prod 실측 3.3s). 같은 주소를 `preload`로 head에 걸어 두면
 * 브라우저가 HTML을 읽자마자 받아 두고, 나중에 꽂히는 `<script>`가 그 응답을 재사용한다.
 * **라이브러리의 `buildUrl`과 바이트 단위로 같아야 한다** — 한 글자라도 다르면 두 번 받는다. `lib/__tests__/naver-sdk.test.ts`가 대조한다.
 */
export const NAVER_MAPS_ORIGIN = "https://oapi.map.naver.com";

/** geocoder: 제보 2단계 주소 검색(핀 이동 보조). NavermapsProvider의 `submodules`와 주소의 `submodules=`가 같은 배열이어야 한다 */
export const NAVER_MAPS_SUBMODULES: string[] = ["geocoder"];

export function naverMapsScriptUrl(clientId: string): string {
  // react-naver-maps `buildUrl`과 같은 순서·같은 인코딩: 키는 URLSearchParams, submodules는 raw 콤마(퍼센트 인코딩하면 로더가 404)
  const params = new URLSearchParams({ ncpKeyId: clientId });
  return `${NAVER_MAPS_ORIGIN}/openapi/v3/maps.js?${params.toString()}&submodules=${NAVER_MAPS_SUBMODULES.join(",")}`;
}
