import { isPhotoKey } from "@/lib/photo-key";
import { readPhoto } from "@/lib/server/photos";

/**
 * 사진 서빙 — R2에서 읽어 그대로 낸다. 경로가 `/photos/<key>`라 규칙 3의 `safeAssetPath`(우리 경로만)가 그대로 방어선이다.
 * 키 모양이 좁아(places|reviews/uuid/uuid.webp) 임의 객체를 꺼낼 수 없다. 키는 내용이 바뀌지 않으므로 1년 immutable.
 * 워커 요청 하나가 든다(Free 하루 10만에 합산) — 도메인이 생기면 R2 커스텀 도메인 직서빙으로 옮긴다(Phase 7).
 */
export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }): Promise<Response> {
  const { key } = await context.params;
  const joined = key.join("/");
  if (!isPhotoKey(joined)) return new Response("Not found", { status: 404 });
  const photo = await readPhoto(joined);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(photo.body, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(photo.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: photo.etag,
    },
  });
}
