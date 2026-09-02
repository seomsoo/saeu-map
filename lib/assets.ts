/**
 * 우리 스토리지 경로만 통과시키는 가드 — 규칙 3(외부 이미지 도메인 금지)의 마지막 방어선.
 * 루트 상대(/)로 시작, `//`(프로토콜 상대)·`..`·따옴표·공백 불가. 마커(innerHTML)와 상세(next/image, unoptimized라 remotePatterns 검사 없음)가 같이 쓴다.
 */
const SAFE_ASSET_PATH = /^\/(?!\/)[\w\-./]+$/;

export function safeAssetPath(url: string | null | undefined): string | null {
  if (!url || !SAFE_ASSET_PATH.test(url) || url.includes("..")) return null;
  return url;
}
