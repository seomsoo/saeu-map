#!/usr/bin/env python3
"""lib/gu-boundaries.json · lib/gu-boundaries-korea.json — 시군구 경계 (제보 핀 좌표 → 구 판정용).

두 파일이다(decisions 2026-09-04 Phase 3 보완): 서울 25구는 정밀하게, 그 밖 전국 226개 시군구는 단순화본으로.
lib/gu.ts는 서울 파일을 먼저 보고 서울 밖일 때만 전국 파일을 읽는다 — 대부분의 제보는 60KB만 받는다.

서울 출처: southkorea/seoul-maps (Apache-2.0, Lucy Park) — 통계청(KOSTAT) 2013 시군구 경계
      https://github.com/southkorea/seoul-maps
      kostat/2013/json/seoul_municipalities_geo.json (원본 해상도, 25구 25,222점, 1.1MB)
      → Douglas-Peucker 0.0002°(≈20m) + 좌표 5자리 → 약 2,800점, 60KB.
      같은 저장소의 *_simple.json(1,374점)은 시청 앞이 종로구로 나올 만큼(≈300m) 거칠어 쓰지 않는다.
전국 출처: southkorea/southkorea-maps (Apache-2.0) — 통계청(KOSTAT) 2013 시군구 경계 단순화본
      https://github.com/southkorea/southkorea-maps
      kostat/2013/json/skorea_municipalities_geo_simple.json (251개, 8,444점, 370KB)
      → 서울(코드 11)을 빼고 좌표 5자리만 → 226개, 약 180KB. 원본 해상도는 55MB라 클라이언트에 실을 수 없다.
      단순화본이라 시군구 경계 근처 수백 m는 옆 시군구로 갈 수 있다(라벨은 "어느 동네냐"용, Phase 6 관리자가 고친다).
라벨: 서울은 "마포구", 그 밖은 "{시군구}({시도 약칭})" — 크롤러의 "김포시(경기)" 표기와 같고
      동구·남구·중구처럼 겹치는 이름이 구별된다. "창원시진해구"는 "창원시 진해구(경남)"로 띄운다.
용도: 제보 2단계에서 사용자가 확정한 핀 좌표로 구를 판정한다. 주소 API 응답은 저장하지 않으므로
      (CLAUDE.md 규칙 2) 구는 우리가 경계로 계산한다. 좌표 순서는 GeoJSON 그대로 [lng, lat]. 구멍(hole) 없음.

사용:
    python3 scripts/fetch_gu_boundaries.py                                  # 둘 다 다운로드 후 생성
    python3 scripts/fetch_gu_boundaries.py --source-seoul A --source-korea B  # 받아 둔 GeoJSON으로 생성

같은 입력에 대해 결과가 같다(idempotent) — 재실행 후 git diff가 비어야 정상. 행정구역 개편 때 재실행한다.
"""
import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_SEOUL = ROOT / "lib" / "gu-boundaries.json"
OUT_KOREA = ROOT / "lib" / "gu-boundaries-korea.json"

SEOUL_REPO = "https://github.com/southkorea/seoul-maps"
SEOUL_PATH = "kostat/2013/json/seoul_municipalities_geo.json"
SEOUL_URL = f"https://raw.githubusercontent.com/southkorea/seoul-maps/master/{SEOUL_PATH}"
KOREA_REPO = "https://github.com/southkorea/southkorea-maps"
KOREA_PATH = "kostat/2013/json/skorea_municipalities_geo_simple.json"
KOREA_URL = f"https://raw.githubusercontent.com/southkorea/southkorea-maps/master/{KOREA_PATH}"
LICENSE = "Apache-2.0"
SEOUL_CODE_PREFIX = "11"
# KOSTAT 2013 시도 코드 앞 두 자리 → 라벨 약칭
PROVINCE_BY_CODE_PREFIX = {
    "11": "서울", "21": "부산", "22": "대구", "23": "인천", "24": "광주", "25": "대전", "26": "울산",
    "29": "세종", "31": "경기", "32": "강원", "33": "충북", "34": "충남", "35": "전북", "36": "전남",
    "37": "경북", "38": "경남", "39": "제주",
}
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


