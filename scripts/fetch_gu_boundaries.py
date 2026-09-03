#!/usr/bin/env python3
"""lib/gu-boundaries.json — 서울 25개 자치구 경계 (제보 핀 좌표 → 구 판정용).

출처: southkorea/seoul-maps (Apache-2.0, Lucy Park) — 통계청(KOSTAT) 2013 시군구 경계 단순화본
      https://github.com/southkorea/seoul-maps
      kostat/2013/json/seoul_municipalities_geo.json (원본 해상도, 25구 25,222점, 1.1MB)
용도: 제보 2단계에서 사용자가 확정한 핀 좌표로 구를 판정한다(decisions 2026-09-04).
      주소 API 응답은 저장하지 않으므로(CLAUDE.md 규칙 2) 구는 우리가 경계로 계산한다.
가공: 속성은 이름만 남기고, 링을 Douglas-Peucker 0.0002°(≈20m)로 줄인 뒤 좌표를 소수 5자리(≈1m)로
      반올림한다 → 약 2,800점, 60KB. 같은 저장소의 *_simple.json(1,374점)은 시청 앞이 종로구로
      나올 만큼(≈300m) 거칠어 쓰지 않는다. 좌표 순서는 GeoJSON 그대로 [lng, lat].
      구멍(hole)은 원본에 없어 바깥 링만 담는다.

사용:
    python3 scripts/fetch_gu_boundaries.py                 # 다운로드 후 생성
    python3 scripts/fetch_gu_boundaries.py --source FILE   # 받아 둔 GeoJSON으로 생성

같은 입력에 대해 결과가 같다(idempotent) — 재실행 후 git diff가 비어야 정상.
2013 이후 서울 자치구 경계 변경은 없다. 행정구역 개편 때 재실행한다.
"""
import argparse
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "lib" / "gu-boundaries.json"

SOURCE_REPO = "https://github.com/southkorea/seoul-maps"
SOURCE_PATH = "kostat/2013/json/seoul_municipalities_geo.json"
SOURCE_URL = f"https://raw.githubusercontent.com/southkorea/seoul-maps/master/{SOURCE_PATH}"
LICENSE = "Apache-2.0"
UA = {"User-Agent": "saeu-map/1.0 (seed script; +https://github.com/)"}
PRECISION = 5  # 소수 자리 — 5자리 ≈ 1.1m
EPSILON_DEG = 0.0002  # Douglas-Peucker 허용 오차 ≈ 20m (위도 37.5°에서 1° ≈ 111km/88km)


def fetch(url: str) -> dict:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.load(res)


def _perpendicular(pt, a, b) -> float:
    (x, y), (x1, y1), (x2, y2) = pt, a, b
    dx, dy = x2 - x1, y2 - y1
    length = (dx * dx + dy * dy) ** 0.5
    if length == 0:  # 닫힌 링의 첫·끝 점이 같을 때
        return ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
    return abs(dy * x - dx * y + x2 * y1 - y2 * x1) / length


def simplify(points: list, eps: float) -> list:
    """Douglas-Peucker. 허용 오차 밖으로 가장 멀리 벗어난 점을 남기고 양쪽을 재귀."""
    if len(points) < 3:
        return points
    first, last = points[0], points[-1]
    index, dmax = 0, 0.0
    for i in range(1, len(points) - 1):
        d = _perpendicular(points[i], first, last)
        if d > dmax:
            index, dmax = i, d
    if dmax > eps:
        return simplify(points[: index + 1], eps)[:-1] + simplify(points[index:], eps)
    return [first, last]


def outer_rings(geometry: dict) -> list[list[list[float]]]:
    """Polygon → [outer], MultiPolygon → [outer, outer, ...]. 구멍은 버린다."""
    t = geometry["type"]
    if t == "Polygon":
        polygons = [geometry["coordinates"]]
    elif t == "MultiPolygon":
        polygons = geometry["coordinates"]
    else:
        raise ValueError(f"unsupported geometry: {t}")
    rings = []
    for polygon in polygons:
        ring = simplify([(lng, lat) for lng, lat, *_ in polygon[0]], EPSILON_DEG)
        outer = [[round(lng, PRECISION), round(lat, PRECISION)] for lng, lat in ring]
        if len(outer) < 4:
            raise ValueError("degenerate ring")
        rings.append(outer)
    return rings


def build(geojson: dict) -> dict:
    districts = []
    for feature in geojson["features"]:
        name = feature["properties"]["name"]
        if not name.endswith("구"):
            raise ValueError(f"unexpected district: {name}")
        districts.append({"name": name, "rings": outer_rings(feature["geometry"])})
    if len(districts) != 25:
        raise ValueError(f"expected 25 districts, got {len(districts)}")
    districts.sort(key=lambda d: d["name"])
    return {
        "source": f"{SOURCE_REPO} ({SOURCE_PATH})",
        "license": LICENSE,
        "districts": districts,
    }


def dump(data: dict) -> str:
    """구 하나가 한 줄 — diff가 읽힌다."""
    lines = [
        "{",
        f'  "source": {json.dumps(data["source"], ensure_ascii=False)},',
        f'  "license": {json.dumps(data["license"])},',
        '  "districts": [',
    ]
    rows = [json.dumps(d, ensure_ascii=False, separators=(",", ":")) for d in data["districts"]]
    lines.append(",\n".join(f"    {row}" for row in rows))
    lines += ["  ]", "}", ""]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", type=Path, help="받아 둔 GeoJSON 파일 (없으면 다운로드)")
    args = parser.parse_args()

    geojson = json.loads(args.source.read_text()) if args.source else fetch(SOURCE_URL)
    data = build(geojson)
    OUT.write_text(dump(data))
    points = sum(len(r) for d in data["districts"] for r in d["rings"])
    print(f"wrote {OUT.relative_to(ROOT)}: {len(data['districts'])} districts, {points} points, {OUT.stat().st_size:,} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
