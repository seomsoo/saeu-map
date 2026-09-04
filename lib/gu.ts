import { pointInRing } from "./geo";
import type { LatLng } from "./types";

/**
 * 시군구 경계 판정 — 제보 핀 좌표로 구 라벨을 정한다(decisions 2026-09-04, 전국 허용).
 * 주소 API 응답은 저장하지 않으므로(규칙 2) 구는 우리가 경계로 계산한다.
 * 두 파일이다: 서울 25구(정밀, 60KB)를 먼저 보고, 서울 밖일 때만 전국 226개 시군구(단순화본, 180KB)를 읽는다 —
 * 대부분의 제보는 서울 파일만 받는다. 둘 다 처음 쓸 때 한 번 동적 import(2단계 전에는 번들에 없다).
 * 라벨: 서울 "마포구", 그 밖 "김포시(경기)"·"창원시 진해구(경남)". 출처·라이선스는 scripts/fetch_gu_boundaries.py.
 */
interface GuBoundaries {
  districts: { name: string; rings: number[][][] }[];
}

let seoul: Promise<GuBoundaries> | null = null;
let korea: Promise<GuBoundaries> | null = null;

function loadSeoul(): Promise<GuBoundaries> {
  seoul ??= import("./gu-boundaries.json").then((m) => m.default as GuBoundaries);
  return seoul;
}

function loadKorea(): Promise<GuBoundaries> {
  korea ??= import("./gu-boundaries-korea.json").then((m) => m.default as GuBoundaries);
  return korea;
}

function findDistrict(point: LatLng, { districts }: GuBoundaries): string | null {
  return districts.find((d) => d.rings.some((ring) => pointInRing(point, ring)))?.name ?? null;
}

/** 좌표가 속한 시군구 라벨("마포구", "김포시(경기)"). 한국 밖(바다)이면 null. */
export async function guOfPoint(point: LatLng): Promise<string | null> {
  return findDistrict(point, await loadSeoul()) ?? findDistrict(point, await loadKorea());
}
