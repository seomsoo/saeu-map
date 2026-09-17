import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

/**
 * Phase 6 캐시 (decisions 2026-09-10 · 2026-09-01 비용 방어 정책):
 *  - incremental cache = R2(`saeu-cache`) + regional cache(Cache API, 최대 30분) — 프리렌더(OG 카드 75장)와 `unstable_cache`(핀 목록·상세·시즌 카운터)가 여기 산다.
 *    regional cache는 R2 읽기(사진 버킷과 계정 합산 월 1,000만)를 아낀다. 캐시 히트는 R2까지 안 간다.
 *  - tag cache = D1(`saeu-tags`) — 쓰기 액션의 `revalidateTag`가 태그를 stale로 찍고 다음 요청이 다시 만든다.
 *  - queue 없음: 온디맨드 재검증만 쓴다. 분 단위 `revalidate`는 금지(2026-09-01). 시간 기반이 필요해지면 doQueue(Durable Object).
 * `populateCache`(preview/upload/deploy가 부른다, CI는 `populateCache local`)가 빌드 결과를 R2에 넣고 D1 표를 만든다.
 */
export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
  tagCache: d1NextTagCache,
});
