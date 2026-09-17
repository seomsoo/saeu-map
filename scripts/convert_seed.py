#!/usr/bin/env python3
"""크롤 CSV(서울 saewoo_seoul.csv · 지역 프로브 probe_*.csv) → 시드 JSON 한 파일.

docs/spec.md 2장 가공 규칙 구현:
- 새우 관련 메뉴만 추출 (raw 보존 + 표시용 name/price/unit/unit_raw 분리)
- 카테고리 = 다중 태그 (grill / raw), 새우 전문 플래그 = '주력', 사이드 3종 감지
- 이름 정제: 이모지·[프로모션]·(계절 한정 …)·"open!"·끝의 " 0"·이름에 박힌 가격 제거
- 단위 파싱: kg / g / pan(한판·반판) / count(마리·미·개·한마리) / size(소중대·특대) / serving(인분·N인·N~M인) / none

입력 두 모양을 다 읽는다 (2026-09-10 지역 확장):
  서울: 상호,구,도로명주소,지번주소,위도,경도,카테고리,place_id,플레이스링크,새우메뉴확정,수집메뉴,출처
  프로브: 지역,상호,분류,카테고리,도로명주소,지번주소,위도,경도,place_id,플레이스링크,수집메뉴
지역 표기는 앱 규칙(Place.gu): 서울 "마포구", 밖은 "해운대구(부산)"·"서구(광주)"·"목포시(전남)"·"무안군(전남)".

사용:
    python3 scripts/convert_seed.py --out supabase/seed/places.json --report \\
        ~/saewoo-map/saewoo_seoul.csv@2026-08-27 ~/saewoo-map/probe_busan.csv@2026-09-09 ~/saewoo-map/probe_gwangju.csv@2026-09-09
    --sample N  : 지역 섞어 N곳만(로컬·CI seed.sql용)
"@날짜"는 수집일(checkins type=seed의 시각, "○일 전 확인"의 기준)이다.
"""
import argparse
import csv
import json
import random
import re
import sys
from collections import Counter
from pathlib import Path

SHRIMP = re.compile(r"새우|대하|쉬림프|shrimp", re.I)
GRILL = re.compile(r"(?:새우|대하|쉬림프|shrimp)[^머리|]{0,8}구이", re.I)

KOREAN_NUM = {"한": 1, "두": 2, "세": 3, "네": 4, "다섯": 5, "여섯": 6, "열": 10}

#: 순서가 곧 우선순위 — "1kg(15~18미)"는 kg, "3~4인 50000"은 serving
UNIT_PATTERNS = [
    ("kg", re.compile(r"(\d+(?:\.\d+)?)\s*(?:kg|㎏|키로|킬로|k\b)", re.I)),
    ("g", re.compile(r"(\d{2,4})\s*(?:g\b|그램|그람)", re.I)),
    ("pan", re.compile(r"(한판|반판|\d+판)")),
    ("count", re.compile(r"(\d+\s*(?:마리|미\b|미\)|개\b|개\)|피스|pcs))", re.I)),
    ("count", re.compile(r"((?:한|두|세|네|다섯|여섯|열)\s*마리)")),
    ("serving", re.compile(r"(\d+\s*~\s*\d+\s*인(?:분|용)?|\d+\s*인(?:분|용)?(?![a-z가-힣]))")),
    ("size", re.compile(r"(?:^|[\(\s/])(특대|왕특|소|중|대|小|中|大)(?:$|[\)\s/])")),
]

PRICE = re.compile(r"([\d,]{4,9})\s*원?\s*$")
#: 이모지·기호(BMP 기호 블록 + 보조 평면 픽토그램 + 이형 선택자·ZWJ)
EMOJI = re.compile(r"[\U0001F000-\U0001FAFF☀-➿⬀-⯿⌀-⏿←-⇿️‍✅✨‼⁉〰〽㊗㊙]")
#: 괄호 안이 홍보·안내면 통째로 뗀다. 크기·마리 수 같은 정보는 남긴다.
PROMO_PAREN = re.compile(r"[\(\[［【]\s*[^)\]］】]*(?:계절|한정|축제|이벤트|예약|추천|인기|신메뉴|시즌|제철|싱싱|best|new|open|hot|오픈|할인|특가|서비스|포장|배달|권장|최고|가성비|강추|맛있|살아|당일|직송|필수|주문|가능)[^)\]］】]*[\)\]］】]", re.I)
#: 문장 부호·홍보 낱말은 이름 어디에 있든 뗀다("활!왕새우소금구이!"·"대하구이 오픈!"·"제철! 활 생새우회")
BANG_WORDS = re.compile(r"!+|\?+|(?<![a-z가-힣])(?:open|new|hot|best|오픈|신메뉴|강추|추천)(?![a-z가-힣])", re.I)
TRAILING_JUNK = re.compile(r"(?:\s+0|\s*0원)$")
#: 이름 안에 박힌 가격("대하 40000원 세트")·잔돈
INLINE_PRICE = re.compile(r"\s*\d{1,3}(?:,\d{3})+\s*원?|\s*\d{4,6}\s*원")


