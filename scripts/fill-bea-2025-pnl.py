#!/usr/bin/env python3
"""Fill Bar Bea (BEA) 2025 Jan–Dec accounting P&L from Analyse screenshots.

Costs = positive magnitudes; credits signed negative. Residuals in laagOverig /
barOverige so sealed parents match Analyse. Preserves VKB/LAT.

Run: python3 scripts/fill-bea-2025-pnl.py
"""

from __future__ import annotations

import json
import urllib.request

BASE = "http://localhost:8080"

REV_FOOD = {
    "bier": [0] * 12,
    "snacks": [7958, 10308, 16803, 17536, 18249, 14284, 15205, 13883, 11963, 9858, 8762, 7311],
    "lunch": [1697, 2898, 5707, 3486, 4096, 3006, 2188, 2533, 2426, 2160, 2219, 1103],
    "diner": [21400, 23506, 28528, 24443, 30232, 22953, 27034, 24726, 13846, 19962, 18909, 16487],
    "menus": [1820, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3696],
    "keukenOverig": [28, 1237, 515, 119, 2906, 299, 1078, 536, 481, 592, 2040, 8063],
}

REV_BEV = {
    "wijnen": [13510, 13823, 20147, 17277, 21123, 15128, 17586, 15989, 15397, 15983, 16393, 13388],
    "gedestilleerd": [6227, 5680, 7848, 9095, 10008, 6611, 7699, 7056, 8334, 10649, 9250, 9965],
    "cocktails": [7597, 8673, 14615, 15452, 18408, 15979, 15835, 14932, 11493, 10890, 10113, 8428],
    "cider": [542, 638, 892, 944, 1039, 918, 1063, 1230, 1024, 745, 591, 435],
    "hoogOverig": [0] * 12,
    "warmeDranken": [0] * 12,
    "speciaalbierFles": [1806, 1629, 2760, 2321, 2391, 1570, 2458, 2137, 1846, 1537, 1488, 1507],
    "speciaalbierTap": [10268, 14691, 18690, 19779, 22735, 15865, 18521, 18011, 15651, 15218, 15454, 12149],
    "tapPilsner": [8212, 9589, 12358, 15926, 15947, 11163, 12890, 13548, 13956, 13507, 13283, 10387],
    "koffieThee": [3570, 4756, 5585, 3760, 3980, 2786, 3170, 3020, 2859, 2937, 3447, 2243],
    "frisdranken": [5838, 6901, 10572, 9128, 10991, 9388, 10281, 9056, 8605, 7626, 7556, 5846],
    "alcoholVrij": [2284, 2799, 3626, 3276, 3269, 3004, 3596, 2743, 2613, 2372, 2277, 1495],
    "laagOverig": [1274, 1742, 676, 1120, 1894, 619, 1182, 326, 210, 557, 1054, 4767],
    "loterij": [0] * 12,
    "overigeOpbrengsten": [0] * 12,
    "verkoopkortingen": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -166, 0],
    "nonFood": [0] * 12,
}

COGS_FOOD = {
    "keukenHoog": [202, 172, 347, 621, 431, 152, 2374, 312, 200, 354, 469, 561],
    "keukenLaag": [13650, 11603, 19559, 16239, 18775, 12970, 12967, 13107, 10754, 9338, 12600, 12649],
    "uitbesteed": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 938],  # Analyse Inhuur overhead under COGS
}

COGS_BEV = {
    "bierenFles": [0, 0, 0, 0, 0, 0, 0, 0, 39, 100, 444, 809],
    "bierenLaag": [302, 81, 57, -140, 149, 4, -57, 96, 203, 93, -47, 0],
    "wijnen": [2347, 2180, 8214, 7538, 550, 5559, 2800, 6959, 3388, 3592, 5738, 3225],
    "sterke": [2142, 3333, 4695, 3769, 4904, 3603, 3339, 4438, 3185, 3811, 3211, 2524],
    "speciaalFles": [707, 270, 688, 983, 628, 429, 586, 903, 804, 246, 148, 33],
    "speciaalTap": [1468, 5381, 7152, 7931, 7825, 6821, 5885, 9960, 5258, 6340, 4930, 6827],
    "pils": [5976, 3973, 5256, 4883, 7303, 3924, 6618, 2424, 7080, -4997, 7181, 4232],
    "koffie": [310, 979, 1075, 380, 657, 394, 587, 179, 576, 991, 741, 429],
    "fris": [1484, 1445, 2768, 2243, 2854, 2586, 1948, 2665, 2043, 2187, 1521, 2013],
    "alcoholvrij": [593, 575, 736, 592, 657, 739, 766, 726, 434, 357, 764, 463],
    "barOverigHoog": [20, 0, 0, 0, 61, 0, 0, 0, 74, 0, 0, 0],
    "inkopenOverigHoog": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 405, 0],  # Inkopen bieren (hoog)
    "barOverige": [204, 396, 177, 207, 1065, 1364, 791, 743, 643, 642, 686, 576],
    "inkoopkortingen": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -108004],
    "statiegeld": [0] * 12,
}

