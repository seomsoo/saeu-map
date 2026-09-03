import { pointInRing } from "./geo";
import type { LatLng } from "./types";

/**
 * 서울 자치구 경계 판정 — 제보 핀 좌표로 구를 정한다(decisions 2026-09-04).
 * 주소 API 응답은 저장하지 않으므로(규칙 2) 구는 우리가 경계로 계산한다.
 * 경계 JSON은 scripts/fetch_gu_boundaries.py가 굽는다(출처·라이선스는 그 파일 머리).
 * 처음 쓸 때 한 번만 동적으로 읽는다 — 제보 2단계 전에는 번들에 없다.
 */
interface GuBoundaries {
  districts: { name: string; rings: number[][][] }[];
}

let boundaries: Promise<GuBoundaries> | null = null;

function loadBoundaries(): Promise<GuBoundaries> {
  boundaries ??= import("./gu-boundaries.json").then((m) => m.default as GuBoundaries);
  return boundaries;
}

/** 좌표가 속한 자치구 이름("마포구"). 서울 25구 밖이면 null. */
export async function guOfPoint(point: LatLng): Promise<string | null> {
  const { districts } = await loadBoundaries();
  const hit = districts.find((d) => d.rings.some((ring) => pointInRing(point, ring)));
  return hit?.name ?? null;
}