def clean_name(item: str) -> str:
    name = PRICE.sub("", item)
    name = PROMO_PAREN.sub(" ", name)
    name = re.sub(r"\[+[^\]]*\]+", " ", name)        # 남은 대괄호는 전부 홍보다("[[ 남녀노소 ]]"도)
    name = EMOJI.sub("", name)
    name = INLINE_PRICE.sub("", name)
    name = BANG_WORDS.sub(" ", name)
    name = re.sub(r"\s*\(\s*\)", "", name)           # 빈 괄호
    name = TRAILING_JUNK.sub("", name)
    name = re.sub(r"^[\s\-·~,.:)]+|[\s\-·~,.:(]+$", "", name)
    name = re.sub(r"\s{2,}", " ", name).strip()
    return name


def parse_unit(item: str):
    for unit, pat in UNIT_PATTERNS:
        m = pat.search(item)
        if m:
            raw = next(g for g in m.groups() if g)
            raw = re.sub(r"\s+", "", raw)
            if unit == "count":
                for k, v in KOREAN_NUM.items():
                    if raw.startswith(k):
                        raw = f"{v}{raw[len(k):]}"
            return unit, raw
    return "none", None


def parse_menu_item(item: str):
    item = item.strip()
    if not item:
        return None
    m = PRICE.search(item)
    price = int(m.group(1).replace(",", "")) if m else None
    if price is not None and price < 100:
        price = None                                   # "새우머리튀김 0" 같은 잔재
    name = clean_name(item)
    if not name:
        return None
    unit, unit_raw = parse_unit(item)
    return {"raw": item, "name": name[:200], "price": price, "unit": unit, "unit_raw": unit_raw}


REGION_PREFIX = {"부산": "부산", "광주": "광주", "전남": "전남", "경기": "경기", "인천": "인천"}
CITY_SUFFIX = {"목포": "목포시", "무안": "무안군"}


def normalize_gu(row: dict) -> str:
    """서울 CSV의 '구'는 이미 앱 규칙("마포구"·"김포시(경기)"). 프로브의 '지역'("부산 해운대구"·"전남 목포")을 같은 규칙으로."""
    if "구" in row and row["구"] is not None:
        gu = str(row["구"]).strip()
        return gu
    region = str(row.get("지역", "")).strip()
    parts = region.split()
    if len(parts) == 2 and parts[0] in REGION_PREFIX:
        sido, name = parts
        name = CITY_SUFFIX.get(name, name)
        return f"{name}({sido})"
    return region


def convert_row(row: dict, collected_at: str):
    items = [parse_menu_item(x) for x in str(row.get("수집메뉴") or "").split("|")]
    items = [x for x in items if x]
    shrimp_items = [x for x in items if SHRIMP.search(x["raw"])]
    # 새우 낱말 뒤 8자 안에 "구이"가 오면 구이 메뉴다 — "새우소금구이(머리구이포함)"는 구이, "생새우&머리버터구이"는 아니다(머리를 못 넘는다)
    grill = [x for x in shrimp_items if GRILL.search(x["raw"])]
    raw_fish = [x for x in shrimp_items if re.search(r"회(?!원|식)", x["raw"])]
    classification = str(row.get("새우메뉴확정") or row.get("분류") or "").strip()
    tags = []
    if grill:
        tags.append("grill")
    if raw_fish:
        tags.append("raw")
    if not tags and classification == "생새우회":
        tags.append("raw")
    if not tags:
        tags.append("grill")   # 주력/취급인데 파싱 실패 → 구이로 두고 검수 표시
    all_raw = str(row.get("수집메뉴") or "")
    sides = {
        "headButter": bool(re.search(r"머리", all_raw)),
        "ramen": bool(re.search(r"라면", all_raw)),
        "friedRice": bool(re.search(r"볶음밥", all_raw)),
    }
    menus = sorted(shrimp_items, key=lambda x: (x["price"] is None, -(x["price"] or 0)))[:5]
    gu = normalize_gu(row)
    needs_review = (
        len(shrimp_items) == 0
        or classification in ("", "미확인")
        or not gu
        or (not grill and classification != "생새우회")   # 구이 메뉴가 안 잡혔는데 회 전문도 아니다 → 오탐 의심
    )
    naver = str(row.get("플레이스링크") or "").strip() or None
    return {
        "seedRef": str(row["place_id"]).strip(),
        "name": str(row["상호"]).strip(),
        "gu": gu or "미상",
        "addressRoad": (str(row.get("도로명주소") or "").strip() or None),
        "addressJibun": (str(row.get("지번주소") or "").strip() or None),
        "lat": round(float(row["위도"]), 7),
        "lng": round(float(row["경도"]), 7),
        "tags": tags,
        "specialist": classification == "주력",
        "naverPlaceUrl": naver,
        "menus": menus,
        "sides": sides,
        "source": "seed",
        "needsReview": needs_review,
        "collectedAt": collected_at,
    }


