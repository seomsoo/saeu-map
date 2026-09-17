/** next.config.ts `env`가 빌드 시각을 박는다 — 배포 뒤 생긴 핀의 공유 카드 폴백 판정용(lib/seo.ts). 비밀이 아니다. */
declare namespace NodeJS {
  interface ProcessEnv {
    BUILD_AT?: string;
  }
}
