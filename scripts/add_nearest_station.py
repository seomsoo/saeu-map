#!/usr/bin/env python3
"""지하철 역·출구 좌표를 OSM(Overpass)에서 받아 supabase/seed/subway_exits.csv로 내보낸다.

출처: OpenStreetMap (Overpass API, 키 불필요) — 라이선스 ODbL. https://www.openstreetmap.org/copyright
Phase 6부터 최근접역은 **DB 트리거**(private.fill_nearest_station)가 이 표에서 계산한다 — 시드도 제보도 같은 길.
(전에는 이 스크립트가 lib/mock/places.json에 결과를 구웠다. 2026-09-10 내보내기 전용으로 축소.)

행 하나 = 출구 하나(exit_no) + 역마다 중심 행 하나(exit_no 빈 값 — 출구 데이터가 없는 역의 폴백).
lines는 세미콜론으로 이어 붙인다("2;경의중앙").

사용:
    python3 scripts/add_nearest_station.py --cache .osm            # 서울·부산·광주 (기본)
    python3 scripts/add_nearest_station.py --cache .osm --region seoul
    python3 scripts/add_nearest_station.py --cache .osm --out supabase/seed/subway_exits.csv

후속 과제: 실서비스 전에 공공데이터(국토부 역사 표준데이터)로 재생성. fetch 쿼리 세 개만 갈아끼우면 된다.
"""
import argparse
import csv
import json
import math
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = ROOT / "supabase" / "seed" / "subway_exits.csv"

OVERPASS = "https://overpass-api.de/api/interpreter"
UA = {"User-Agent": "saeu-map/1.0 (seed script; +https://github.com/seomsoo/saeu-map)"}

#: 지역 bbox (남,서,북,동). 서울은 수도권 인접 시(김포·고양·성남 등)까지, 부산은 기장·강서까지, 광주는 광산구까지.
REGIONS = {
    "seoul": (37.30, 126.60, 37.75, 127.25),
    "busan": (35.00, 128.75, 35.40, 129.35),
    "gwangju": (35.05, 126.65, 35.30, 127.05),
}

def q_stations(b):
    return f"""
[out:json][timeout:120];
node["railway"="station"]({b[0]},{b[1]},{b[2]},{b[3]});
out body;
"""

# 노선 릴레이션 → 멤버 노드. foreach로 "릴레이션 다음에 그 멤버"를 순서대로 뱉게 해 멤버십을 스트림 순서만으로 복원한다.
# 멤버를 ["railway"="station"]으로 거르면 안 된다 — 한국 노선 릴레이션의 멤버는 정차점(railway=stop)이라 전부 걸러진다.
def q_routes(b, route_expr):
    return f"""
[out:json][timeout:300];
rel["type"="route"]["route"{route_expr}]({b[0]},{b[1]},{b[2]},{b[3]});
foreach(
  out tags;
  node(r);
  out body;
);
"""

def q_entrances(b):
    return f"""
[out:json][timeout:180];
(node["railway"="subway_entrance"]({b[0]},{b[1]},{b[2]},{b[3]});
 node["railway"="train_station_entrance"]({b[0]},{b[1]},{b[2]},{b[3]}););
out body;
"""

#: 출구는 역 중심에서 이 거리 안에 있는 것만 그 역 소속으로 본다.
EXIT_OF_STATION_M = 300
#: 정차점이 그 역의 것으로 인정되는 거리(같은 이름 다른 역 — 신촌 2호선↔경의중앙선 704m — 을 섞지 않는 폭).
STOP_OF_STATION_M = 400
#: OSM 출구 ref에는 "엘리베이터"·"한강진역 2번출구" 같은 오염 값이 섞여 있다. 숫자(+부출구)만.
EXIT_REF = re.compile(r"^\d{1,2}(-\d)?$")
#: 배지로 그릴 수 있는 건 숫자 호선뿐.
NUMERIC_LINE = re.compile(r"^[1-9]$")


def is_passenger_station(tags: dict) -> bool:
    return (
        tags.get("station") in ("subway", "light_rail")
        or tags.get("subway") == "yes"
        or tags.get("train") == "yes"
    )


def haversine_m(a, b):
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
            with urllib.request.urlopen(urllib.request.Request(OVERPASS, data=body, headers=UA), timeout=320) as res:
                data = json.loads(res.read())
            break
        except Exception as err:  # 무료 미러라 dispatcher 과부하로 자주 튕긴다
            if attempt == 2:
                raise
            print(f"  재시도 {attempt + 1}/2 ({err})", file=sys.stderr)
            time.sleep(8)
    if cache is not None:
        cache.mkdir(parents=True, exist_ok=True)
        (cache / f"{key}.json").write_text(json.dumps(data, ensure_ascii=False))
    return data


def station_label(name: str) -> str:
    return name if name.endswith("역") else f"{name}역"


def build_stops(*route_docs):
    stops = []
    for doc in route_docs:
        line = None
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
    name = station["tags"]["name"]
    here = (station["lat"], station["lon"])
    found = {
        line for stop_name, lat, lon, line in stops
        if stop_name == name and haversine_m(here, (lat, lon)) <= STOP_OF_STATION_M
    }
    numeric = sorted(ln for ln in found if NUMERIC_LINE.match(ln))
    return numeric or sorted(found)


def export_region(region: str, cache: Path | None) -> list[dict]:
    b = REGIONS[region]
    print(f"[{region}] Overpass 질의 (역 / 노선 / 출구)…", file=sys.stderr)
    stations = [
        e for e in overpass(q_stations(b), cache, f"{region}-stations")["elements"]
        if e.get("tags", {}).get("name") and is_passenger_station(e["tags"])
    ]
    stops = build_stops(
        overpass(q_routes(b, '~"^(subway|light_rail)$"'), cache, f"{region}-routes"),
        overpass(q_routes(b, '="train"'), cache, f"{region}-routes-train"),
    )
    entrances = [
        e for e in overpass(q_entrances(b), cache, f"{region}-entrances")["elements"]
        if EXIT_REF.match(e.get("tags", {}).get("ref", ""))
    ]
    rows = []
    for st in stations:
        center = (st["lat"], st["lon"])
        label = station_label(st["tags"]["name"])
        lines = ";".join(lines_of(st, stops))
        rows.append({"station": label, "lines": lines, "exit_no": "", "lat": st["lat"], "lng": st["lon"]})
        for e in entrances:
            if haversine_m(center, (e["lat"], e["lon"])) <= EXIT_OF_STATION_M:
                rows.append({"station": label, "lines": lines, "exit_no": e["tags"]["ref"], "lat": e["lat"], "lng": e["lon"]})
    print(f"  역 {len(stations)} / 정차점 {len(stops)} / 출구 {len(entrances)} → 행 {len(rows)}", file=sys.stderr)
    return rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", type=Path, default=None, help="Overpass 응답 캐시 디렉터리(재실행 시 재질의 생략)")
    ap.add_argument("--region", default="seoul,busan,gwangju", help="쉼표로 여러 개")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()
    rows = []
    for region in args.region.split(","):
        rows.extend(export_region(region.strip(), args.cache))
    # 같은 입력이면 같은 출력(idempotent): 정렬해서 쓴다
    rows.sort(key=lambda r: (r["station"], r["exit_no"] or "", r["lat"], r["lng"]))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["station", "lines", "exit_no", "lat", "lng"], lineterminator="\n")
        w.writeheader()
        for r in rows:
            r["lat"] = round(r["lat"], 6)
            r["lng"] = round(r["lng"], 6)
            w.writerow(r)
    print(f"  → {args.out} ({len(rows)}행)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
