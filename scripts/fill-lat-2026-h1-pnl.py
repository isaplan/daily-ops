#!/usr/bin/env python3
"""Fill l'Amour (LAT) 2026 Jan–Jun accounting P&L from Analyse screenshots."""

from __future__ import annotations

import json
import urllib.request

BASE = "http://localhost:8080"

REV_FOOD = {
    "bier": [0, 0, 0, 0, 0, 0],
    "snacks": [3388, 512, 285, 449, 398, 901],
    "lunch": [0, 43, 0, 0, 0, 0],
    "diner": [47916, 42215, 41926, 47306, 38085, 28481],
    "menus": [2702, 2007, 2322, 2408, 3531, 3240],
    "keukenOverig": [0, 0, 0, 0, 0, 0],
}

REV_BEV = {
    "wijnen": [13424, 14748, 14719, 14296, 12870, 7713],
    "gedestilleerd": [2352, 1676, 1684, 1998, 1804, 2761],
    "cocktails": [2674, 3454, 6776, 9609, 8011, 4979],
    "cider": [155, 21, 18, 29, 22, 11],
    "hoogOverig": [0, 0, 0, 0, 0, 0],
    "warmeDranken": [0, 0, 0, 0, 0, 0],
    "speciaalbierFles": [309, 369, 626, 658, 725, 599],
    "speciaalbierTap": [2110, 1431, 3025, 4314, 3534, 2313],
    "tapPilsner": [967, 1012, 1905, 2407, 2014, 1904],
    "koffieThee": [3078, 2918, 3653, 3673, 2484, 1919],
    "frisdranken": [4014, 3182, 4279, 5694, 4880, 4083],
    "alcoholVrij": [1105, 912, 1687, 2002, 1918, 1350],
    "laagOverig": [889, 71, 526, 20, 19, 1413],
    "loterij": [0, 0, 0, 0, 0, 0],
    "overigeOpbrengsten": [0, 0, 0, 0, 0, 0],
    "verkoopkortingen": [0, 0, 0, 0, 0, 0],
    "nonFood": [0, 0, 0, 0, 0, 0],
}

COGS_FOOD = {
    "keukenHoog": [224, 224, 280, 224, 224, 280],
    "keukenLaag": [18750, 20647, 17976, 16839, 17272, 14721],
    "uitbesteed": [0, 0, 0, 0, 0, 0],
}

# Analyse credits shown positive → negative cost here
COGS_BEV = {
    "bierenFles": [426, -1121, 998, -497, 1635, -1172],
    "bierenLaag": [-17, -29, -7, -134, 277, -26],
    "wijnen": [4730, 8612, 5256, 4834, 7858, 3173],
    "sterke": [838, 1135, 756, 1703, 1964, 1368],
    "speciaalFles": [-869, -821, 720, -501, 1432, -76],
    "speciaalTap": [1418, 503, 1251, 1658, 1854, 1164],
    "pils": [0, 2383, 0, 2360, 0, 2369],
    "koffie": [417, 745, 513, 750, 856, -133],
    "fris": [1280, 1197, 1375, 1410, 1444, 695],
    "alcoholvrij": [431, 571, 595, 151, 771, 653],
    "barOverigHoog": [0, 0, 40, 0, 0, 0],
    "inkopenOverigHoog": [0, 14, 52, 94, 56, 77],
    "barOverige": [492, 506, 504, 806, 455, 651],
    # Mar Analyse −169 increases kostprijs → +169 cost
    "inkoopkortingen": [0, 0, 169, 0, 0, 0],
    "statiegeld": [0, 0, 0, 0, 0, 0],
}

LABOR_LONEN = {
    "salarisBediening": [8631, 8550, 8797, 11506, 13131, 9651],
    "salarisKeuken": [14550, 13760, 13359, 17001, 11268, 11135],
    "salarisOverhead": [0, 0, 0, 0, 0, 0],
    "inhuurFb": [6692, 7604, 8331, 9522, 9040, 5439],
    "inhuurAfwas": [0, 0, 0, 0, 0, 0],
    "inhuurStewarding": [1631, 1755, 1892, 2048, 2385, 1451],
    "inhuurKeuken": [1559, 2395, 6066, 2039, 2991, 515],
    "inhuurOverhead": [4602, 5358, 4795, -2770, 1665, 930],
    "overigLonen": [2217, 5557, -3115, 6356, 5076, -98],
}

