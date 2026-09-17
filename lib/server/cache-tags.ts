/**
 * 캐시 태그 (decisions 2026-09-01 비용 방어: 온디맨드만, 시간 기반 없음)
 *  places  — 핀 목록 전체(가게가 생기거나 공개 열이 바뀌면)
 *  place:<id> — 그 가게의 상세(확인·리뷰·사진·수정·닉네임)
 *  season  — 시즌 카운터(확인·제보)
 * "use server" 파일은 async 함수만 내보낼 수 있어 상수·동기 헬퍼는 여기 산다(액션·auth 콜백이 같이 쓴다).
 */
import "server-only";
import { updateTag } from "next/cache";

export const TAG_PLACES = "places";
export const TAG_SEASON = "season";
export const placeTag = (id: string): string => `place:${id}`;

/** 한 가게에 닿는 쓰기 뒤 — 목록·상세·시즌 카운터를 함께 만료한다 */
export function expirePlace(id: string): void {
  updateTag(TAG_PLACES);
  updateTag(placeTag(id));
  updateTag(TAG_SEASON);
}
