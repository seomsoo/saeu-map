/**
 * 폰에서 먼저 줄이기 — 고른 원본(3~5MB)을 서버로 보내기 전에 브라우저 캔버스로 긴 변 1200px webp(~200KB)로 만든다
 * (plan photo-shrink 2026-09-24). 서버의 Images 변환(1200px webp·EXIF 제거)은 그대로 두고 **입력만 작게** —
 * 업로드가 빨라지고, 서버 액션 본문 상한(32MB)·합계 검사는 뒷받침으로만 남는다.
 * 웹 표준만 쓴다(createImageBitmap·canvas·toBlob). 못 줄이면(오래된 브라우저·디코딩 실패·더 커짐) 원본을 그대로 낸다 —
 * 서버가 어차피 다시 만든다.
 */
export const SHRINK_MAX_EDGE_PX = 1200;
const SHRINK_QUALITY = 0.82;

export async function shrinkImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
  let bitmap: ImageBitmap;
  try {
    // 세로로 찍은 사진은 EXIF 방향대로 돌려서 그린다 — 안 그러면 누운 채 저장된다
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  try {
    const scale = Math.min(1, SHRINK_MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", SHRINK_QUALITY);
    });
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp", lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