def korea_label(name: str, code: str) -> str:
    """"김포시(경기)" · "해운대구(부산)" · "창원시 진해구(경남)" — 크롤러 gu_of의 표기."""
    province = PROVINCE_BY_CODE_PREFIX[code[:2]]
    m = re.match(r"^(.+?시)(.+구)$", name)  # 일반구가 딸린 시: "창원시진해구" → "창원시 진해구"
    if m:
        name = f"{m.group(1)} {m.group(2)}"
    return f"{name}({province})"


def outer_rings(geometry: dict, eps: float | None) -> list[list[list[float]]]:
    """Polygon → [outer], MultiPolygon → [outer, outer, ...]. 구멍은 버린다. eps가 None이면 단순화 생략."""
    t = geometry["type"]
    if t == "Polygon":
        polygons = [geometry["coordinates"]]
    elif t == "MultiPolygon":
        polygons = geometry["coordinates"]
    else:
        raise ValueError(f"unsupported geometry: {t}")
    rings = []
    for polygon in polygons:
        ring = [(lng, lat) for lng, lat, *_ in polygon[0]]
        if eps is not None:
            ring = simplify(ring, eps)
        outer = [[round(lng, PRECISION), round(lat, PRECISION)] for lng, lat in ring]
        if len(outer) < 4:
            raise ValueError("degenerate ring")
        rings.append(outer)
    return rings


def build_seoul(geojson: dict) -> dict:
    districts = []
    for feature in geojson["features"]:
        name = feature["properties"]["name"]
        if not name.endswith("구"):
            raise ValueError(f"unexpected district: {name}")
        districts.append({"name": name, "rings": outer_rings(feature["geometry"], EPSILON_DEG)})
    if len(districts) != 25:
        raise ValueError(f"expected 25 districts, got {len(districts)}")
    districts.sort(key=lambda d: d["name"])
    return {"source": f"{SEOUL_REPO} ({SEOUL_PATH})", "license": LICENSE, "districts": districts}


def build_korea(geojson: dict) -> dict:
    districts = []
    for feature in geojson["features"]:
        code = feature["properties"]["code"]
        if code.startswith(SEOUL_CODE_PREFIX):
            continue  # 서울은 정밀 파일이 맡는다
        name = korea_label(feature["properties"]["name"], code)
        districts.append({"name": name, "rings": outer_rings(feature["geometry"], None)})
    if len(districts) != 226:
        raise ValueError(f"expected 226 districts outside Seoul, got {len(districts)}")
    if len({d["name"] for d in districts}) != len(districts):
        raise ValueError("duplicate labels")
    districts.sort(key=lambda d: d["name"])
    return {"source": f"{KOREA_REPO} ({KOREA_PATH})", "license": LICENSE, "districts": districts}


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


def write(out: Path, data: dict) -> None:
    out.write_text(dump(data))
    points = sum(len(r) for d in data["districts"] for r in d["rings"])
    print(f"wrote {out.relative_to(ROOT)}: {len(data['districts'])} districts, {points} points, {out.stat().st_size:,} bytes")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source-seoul", type=Path, help="받아 둔 서울 GeoJSON (없으면 다운로드)")
    parser.add_argument("--source-korea", type=Path, help="받아 둔 전국 GeoJSON (없으면 다운로드)")
    args = parser.parse_args()

    seoul = json.loads(args.source_seoul.read_text()) if args.source_seoul else fetch(SEOUL_URL)
    write(OUT_SEOUL, build_seoul(seoul))
    korea = json.loads(args.source_korea.read_text()) if args.source_korea else fetch(KOREA_URL)
    write(OUT_KOREA, build_korea(korea))
    return 0


if __name__ == "__main__":
    sys.exit(main())