LABOR_SOCIALE = [4017, 5323, 4198, 7061, 5023, 5977]
LABOR_PENSIOEN = [1217, 1158, 1156, 1951, 1254, 1889]
LABOR_OVERIG = [0, 0, 0, 0, 0, 0]

FIXED_OVERIGE = [30165, 25838, 34185, 27154, 26793, 19005]
FIXED_AFSCHRIJVING = [12935, 13115, 13150, 13268, 13269, 13269]
FIXED_FINANCIEEL = [5302, 5302, 4310, 5798, 5302, 5302]
FIXED_OPBRENGST = [0, 0, 0, 0, 0, 0]


def pick(m: dict, i: int) -> dict:
    return {k: v[i] for k, v in m.items()}


def seal(row: dict) -> dict:
    food_lines = row["revenueFoodLines"]
    bev_lines = row["revenueBevLines"]
    cogs_food_lines = row["cogsFoodLines"]
    cogs_bev_lines = row["cogsBevLines"]
    lonen_lines = row["laborLonenLines"]

    revenue_food = sum(food_lines.values())
    revenue_bev = sum(bev_lines.values())
    cogs_food = sum(cogs_food_lines.values())
    cogs_bev = sum(cogs_bev_lines.values())
    labor_lonen = sum(lonen_lines.values())

    revenue = revenue_food + revenue_bev
    cogs = cogs_food + cogs_bev
    labor = labor_lonen + row["laborSocialeLasten"] + row["laborPensioen"] + row["laborOverig"]
    fixed = (
        row["fixedOverige"]
        + row["fixedAfschrijving"]
        + row["fixedFinancieel"]
        + row["fixedOpbrengstVorderingen"]
    )
    return {
        **row,
        "revenue": revenue,
        "revenueFood": revenue_food,
        "revenueBeverage": revenue_bev,
        "cogs": cogs,
        "cogsFood": cogs_food,
        "cogsBeverage": cogs_bev,
        "labor": labor,
        "laborLonen": labor_lonen,
        "fixed": fixed,
        "result": revenue - cogs - labor - fixed,
    }


def build_lat(i: int) -> dict:
    return seal(
        {
            "revenueFoodLines": pick(REV_FOOD, i),
            "revenueBevLines": pick(REV_BEV, i),
            "cogsFoodLines": pick(COGS_FOOD, i),
            "cogsBevLines": pick(COGS_BEV, i),
            "laborLonenLines": pick(LABOR_LONEN, i),
            "laborSocialeLasten": LABOR_SOCIALE[i],
            "laborPensioen": LABOR_PENSIOEN[i],
            "laborOverig": LABOR_OVERIG[i],
            "fixedOverige": FIXED_OVERIGE[i],
            "fixedAfschrijving": FIXED_AFSCHRIJVING[i],
            "fixedFinancieel": FIXED_FINANCIEEL[i],
            "fixedOpbrengstVorderingen": FIXED_OPBRENGST[i],
        }
    )


def get_month(month: int) -> dict:
    with urllib.request.urlopen(f"{BASE}/api/daily-ops/finance/pnl?year=2026&month={month}", timeout=60) as r:
        return json.load(r)


def put(periods: list) -> dict:
    req = urllib.request.Request(
        f"{BASE}/api/daily-ops/finance/pnl",
        data=json.dumps({"periods": periods, "refreshAssumptions": False}).encode(),
        headers={"content-type": "application/json"},
        method="PUT",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def main() -> None:
    periods = []
    for i in range(6):
        month = i + 1
        data = get_month(month)
        venues = {l["key"]: l["row"] for l in data["lines"] if l["key"] != "combined"}
        lat = build_lat(i)
        venues["lat"] = {**venues.get("lat", {}), **lat}
        periods.append(
            {
                "year": 2026,
                "month": month,
                "venues": {
                    "vkb": venues["vkb"],
                    "bea": venues["bea"],
                    "lat": venues["lat"],
                },
            }
        )
        print(
            f"m{month} rev={lat['revenue']} cogs={lat['cogs']} labor={lat['labor']} "
            f"fixed={lat['fixed']} result={lat['result']}"
        )

    print("PUT", put(periods))


if __name__ == "__main__":
    main()
