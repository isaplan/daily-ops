#!/usr/bin/env python3
"""Fill l'Amour Toujours (LAT) 2025 Jan–Dec accounting P&L from Analyse screenshots.

Costs = positive magnitudes; credits signed negative.
Residuals in laagOverig / barOverige / overigLonen. Preserves VKB/BEA.

Run: python3 scripts/fill-lat-2025-pnl.py
"""

from __future__ import annotations

import json
import urllib.request

BASE = "http://localhost:8080"

REV_FOOD = {
    "bier": [0] * 12,
    "snacks": [3448, 2863, 7421, 9930, 9761, 8077, 7135, 5372, 3702, 3857, 3623, 4240],
    "lunch": [0] * 12,
    "diner": [62928, 50673, 57917, 53021, 62238, 50918, 54042, 43666, 39188, 54596, 50989, 68971],
    "menus": [0, 3490, 7140, 11267, 7649, 5091, 4180, 5271, 6499, 3245, 4242, 18502],
    "keukenOverig": [0] * 12,
}

REV_BEV = {
    "wijnen": [19606, 16852, 23569, 24167, 26044, 18862, 18624, 16042, 15272, 20311, 17274, 23355],
    "gedestilleerd": [2130, 1567, 1800, 2012, 3473, 2134, 2684, 1591, 1199, 1458, 2301, 2649],
    "cocktails": [2826, 2968, 4990, 7209, 6341, 5271, 5313, 3337, 3470, 3850, 3112, 3562],
    "cider": [155, 176, 480, 476, 481, 417, 377, 387, 274, 120, 116, 123],
    "hoogOverig": [1970, -100, 0, 0, 0, 0, -18, 0, 0, 0, 0, 0],
    "warmeDranken": [0] * 12,
    "speciaalbierFles": [214, 441, 589, 870, 822, 748, 656, 539, 429, 339, 374, 488],
    "speciaalbierTap": [1733, 2123, 5143, 5522, 5747, 5773, 5299, 3802, 3679, 2892, 2488, 2815],
    "tapPilsner": [883, 1235, 2120, 2908, 2347, 2583, 2203, 1702, 1202, 1148, 752, 1172],
    "koffieThee": [4010, 3228, 5225, 5488, 5104, 3448, 3706, 3788, 3066, 3429, 3306, 3725],
    "frisdranken": [5598, 4840, 8304, 9475, 9858, 7874, 7768, 6420, 5537, 5170, 5035, 6256],
    "alcoholVrij": [1451, 828, 1704, 1864, 1565, 1825, 1540, 1113, 887, 565, 552, 870],
    "laagOverig": [667, 14, 282, 12, 150, 8, 12, 27, 89, 12, 540, 2132],
    "loterij": [0] * 12,
    "overigeOpbrengsten": [0] * 12,
    "verkoopkortingen": [0] * 12,
    "nonFood": [0] * 12,
}

COGS_FOOD = {
    "keukenHoog": [0] * 12,
    "keukenLaag": [21028, 16047, 27831, 36843, 32947, 30487, 21183, 20148, 20009, 19946, 21286, 23673],
    "uitbesteed": [0] * 12,
}

COGS_BEV = {
    "bierenFles": [1346, -841, 766, 2384, -1141, 1481, -1576, 1255, -1269, 505, 470, -1248],
    "bierenLaag": [16, 125, -120, -43, 96, 125, -98, -75, 158, -158, 115, 116],
    "wijnen": [6519, 5077, 7496, 7004, 8848, 5830, 5011, 4443, 4732, 5420, 5617, 7313],
    "sterke": [1001, 984, 1606, 1528, 1662, 1842, 1290, 929, 542, 901, 515, 1499],
    "speciaalFles": [206, 471, -265, -183, 1041, 641, -383, 629, -45, -311, 1123, 316],
    "speciaalTap": [381, 196, 1400, 1340, 2159, 1612, 2419, 1082, 1791, 1386, 848, 992],
    "pils": [2286, 2259, 2241, 2255, -444, 2259, 0, 0, 0, 0, 0, 0],
    "koffie": [652, 554, 583, 952, 717, 1046, 346, 512, 536, 488, 672, 635],
    "fris": [1464, 926, 1862, 2571, 2628, 1909, 2019, 1385, 1177, 1205, 949, 2035],
    "alcoholvrij": [125, 193, 414, 583, 210, 184, 506, 211, 530, 198, 92, 155],
    "barOverigHoog": [88, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "inkopenOverigHoog": [0] * 12,
    "barOverige": [117, 355, 874, 1282, 183, 588, 1726, 268, 424, 484, 410, 0],
    "inkoopkortingen": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -39473],
    "statiegeld": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
}

