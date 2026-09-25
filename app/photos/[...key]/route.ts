import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isPhotoKey } from "@/lib/photo-key";
import { PHOTO_EDGE_TTL_S, edgeCache, readPhoto } from "@/lib/server/photos";

/**
 * 사진 서빙 — R2에서 읽어 그대로 낸다. 경로가 `/photos/<key>`라 규칙 3의 `safeAssetPath`(우리 경로만)가 그대로 방어선이다.
 * 키 모양이 좁아(places|reviews/uuid/uuid.webp) 임의 객체를 꺼낼 수 없다. 키는 내용이 바뀌지 않지만 **내려진 사진이 캐시에 남는 시간**이기도 해서 하루(Codex PR #16 #5).
 * 워커 응답의 Cache-Control은 CDN에 저절로 남지 않아 요청마다 R2를 읽었다(prod 실측 TTFB ~1s, 2026-09-25) — 같은 콜로의 두 번째 요청부터는
 * Cache API가 낸다(plan perf-diet B3ⓐ). 저장은 `waitUntil`로 응답을 막지 않는다. 키는 origin + 경로(쿼리 제거 — 변형마다 R2를 읽고 항목이 늘지 않게),
 * 콜로 TTL은 `s-maxage` 1시간(Cache API가 max-age보다 우선한다) — 내린 사진은 삭제 경로가 같은 콜로를 지우고 다른 콜로는 1시간 안에 빠진다(security-reviewer 2026-09-25).
 */
export async function GET(request: Request, context: { params: Promise<{ key: string[] }> }): Promise<Response> {
  const { key } = await context.params;
  const joined = key.join("/");
  if (!isPhotoKey(joined)) return new Response("Not found", { status: 404 });
  const edge = edgeCache();
  const cacheKey = new URL(request.url);
  cacheKey.search = "";
  const hit = await edge?.match(cacheKey.toString());
  if (hit) return hit;
  const photo = await readPhoto(joined);
  if (!photo) return new Response("Not found", { status: 404 });
  const response = new Response(photo.body, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(photo.size),
      "Cache-Control": `public, max-age=86400, s-maxage=${String(PHOTO_EDGE_TTL_S)}`,
      ETag: photo.etag,
    },
  });
  if (edge) {
    const { ctx } = (await getCloudflareContext({ async: true })) as { ctx: { waitUntil(promise: Promise<unknown>): void } };
    ctx.waitUntil(edge.put(cacheKey.toString(), response.clone()));
  }
  return response;
}
