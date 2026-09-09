/** 전체 페이지 이동(OAuth 시작 등). 함수로 감싼 이유: jsdom의 location은 바꿀 수 없어 테스트가 이 모듈을 목으로 바꾼다. */
export function assignLocation(url: string): void {
  window.location.assign(url);
}
