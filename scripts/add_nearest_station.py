#!/usr/bin/env python3
"""lib/mock/places.json에 최근접 지하철역·호선·출구를 채운다.

출처: OpenStreetMap (Overpass API, 키 불필요) — 라이선스 ODbL.
      https://www.openstreetmap.org/copyright
좌표·주소와 같은 성격의 '시드 시점 외부 파생 사실'이라 JSON에 구워 둔다.
역 노드 473 + 노선 릴레이션 170 + 출구 노드 1,823개(≈3.6MB)를 클라이언트 번들에
올리지 않기 위함이다. Phase 6에서는 서버 쓰기 시점에 채우는 컬럼이 될 자리다.

후속 과제: 실서비스 전에 공공데이터(국토부 역사 표준데이터, 공공누리 1유형)로
재생성한다. 아래 fetch_* 세 함수만 갈아끼우면 된다.

사용:
    python3 scripts/add_nearest_station.py                  # Overpass 3회 질의
    python3 scripts/add_nearest_station.py --cache .osm     # 응답 캐시(재실행 시 재질의 생략)
    python3 scripts/add_nearest_station.py --dry-run        # 파일을 쓰지 않고 요약만

convert_seed.py로 places.json을 다시 만들면 이 스크립트도 다시 돌려야 한다.
같은 입력에 대해 결과가 같다(idempotent) — 재실행 후 git diff가 비어야 정상.
"""
import argparse
import json
import math
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLACES = ROOT / "lib" / "mock" / "places.json"

OVERPASS = "https://overpass-api.de/api/interpreter"
UA = {"User-Agent": "saeu-map/1.0 (seed script; +https://github.com/)"}

# 역 노드: 서울 + 인접 시(김포 고촌 등 경계 밖 가게가 있다).
# 태그 조합을 Overpass에서 union하면 504가 나서, 통째로 받아 파이썬에서 거른다.
Q_STATIONS = """
[out:json][timeout:120];
node["railway"="station"](37.30,126.60,37.75,127.25);
out body;
"""

# 노선 릴레이션 → 멤버 노드. foreach로 "릴레이션 다음에 그 멤버"를 순서대로 뱉게 해
# 멤버십을 스트림 순서만으로 복원한다(별도 조인 불필요).
# 멤버를 `["railway"="station"]`으로 거르면 안 된다 — 한국 노선 릴레이션의 멤버는
# 역 노드가 아니라 승강장 정차점(railway=stop)이라 전부 걸러져 빈 결과가 나온다.
Q_ROUTES = """
[out:json][timeout:300];
rel["type"="route"]["route"~"^(subway|light_rail)$"](37.30,126.60,37.75,127.25);
foreach(
  out tags;
  node(r);
  out body;
);
"""

Q_ROUTES_TRAIN = """
[out:json][timeout:300];
rel["type"="route"]["route"="train"](37.30,126.60,37.75,127.25);
foreach(
  out tags;
  node(r);
  out body;
);
"""

Q_ENTRANCES = """
[out:json][timeout:180];
(node["railway"="subway_entrance"](37.30,126.60,37.75,127.25);
 node["railway"="train_station_entrance"](37.30,126.60,37.75,127.25););
out body;
"""

#: 출구는 역 중심에서 이 거리 안에 있는 것만 그 역 소속으로 본다.
EXIT_OF_STATION_M = 300

#: OSM 출구 ref에는 "엘리베이터"·"한강진역 2번출구" 같은 오염 값이 섞여 있다.
#: 숫자(+부출구)만 채택하고 나머지는 출구 없는 것으로 취급한다.
EXIT_REF = re.compile(r"^\d{1,2}(-\d)?$")

#: 배지로 그릴 수 있는 건 숫자 호선뿐(수인·분당, 김포 골드라인 등은 역명만 나온다).
NUMERIC_LINE = re.compile(r"^[1-9]$")


#: 사진 항목은 원래 한 줄이라 indent=2가 펼쳐 놓으면 우리가 건드리지도 않은 줄에
#: diff가 생긴다. 덤프 뒤 그 형태만 되돌려 커밋을 nearestStation 추가로만 남긴다.
PHOTO_ENTRY = re.compile(
    r'\{\n\s+"url": ("[^"]*"),\n\s+"at": ("[^"]*")\n\s*\}'
)


def dump(places: list) -> str:
    text = json.dumps(places, ensure_ascii=False, indent=2)
    return PHOTO_ENTRY.sub(lambda m: f'{{ "url": {m.group(1)}, "at": {m.group(2)} }}', text) + "\n"


def is_passenger_station(tags: dict) -> bool:
    """지하철·경전철·전철역만. 화물역·폐역 등은 뺀다."""
    return (
        tags.get("station") in ("subway", "light_rail")
        or tags.get("subway") == "yes"
        or tags.get("train") == "yes"
    )