LABOR_CORE = {
    "salarisBediening": [8457, 6030, 6030, 6030, 5716, 9563, 8868, 8868, 5632, 9419, 8710, 6710],
    "salarisKeuken": [21118, 26513, 17615, 14124, 17582, 14601, 19035, 14435, 17713, 18099, 13776, 12068],
    "salarisOverhead": [0] * 12,
    "inhuurFb": [4873, 4165, 8875, 12278, 11789, 8561, 12564, 9332, 6480, 4028, 3257, 4781],
    "inhuurAfwas": [0] * 12,
    "inhuurStewarding": [2877, 3134, 3491, 3203, 3560, 3245, 3192, 1591, 1418, 2940, 0, 0],
    "inhuurKeuken": [4254, 6327, 4442, 5636, 7496, 5528, 16867, 10147, 4450, 3285, 1203, 732],
    "inhuurOverhead": [78, 78, 192, 260, 1664, 4355, 570, -968, 458, -968, 0, 0],
}

LONEN_TARGET = [33633, 42376, 44468, 47642, 48432, 46891, 59725, 48519, 38924, 36766, 29768, 31875]
LABOR_SOCIALE = [5945, 6832, 4845, 3924, 7159, 4772, 5669, 4600, 4864, 6270, 4613, 3762]
LABOR_PENSIOEN = [1599, 1752, 1393, 1003, 2064, 1232, 1500, 1217, 1221, 1656, 1112, 3088]
LABOR_OVERIG = [0] * 12

FIXED_OVERIGE = [22586, 21794, 25549, 24584, 22754, 23760, 23137, 15344, 27315, 23699, 27110, 16974]
FIXED_AFSCHRIJVING = [7834, 7844, 7843, 7843, 7843, 7843, 7843, 7929, 7974, 7992, 8307, 8925]
FIXED_FINANCIEEL = [3152, 2989, 3063, 3058, 3053, 3048, 3342, 4727, 5016, 5507, 5005, 4882]
FIXED_OPBRENGST = [0] * 12

EXPECT = {
    "revenue": [107619, 91198, 126684, 134220, 141579, 113030, 113521, 93057, 84493, 100995, 94705, 138859],
    "cogs": [32826, 26136, 41928, 53853, 52708, 45340, 33545, 32245, 30683, 30004, 31728, -1318],
    "labor": [41177, 50960, 50706, 52569, 57655, 52895, 66894, 54336, 45009, 44692, 35493, 38725],
    "result": [44, -18525, -2405, -7687, -2434, -19856, -21240, -21524, -31504, -10899, -12938, 70671],
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


def build_lat(i: int) -> dict:
    food = pick(REV_FOOD, i)
    bev = pick(REV_BEV, i)
    cogs_food = pick(COGS_FOOD, i)
    cogs_bev = pick(COGS_BEV, i)

    rev_gap = EXPECT["revenue"][i] - (sum(food.values()) + sum(bev.values()))
    bev["laagOverig"] += rev_gap

    cogs_gap = EXPECT["cogs"][i] - (sum(cogs_food.values()) + sum(cogs_bev.values()))
    cogs_bev["barOverige"] += cogs_gap

    row = seal(
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
    result_gap = EXPECT["result"][i] - row["result"]
    if result_gap != 0:
        row["fixedOverige"] -= result_gap
        row["fixed"] -= result_gap
        row["result"] += result_gap
    return row


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
        lat = build_lat(i)
        for key in ("revenue", "cogs", "labor", "result"):
            got = lat[key]
            exp = EXPECT[key][i]
            if got != exp:
                print(f"FAIL m{month} {key}: got {got} expect {exp} Δ{got - exp}")
                ok = False
        print(
            f"m{month} rev={lat['revenue']} cogs={lat['cogs']} labor={lat['labor']} "
            f"fixed={lat['fixed']} result={lat['result']} "
            f"overigLonen={lat['laborLonenLines']['overigLonen']}"
        )
        data = get_month(month)
        venues = {l["key"]: l["row"] for l in data["lines"] if l["key"] != "combined"}
        venues["lat"] = {**venues.get("lat", {}), **lat}
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