def read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def report(places: list[dict], per_file: list[tuple[str, int]]) -> None:
    items = [m for p in places for m in p["menus"]]
    units = Counter(m["unit"] for m in items)
    # 단위 표기가 있어 보이는데(숫자 + 단위 낱말) 못 잡은 것 = 진짜 미파싱
    unit_ish = re.compile(r"\d\s*(?:kg|㎏|키로|g\b|그램|판|마리|미\b|개|인|pcs)|(?:한|두|세)\s*마리|[\(\s](?:소|중|대|특대)[\)\s]", re.I)
    missed = [m for m in items if m["unit"] == "none" and unit_ish.search(m["raw"])]
    dirty = [m for m in items if re.search(r"[\[\]🔥⭐]|open|!|\s0$", m["name"], re.I)]
    print("── 변환 리포트 ─────────────────────────────", file=sys.stderr)
    for name, n in per_file:
        print(f"  {name}: {n}곳", file=sys.stderr)
    print(f"  합계 {len(places)}곳 · 검수 필요(숨김) {sum(p['needsReview'] for p in places)}곳 · 새우 메뉴 줄 {len(items)}", file=sys.stderr)
    print(f"  태그: grill {sum('grill' in p['tags'] for p in places)} / raw {sum('raw' in p['tags'] for p in places)} / 둘 다 {sum(len(p['tags']) == 2 for p in places)}", file=sys.stderr)
    print(f"  단위: {dict(units)}", file=sys.stderr)
    print(f"  단위 낱말이 있는데 못 잡은 줄: {len(missed)} ({len(missed) / max(len(items), 1):.1%})", file=sys.stderr)
    for m in missed[:12]:
        print(f"      {m['raw']}", file=sys.stderr)
    print(f"  이름에 잔재(대괄호·이모지·open·!·끝 0) 남은 줄: {len(dirty)}", file=sys.stderr)
    for m in dirty[:8]:
        print(f"      {m['raw']} → {m['name']}", file=sys.stderr)
    gu = Counter(p["gu"] for p in places)
    print(f"  지역(상위 8): {gu.most_common(8)}", file=sys.stderr)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="+", help="csv@YYYY-MM-DD")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--sample", type=int, default=None)
    ap.add_argument("--report", action="store_true")
    args = ap.parse_args()

    places, seen, per_file = [], set(), []
    for spec in args.inputs:
        path_s, _, date = spec.partition("@")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
            print(f"수집일이 없다: {spec} (csv@YYYY-MM-DD)", file=sys.stderr)
            return 2
        rows = read_csv(Path(path_s).expanduser())
        n = 0
        for row in rows:
            if not str(row.get("place_id") or "").strip():
                continue
            p = convert_row(row, date)
            if p["seedRef"] in seen:
                continue
            seen.add(p["seedRef"])
            places.append(p)
            n += 1
        per_file.append((Path(path_s).name, n))

    if args.sample:
        rnd = random.Random(42)
        by_region = {}
        for p in places:
            key = re.search(r"\((.+)\)$", p["gu"])
            by_region.setdefault(key.group(1) if key else "서울", []).append(p)
        picked = []
        # 서울 60% + 나머지 지역 균등, 검수 필요는 1곳만(숨김 경로 확인용)
        quota = {"서울": max(1, round(args.sample * 0.6))}
        others = [k for k in by_region if k != "서울"]
        for k in others:
            quota[k] = max(1, (args.sample - quota["서울"]) // max(len(others), 1))
        for k, pool in by_region.items():
            clean = [p for p in pool if not p["needsReview"]]
            picked.extend(rnd.sample(clean, min(quota.get(k, 0), len(clean))))
        review = [p for p in places if p["needsReview"]]
        if review:
            picked.append(rnd.choice(review))
        places = sorted(picked[: args.sample + 1], key=lambda p: p["seedRef"])

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(places, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    if args.report:
        report(places, per_file)
    print(f"→ {args.out} ({len(places)}곳)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
