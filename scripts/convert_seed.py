#!/usr/bin/env python3
"""새우맵 시드 CSV → 서비스 데이터 변환기.

docs/spec.md 2장 가공 규칙 구현:
- 새우 관련 메뉴만 추출 (raw 보존 + 표시용 name/price/unit 분리)
- 카테고리 = 다중 태그 (grill / raw)
- 새우 전문 플래그 = 새우메뉴확정 '주력'
- 곁들임 3종 감지 (머리버터구이 / 라면 / 볶음밥)
- 단위 파싱: kg / g / pan(한판·반판) / count(마리·미) / size(소중대) / none

사용: python3 convert_seed.py <csv> <out_dir> [--sample N]
전체 변환(--sample 없이)이 Phase 6 임포트의 입력이 된다.
재변환 후에는 add_nearest_station.py를 다시 돌려야 nearestStation이 채워진다.
"""
import sys, re, json, random
import pandas as pd
from pathlib import Path

SHRIMP = re.compile(r"새우|대하|쉬림프|shrimp", re.I)

UNIT_PATTERNS = [
    ("kg",    re.compile(r"(\d+(?:\.\d+)?)\s*(?:kg|㎏|키로|킬로)", re.I)),
    ("g",     re.compile(r"(\d{2,4})\s*(?:g\b|그램)", re.I)),
    ("pan",   re.compile(r"(한판|반판|\d+판)")),
    ("count", re.compile(r"(\d+\s*(?:마리|미\b|미\)))")),
    ("size",  re.compile(r"[\(\s](소|중|대)[\)\s]|(?:^|\s)(소|중|대)$")),
    ("serving", re.compile(r"(\d*\s*인분)")),
]

PRICE = re.compile(r"([\d,]{4,9})\s*원?\s*$")

def parse_menu_item(item: str):
    item = item.strip()
    if not item:
        return None
    m = PRICE.search(item)
    price = int(m.group(1).replace(",", "")) if m else None
    name = PRICE.sub("", item).strip(" -·~")
    # 표시용 정제: 이모지·[프로모션]·연속 공백 제거
    name = re.sub(r"\[[^\]]*\]", "", name)
    name = re.sub(r"[\U0001F300-\U0001FAFF\u2600-\u27BF]", "", name)
    name = re.sub(r"\s{2,}", " ", name).strip()
    unit, unit_raw = "none", None
    for u, pat in UNIT_PATTERNS:
        mm = pat.search(item)
        if mm:
            unit = u
            unit_raw = next(g for g in mm.groups() if g)
            break
    return {"raw": item, "name": name, "price": price, "unit": unit, "unit_raw": unit_raw}

def convert_row(idx, row):
    items = [parse_menu_item(x) for x in str(row["수집메뉴"]).split("|")]
    items = [x for x in items if x]
    shrimp_items = [x for x in items if SHRIMP.search(x["raw"])]
    grill = [x for x in shrimp_items if "구이" in x["raw"] and "머리" not in x["raw"]]
    raw_fish = [x for x in shrimp_items if re.search(r"회(?!원|식)", x["raw"])]
    tags = []
    if grill: tags.append("grill")
    if raw_fish: tags.append("raw")
    if not tags and row["새우메뉴확정"] == "생새우회": tags.append("raw")
    if not tags: tags.append("grill")  # 주력/취급인데 파싱 실패 → 구이로 두고 검수 표시
    all_raw = str(row["수집메뉴"])
    sides = {
        "headButter": bool(re.search(r"머리", all_raw)),
        "ramen": bool(re.search(r"라면", all_raw)),
        "friedRice": bool(re.search(r"볶음밥", all_raw)),
    }
    # 표시 메뉴: 새우 메뉴만, 가격 있는 것 우선, 최대 5개
    menus = sorted(shrimp_items, key=lambda x: (x["price"] is None, -(x["price"] or 0)))[:5]
    return {
        "id": f"p{idx:03d}",
        "name": str(row["상호"]).strip(),
        "gu": str(row["구"]).strip(),
        "addressRoad": str(row["도로명주소"]).strip(),
        "addressJibun": str(row["지번주소"]).strip() if pd.notna(row["지번주소"]) else None,
        "lat": round(float(row["위도"]), 7),
        "lng": round(float(row["경도"]), 7),
        "tags": tags,
        "specialist": row["새우메뉴확정"] == "주력",
        "naverPlaceUrl": str(row["플레이스링크"]).strip() if pd.notna(row["플레이스링크"]) else None,
        "menus": menus,
        "sides": sides,
        "source": "seed",
        "needsReview": len(shrimp_items) == 0,
    }

