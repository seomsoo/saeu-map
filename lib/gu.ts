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

/**
 * 서울 25구 — `/gu/[name]` 화이트리스트(spec 4.6 "구별 25페이지"). 경계 파일(gu-boundaries.json)의 이름과
 * 같아야 한다(테스트가 지킨다). 상수인 이유: 라우트 판정마다 60KB 경계 파일을 읽지 않기 위해.
 */
export const SEOUL_GU: readonly string[] = [
  "강남구", "강동구", "강북구", "강서구", "관악구", "광진구", "구로구", "금천구", "노원구", "도봉구",
  "동대문구", "동작구", "마포구", "서대문구", "서초구", "성동구", "성북구", "송파구", "양천구", "영등포구",
  "용산구", "은평구", "종로구", "중구", "중랑구",
];

export function isSeoulGu(name: string): boolean {
  return SEOUL_GU.includes(name);
}

/** 구 경계의 바운딩 박스 중심 — `/gu/[name]`에 가게가 없을 때 지도를 그 구로 옮기는 기준. 서울 밖·모르는 이름은 null. */
export async function guCenter(name: string): Promise<LatLng | null> {
  const district = (await loadSeoul()).districts.find((d) => d.name === name);
  if (!district) return null;
  let north = -Infinity, south = Infinity, east = -Infinity, west = Infinity;
  for (const ring of district.rings) {
    for (const [lng = 0, lat = 0] of ring) {
      north = Math.max(north, lat); south = Math.min(south, lat);
      east = Math.max(east, lng); west = Math.min(west, lng);
    }
  }
  return { lat: (north + south) / 2, lng: (east + west) / 2 };
}