LABOR_CORE = {
    "salarisBediening": [10004, 10004, 12896, 14336, 10925, 10530, 10673, 13980, 14368, 11147, 11147, 10612],
    "salarisKeuken": [12586, 12309, 15136, 13605, 11646, 25346, 5997, 5997, 8406, 5938, 6076, 5938],
    "salarisOverhead": [0] * 12,
    "inhuurFb": [6137, 5900, 5136, 8178, 10700, 11587, 11473, 13025, 7882, 7610, 7598, 5589],
    "inhuurAfwas": [0] * 12,
    "inhuurStewarding": [1187, 1607, 5103, 2205, 2657, 2221, 2431, 2342, 1355, 1591, 1315, 1748],
    "inhuurKeuken": [1217, 2549, 2724, 2912, 2939, 4291, 5528, 7044, 4223, 5448, 6624, 6897],
    "inhuurOverhead": [0, 0, 0, 876, 762, 1043, 734, 468, 1163, 2535, 1163, 0],
}

LONEN_TARGET = [36728, 33724, 42568, 43819, 42821, 52836, 38407, 40835, 37668, 40225, 36114, 34226]
LABOR_SOCIALE = [4119, 4073, 5146, 5479, 7732, 5731, 3175, 3950, 4855, 3489, 3518, 3472]
LABOR_PENSIOEN = [1065, 1053, 1342, 1594, 2792, 1398, 800, 1013, 1235, 829, 841, 928]
LABOR_OVERIG = [0] * 12

FIXED_OVERIGE = [20715, 25843, 31646, 29029, 25397, 28376, 26746, 22823, 27790, 32832, 28138, 20073]
FIXED_AFSCHRIJVING = [8733, 8733, 8733, 8746, 8765, 8799, 8799, 8799, 8813, 8821, 8857, -1803]
FIXED_FINANCIEEL = [1640, 1600, 1450, 1580, 1581, 1570, 1591, 1606, 1641, 1656, 1945, 5741]
FIXED_OPBRENGST = [0] * 12

EXPECT = {
    "revenue": [94032, 108871, 149320, 143664, 167269, 123572, 139786, 129726, 110704, 114594, 112672, 107272],
    "cogs": [29406, 30388, 50724, 45246, 45858, 38544, 38604, 42410, 34573, 23569, 38525, -72770],
    "labor": [41912, 38850, 49056, 50892, 53345, 59965, 42382, 45798, 43758, 44543, 40473, 38626],
    "result": [-8374, 3457, 7711, 8171, 32323, -13682, 21664, 8290, -5871, 3173, -5266, 117405],
}


def pick(m: dict, i: int) -> dict:
    return {k: v[i] for k, v in m.items()}


def build_lonen(i: int) -> dict:
    core = pick(LABOR_CORE, i)
    core["overigLonen"] = LONEN_TARGET[i] - sum(core.values())
    return core


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


def build_bea(i: int) -> dict:
    food = pick(REV_FOOD, i)
    bev = pick(REV_BEV, i)
    cogs_food = pick(COGS_FOOD, i)
    cogs_bev = pick(COGS_BEV, i)

    rev_gap = EXPECT["revenue"][i] - (sum(food.values()) + sum(bev.values()))
    bev["laagOverig"] += rev_gap

    cogs_gap = EXPECT["cogs"][i] - (sum(cogs_food.values()) + sum(cogs_bev.values()))
    cogs_bev["barOverige"] += cogs_gap

    return seal(
        {
            "revenueFoodLines": food,
            "revenueBevLines": bev,
            "cogsFoodLines": cogs_food,
            "cogsBevLines": cogs_bev,
            "laborLonenLines": build_lonen(i),
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
    with urllib.request.urlopen(f"{BASE}/api/daily-ops/finance/pnl?year=2025&month={month}", timeout=60) as r:
        return json.load(r)


def put(periods: list) -> dict:
    req = urllib.request.Request(
        f"{BASE}/api/daily-ops/finance/pnl",
        data=json.dumps({"periods": periods, "refreshAssumptions": True}).encode(),
        headers={"content-type": "application/json"},
        method="PUT",
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)


def main() -> None:
    periods = []
    ok = True
    for i in range(12):
        month = i + 1
        bea = build_bea(i)
        for key in ("revenue", "cogs", "labor", "result"):
            got = bea[key]
            exp = EXPECT[key][i]
            if got != exp:
                print(f"FAIL m{month} {key}: got {got} expect {exp} Δ{got - exp}")
                ok = False
        print(
            f"m{month} rev={bea['revenue']} cogs={bea['cogs']} labor={bea['labor']} "
            f"fixed={bea['fixed']} result={bea['result']} "
            f"overigLonen={bea['laborLonenLines']['overigLonen']} "
            f"barOverige={bea['cogsBevLines']['barOverige']}"
        )
        data = get_month(month)
        venues = {l["key"]: l["row"] for l in data["lines"] if l["key"] != "combined"}
        venues["bea"] = {**venues.get("bea", {}), **bea}
        periods.append(
            {
                "year": 2025,
                "month": month,
                "venues": {
                    "vkb": venues["vkb"],
                    "bea": venues["bea"],
                    "lat": venues["lat"],
                },
            }
        )

    if not ok:
        raise SystemExit("Parent mismatch — abort PUT")

    print("PUT", put(periods))


if __name__ == "__main__":
    main()