def main():
    csv_path, out_dir = sys.argv[1], Path(sys.argv[2])
    sample_n = None
    if "--sample" in sys.argv:
        sample_n = int(sys.argv[sys.argv.index("--sample") + 1])
    out_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(csv_path)

    places = [convert_row(i + 1, r) for i, (_, r) in enumerate(df.iterrows())]

    if sample_n:
        rnd = random.Random(42)
        grills = [p for p in places if p["tags"] == ["grill"]]
        both = [p for p in places if set(p["tags"]) == {"grill", "raw"}]
        raws = [p for p in places if p["tags"] == ["raw"]]
        kg = [p for p in places if any(m["unit"] == "kg" for m in p["menus"])]
        pan = [p for p in places if any(m["unit"] == "pan" for m in p["menus"])]
        pick, seen = [], set()
        def add(pool, n):
            for p in rnd.sample(pool, min(n, len(pool))):
                if p["id"] not in seen:
                    seen.add(p["id"]); pick.append(p)
        add(kg, 6); add(pan, 4); add(raws, 3); add(both, 12); add(grills, 50)
        places = sorted(pick[:sample_n], key=lambda p: p["id"])

    # 목 전용: 상태 다양화 (시드 기본 = 8/25 메뉴 확인)
    rnd = random.Random(7)
    checkins, reviews = [], []
    for i, p in enumerate(places):
        p["lastCheckedAt"] = "2026-08-25"
        p["checkCount"] = 0
        p["isNew"] = False
        checkins.append({"placeId": p["id"], "type": "menu_verified", "at": "2026-08-25T10:00:00+09:00", "actor": "admin"})
    lively = rnd.sample(places, min(8, len(places)))
    for p in lively:  # 이번 주 확인 상태
        n = rnd.randint(1, 5)
        p["checkCount"] = n
        p["lastCheckedAt"] = f"2026-08-{rnd.randint(26,28):02d}"
        for k in range(n):
            checkins.append({"placeId": p["id"], "type": "visited", "at": f"2026-08-{rnd.randint(26,28):02d}T{rnd.randint(12,22):02d}:00:00+09:00", "actor": f"anon-{rnd.randint(1000,9999)}"})
    for p in rnd.sample([x for x in places if x["checkCount"] == 0], 3):  # 새로 제보됨
        p["isNew"] = True
        p["source"] = "report"
        p["createdAt"] = "2026-08-27"
    rv_target = lively[0]
    reviews.append({"placeId": rv_target["id"], "rating": 5, "text": "대하 크기가 실했어요. 머리 버터구이 꼭 시키세요.", "nickname": "새우헌터", "at": "2026-08-27T21:00:00+09:00"})
    reviews.append({"placeId": rv_target["id"], "rating": 4, "text": "회 반반 추천. 웨이팅 있음.", "nickname": "을지로사람", "at": "2026-08-26T20:00:00+09:00"})

    (out_dir / "places.json").write_text(json.dumps(places, ensure_ascii=False, indent=2), encoding="utf-8")
    (out_dir / "checkins.json").write_text(json.dumps(sorted(checkins, key=lambda c: c["at"], reverse=True), ensure_ascii=False, indent=2), encoding="utf-8")
    (out_dir / "reviews.json").write_text(json.dumps(reviews, ensure_ascii=False, indent=2), encoding="utf-8")
    units = {}
    for p in places:
        for m in p["menus"]:
            units[m["unit"]] = units.get(m["unit"], 0) + 1
    print(f"places={len(places)} units={units} needsReview={sum(p['needsReview'] for p in places)}")

if __name__ == "__main__":
    main()
