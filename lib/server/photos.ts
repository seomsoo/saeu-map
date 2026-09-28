/**
 * 사진 저장 — Cloudflare Images 바인딩으로 1200px webp 재인코딩(EXIF도 사라진다) → R2(`PHOTOS`) put. 키만 돌려준다.
 * 진짜 이미지인지는 `IMAGES.info()`(무료)로 본다 — 클라이언트의 MIME은 위조 가능하다(security-reviewer 2026-09-08).
 * 바인딩은 `getCloudflareContext`로: 워커·`next dev`(initOpenNextCloudflareForDev, 로컬 시뮬레이션) 둘 다 있다.
 * 저장소를 옮길 때(NCP 등) 바뀌는 건 이 파일의 put·delete와 서빙 라우트뿐이다.
 */
import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { env } from "@/lib/env";
import { siteUrl } from "@/lib/seo";
import { reportError } from "./observe";

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
    httpMetadata: { contentType: "image/webp", cacheControl: "public, max-age=86400" },
  });
  return "stored";
}

/** 워커의 콜로 캐시(Cache API). `next dev`(Node)·`*.workers.dev`(프리뷰)엔 없거나 no-op → null이면 매번 R2 */
export interface EdgeCache {
  match(url: string): Promise<Response | undefined>;
  put(url: string, response: Response): Promise<void>;
  delete(url: string): Promise<boolean>;
}
export function edgeCache(): EdgeCache | null {
  const caches = (globalThis as { caches?: { default?: EdgeCache } }).caches;
  return caches?.default ?? null;
}

/** 서빙 라우트가 캐시 키로 쓰는 공개 주소(origin + 경로, 쿼리 없음) — 삭제가 같은 키를 지운다 */
export function photoCacheKey(key: string): string {
  return new URL(`/photos/${key}`, siteUrl(env.SITE_URL)).toString();
}

/** 콜로 캐시에 두는 시간 — 내린 사진(신고·리뷰 삭제·탈퇴)이 URL을 아는 사람에게 남는 상한이기도 하다(security-reviewer 2026-09-25). 브라우저는 하루(Codex PR #16 #5) */
export const PHOTO_EDGE_TTL_S = 3600;

export async function deletePhotoObject(key: string): Promise<void> {
  const { photos } = await bindings();
  await photos.delete(key);
  // 같은 콜로의 캐시도 — 다른 콜로는 PHOTO_EDGE_TTL_S 안에 빠진다. 실패해도 객체는 이미 지워졌다(베스트에포트)
  try {
    await edgeCache()?.delete(photoCacheKey(key));
  } catch (e) {
    reportError("photo edge cache delete failed", { key }, e);
  }
}

/** DB에서 뗀 사진의 R2 객체 지우기 — 실패해도 호출자는 성공이다(행은 이미 바뀌었다). 고아 객체는 월간 점검(runbook)이 잡는다 */
export async function forgetPhotoObjects(keys: readonly string[]): Promise<void> {
  for (const key of keys) {
    try {
      await deletePhotoObject(key);
    } catch (e) {
      reportError("photo object delete failed", { key }, e);
    }
  }
}

export function photoKeys(rows: readonly { photo_key: string | null }[]): string[] {
  return rows.map((r) => r.photo_key).filter((k): k is string => k !== null);
}

/** 서빙 라우트용 — 없으면 null */
export async function readPhoto(key: string): Promise<{ body: ReadableStream; etag: string; size: number } | null> {
  const { photos } = await bindings();
  const obj = await photos.get(key);
  return obj ? { body: obj.body, etag: obj.httpEtag, size: obj.size } : null;
}
