import type { Place } from "./types";

/** 공유·복사 — 상세 [공유]와 제보 완료 카드의 [공유]가 같은 길을 쓴다. */

export const LINK_COPIED_NOTICE = "링크를 복사했어요";
export const LINK_COPY_FAILED_NOTICE = "링크를 복사하지 못했어요";

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function sharePath(placeId: string): string {
  return `/place/${encodeURIComponent(placeId)}`;
}

/** 기기 공유 시트, 없거나 실패하면 링크 복사 + 토스트. 사용자가 시트를 닫은 것(AbortError)은 실패가 아니다. */
export function sharePlace(
  place: Pick<Place, "id" | "name">,
  onNotice: (message: string) => void,
): void {
  const url = `${window.location.origin}${sharePath(place.id)}`;
  const fallback = () =>
    copyText(url).then((ok) => {
      onNotice(ok ? LINK_COPIED_NOTICE : LINK_COPY_FAILED_NOTICE);
    });
  if ("share" in navigator) {
    navigator.share({ title: place.name, url }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      return fallback();
    });
    return;
  }
  void fallback();
}
