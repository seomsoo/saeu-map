import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

/**
 * 프리렌더 결과(OG 카드 75장·robots·not-found)를 **정적 에셋에서 읽는** 읽기 전용 캐시 (decisions 2026-09-07).
 * 기본값(dummy)은 캐시가 없어 프리렌더된 라우트도 요청마다 다시 그린다 — Workers Free의 CPU 10ms/요청에 satori가 걸린다.
 * 재검증(revalidate)은 지원하지 않는다 — 지금 앱은 전부 요청 시 렌더라 필요 없다. Phase 6에 ISR을 들이면 R2 캐시로 바꾼다.
 */
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