def haversine_m(a, b):
    """lib/geo.ts의 haversineKm과 같은 식 (여기 단위는 m)."""
    r = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp = p2 - p1
    dl = math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def overpass(query: str, cache: Path | None, key: str) -> dict:
    if cache is not None:
        hit = cache / f"{key}.json"
        if hit.exists():
            return json.loads(hit.read_text())
    body = urllib.parse.urlencode({"data": query}).encode()
    for attempt in range(3):
        try:
            with urllib.request.urlopen(
                urllib.request.Request(OVERPASS, data=body, headers=UA), timeout=320
            ) as res:
                raw = res.read()
            data = json.loads(raw)
            break
        except Exception as err:  # 무료 미러라 dispatcher 과부하로 자주 튕긴다
            if attempt == 2:
                raise
            print(f"  재시도 {attempt + 1}/2 ({err})", file=sys.stderr)
            time.sleep(5)
    if cache is not None:
        cache.mkdir(parents=True, exist_ok=True)
        (cache / f"{key}.json").write_text(json.dumps(data, ensure_ascii=False))
    return data


def station_label(name: str) -> str:
    """이미 '역'으로 끝나는 이름(서울역)에 '역'을 또 붙이지 않는다."""
    return name if name.endswith("역") else f"{name}역"


#: 정차점이 그 역의 것으로 인정되는 거리. 같은 이름 다른 역(신촌 2호선↔경의중앙선 704m)을
#: 섞지 않으면서 승강장이 역 중심에서 떨어진 경우는 잡는 폭.
STOP_OF_STATION_M = 400


def build_stops(*route_docs) -> list[tuple[str, float, float, str]]:
    """foreach 출력(릴레이션 → 그 멤버 정차점들)을 (역이름, lat, lon, 호선) 목록으로 편다."""
    stops: list[tuple[str, float, float, str]] = []
    for doc in route_docs:
        line: str | None = None
        for el in doc["elements"]:
            if el["type"] == "relation":
                tags = el.get("tags", {})
                line = tags.get("ref") or tags.get("name")
            elif el["type"] == "node" and line:
                name = el.get("tags", {}).get("name")
                if name:
                    stops.append((name, el["lat"], el["lon"], line))
    return stops


def lines_of(station: dict, stops) -> list[str]:
    """역이름이 같고 가까이 있는 정차점의 노선들. 숫자 호선이 있으면 그것만 쓴다."""
    name = station["tags"]["name"]
    here = (station["lat"], station["lon"])
    found = {
        line
        for stop_name, lat, lon, line in stops
        if stop_name == name and haversine_m(here, (lat, lon)) <= STOP_OF_STATION_M
    }
    numeric = sorted(ln for ln in found if NUMERIC_LINE.match(ln))
    return numeric or sorted(found)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", type=Path, default=None, help="Overpass 응답 캐시 디렉터리")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    print("Overpass 질의 (역 / 노선 / 출구)…", file=sys.stderr)
    stations = [
        e
        for e in overpass(Q_STATIONS, args.cache, "stations")["elements"]
        if e.get("tags", {}).get("name") and is_passenger_station(e["tags"])
    ]
    stops = build_stops(
        overpass(Q_ROUTES, args.cache, "routes"),
        overpass(Q_ROUTES_TRAIN, args.cache, "routes-train"),
    )
    entrances = [
        e
        for e in overpass(Q_ENTRANCES, args.cache, "entrances")["elements"]
        if EXIT_REF.match(e.get("tags", {}).get("ref", ""))
    ]
    print(
        f"  역 {len(stations)} / 정차점 {len(stops)} / 출구 {len(entrances)}",
        file=sys.stderr,
    )

    places = json.loads(PLACES.read_text())
    out = []
    for place in places:
        here = (place["lat"], place["lng"])
        # 이름으로 병합하지 않는다 — 같은 이름 다른 위치가 실재한다(신촌 2호선↔경의중앙선 704m).
        station = min(stations, key=lambda s: haversine_m(here, (s["lat"], s["lon"])))
        center = (station["lat"], station["lon"])

        # 그 역의 출구 중 가게에서 가장 가까운 것. 없으면 역 중심까지의 거리를 쓴다.
        mine = [e for e in entrances if haversine_m(center, (e["lat"], e["lon"])) <= EXIT_OF_STATION_M]
        if mine:
            exit_node = min(mine, key=lambda e: haversine_m(here, (e["lat"], e["lon"])))
            exit_ref = exit_node["tags"]["ref"]
            distance = haversine_m(here, (exit_node["lat"], exit_node["lon"]))
        else:
            exit_ref = None
            distance = haversine_m(here, center)

        lines = lines_of(station, stops)

        nearest = {
            "name": station_label(station["tags"]["name"]),
            "exit": exit_ref,
            "distanceM": round(distance),
            "lines": lines,
        }
        # 컷(800m)은 데이터가 아니라 lib/data.ts가 갖는다 — 여기엔 사실만 굽는다.
        rebuilt = {}
        for key, value in place.items():
            rebuilt[key] = value
            if key == "lng":
                rebuilt["nearestStation"] = nearest
        out.append(rebuilt)

    within = sum(1 for p in out if p["nearestStation"]["distanceM"] <= 800)
    with_exit = sum(1 for p in out if p["nearestStation"]["exit"])
    print(
        f"  {len(out)}곳: 800m 이내 {within} / 출구번호 {with_exit} / "
        f"호선 매칭 {sum(1 for p in out if p['nearestStation']['lines'])}",
        file=sys.stderr,
    )

    if args.dry_run:
        for p in out[:5]:
            print(p["name"], p["nearestStation"], file=sys.stderr)
        return 0

    PLACES.write_text(dump(out))
    print(f"  → {PLACES.relative_to(ROOT)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
