/**
 * 사진 저장 — Cloudflare Images 바인딩으로 1200px webp 재인코딩(EXIF도 사라진다) → R2(`PHOTOS`) put. 키만 돌려준다.
 * 진짜 이미지인지는 `IMAGES.info()`(무료)로 본다 — 클라이언트의 MIME은 위조 가능하다(security-reviewer 2026-09-08).
 * 바인딩은 `getCloudflareContext`로: 워커·`next dev`(initOpenNextCloudflareForDev, 로컬 시뮬레이션) 둘 다 있다.
 * 저장소를 옮길 때(NCP 등) 바뀌는 건 이 파일의 put·delete와 서빙 라우트뿐이다.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

const MAX_EDGE_PX = 1200;

interface ImagesBinding {
  info(stream: ReadableStream): Promise<{ format: string; width?: number; height?: number }>;
  input(stream: ReadableStream): {
    transform(options: { width?: number; height?: number; fit?: string }): {
      output(options: { format: string; quality?: number }): Promise<{ response(): Response }>;
    };
  };
}
interface R2Bucket {
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream; httpEtag: string; size: number } | null>;
  delete(key: string): Promise<void>;
}

async function bindings(): Promise<{ images: ImagesBinding; photos: R2Bucket }> {
  const { env } = await getCloudflareContext({ async: true });
  const { IMAGES, PHOTOS } = env as { IMAGES?: ImagesBinding; PHOTOS?: R2Bucket };
  if (!IMAGES || !PHOTOS) throw new Error("photo bindings missing");
  return { images: IMAGES, photos: PHOTOS };
}

/** 파일 → webp 저장. 이미지가 아니면 null(호출자가 "이미지 파일만"으로 돌려보낸다). */
export async function storePhoto(file: Blob, key: string): Promise<"stored" | "not-image"> {
  const { images, photos } = await bindings();
  try {
    await images.info(file.stream());
  } catch {
    return "not-image";
  }
  const encoded = await images
    .input(file.stream())
    .transform({ width: MAX_EDGE_PX, height: MAX_EDGE_PX, fit: "scale-down" })
    .output({ format: "image/webp", quality: 82 });
  const out = encoded.response();
  await photos.put(key, await out.arrayBuffer(), {
    httpMetadata: { contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable" },
  });
  return "stored";
}

export async function deletePhotoObject(key: string): Promise<void> {
  const { photos } = await bindings();
  await photos.delete(key);
}

/** 서빙 라우트용 — 없으면 null */
export async function readPhoto(key: string): Promise<{ body: ReadableStream; etag: string; size: number } | null> {
  const { photos } = await bindings();
  const obj = await photos.get(key);
  return obj ? { body: obj.body, etag: obj.httpEtag, size: obj.size } : null;
}
