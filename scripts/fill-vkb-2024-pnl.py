#!/usr/bin/env python3
"""Fill Van Kinsbergen (VKB) 2024 Jan–Dec accounting P&L from Analyse screenshots.

Costs = positive magnitudes; credits / opbrengst vorderingen signed negative.
Residuals in laagOverig / barOverige / overigLonen. Preserves BEA/LAT.

Run: python3 scripts/fill-vkb-2024-pnl.py
"""

from __future__ import annotations

import json
import urllib.request

BASE = "http://localhost:8080"

REV_FOOD = {
    "bier": [0] * 12,
    "snacks": [11036, 12515, 15371, 17626, 16214, 18285, 17624, 15514, 12191, 9978, 11149, 11313],
    "lunch": [17965, 14527, 22143, 19758, 17633, 18483, 20737, 21148, 14399, 12823, 16832, 17671],
    "diner": [52879, 57638, 66290, 62442, 73137, 62508, 69458, 69111, 48654, 58657, 63973, 62749],
    "menus": [5262, 3528, 8112, 795, 4186, 4665, 3802, 670, 2426, 2953, 1625, 771],
    "keukenOverig": [2769, 1852, 597, 279, 958, 6, 0, 0, 0, 0, 0, 0],
}

# Screenshot truncated after koffie/thee — fris/alcoholvrij/laag overig via residual
REV_BEV = {
    "wijnen": [13960, 14301, 18373, 18351, 22428, 17167, 18473, 18085, 14172, 15677, 18071, 18776],
    "gedestilleerd": [3526, 3623, 4826, 4568, 3844, 4373, 5519, 4496, 3578, 3128, 5168, 6659],
    "cocktails": [6597, 6664, 8979, 9956, 9109, 9809, 9009, 10584, 7344, 7013, 7391, 8510],
    "cider": [104, 168, 362, 644, 657, 428, 540, 371, 278, 231, 193, 129],
    "hoogOverig": [718, 761, 160, 218, 517, 0, 0, 0, 0, 0, 0, 0],
    "warmeDranken": [332, 118, 105, 0, 45, 0, 0, 0, 0, 0, 0, 0],
    "speciaalbierFles": [2481, 2573, 3726, 3113, 2491, 2462, 2738, 2425, 2460, 2137, 2471, 2115],
    "speciaalbierTap": [15187, 16212, 21165, 22181, 16931, 21233, 21862, 22801, 17268, 16516, 16335, 15949],
    "tapPilsner": [4004, 5038, 6158, 7063, 6929, 18759, 29399, 8110, 6301, 5450, 8131, 8510],
    "koffieThee": [10464, 8562, 11546, 9647, 8975, 9030, 9827, 9544, 8020, 7327, 11938, 11242],
    "frisdranken": [0] * 12,
    "alcoholVrij": [0] * 12,
    "laagOverig": [0] * 12,
    "loterij": [0] * 12,
    "overigeOpbrengsten": [0] * 12,
    "verkoopkortingen": [0] * 12,
    "nonFood": [0] * 12,
}

COGS_FOOD = {
    "keukenHoog": [214, 185, 255, 87, 101, 32, 2539, 120, 282, 0, 0, 3815],
    "keukenLaag": [33527, 34601, 43619, 30871, 37347, 36924, 34383, 40143, 29909, 38574, 30860, 36375],
    "uitbesteed": [0] * 12,
}

# Cost screenshot starts mid-COGS (koffie+) — missing wijnen/sterke/etc. → barOverige residual
COGS_BEV = {
    "bierenFles": [0] * 12,
    "bierenLaag": [-113, -88, 44, -198, -42, 190, 68, 158, -949, 450, -27, 0],
    "wijnen": [0] * 12,
    "sterke": [0] * 12,
    "speciaalFles": [0] * 12,
    "speciaalTap": [0] * 12,
    "pils": [0] * 12,
    "koffie": [1645, 1484, 1802, 1452, 1538, 2386, 226, 2190, 704, 1538, 1412, 1556],
    "fris": [2371, 2826, 5080, 3168, 5033, 3735, 4881, 4634, 3325, 3578, 2283, 2622],
    "alcoholvrij": [405, 733, 978, 870, 997, 847, 798, 786, 602, 430, 597, 724],
    "barOverigHoog": [0] * 12,
    "inkopenOverigHoog": [-64, -77, -64, -77, -81, -81, -30, -145, -68, -56, -118, -32],  # vrijgesteld credits
    "barOverige": [229, 455, 89, 124, 842, 712, 461, 0, 0, 0, 0, 0],
    "inkoopkortingen": [-474, -14, -2014, -14, -14, -14, -14, -14, -14, -14, -14, -49177],
    "statiegeld": [129, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
}

# Inhuur F&B: OCR returned 9 months (apr–dec); jan–mar → overigLonen residual
LABOR_CORE = {
    "salarisBediening": [22576, 23077, 21255, 14631, 17405, 17467, 18248, 18697, 15527, 15483, 19139, 19240],
    "salarisKeuken": [20475, 20406, 20090, 19748, 19128, 13702, 12892, 15636, 16424, 19820, 18174, 16431],
    "salarisOverhead": [4674, 4674, 4674, 4674, 4674, 4674, 4636, 4674, 4674, 0, 0, 0],
    "inhuurFb": [0, 0, 0, 9021, 8794, 13101, 15687, 14588, 15278, 11460, 15049, 20846],
    "inhuurAfwas": [1278, 2222, 4473, 4083, 5268, 5076, 5353, 5944, 4992, 4942, 5081, 4765],
    "inhuurStewarding": [0] * 12,
    "inhuurKeuken": [5200, 6509, 8506, 5689, 1485, 7824, 12636, 10582, 11970, 15024, 19234, 9153],
    "inhuurOverhead": [391, 888, 440, 408, 408, 408, 408, 942, 696, 0, 0, 0],
}

LONEN_TARGET = [59490, 64696, 66778, 64745, 62783, 64132, 75372, 69429, 68064, 75522, 87028, 64139]
LABOR_SOCIALE = [8595, 8567, 8092, 7600, 13895, 7215, 6973, 7774, 7249, 8259, 7926, 7405]
LABOR_PENSIOEN = [2160, 2188, 1963, 1889, 4272, 1698, 1763, 1976, 1832, 2202, 2181, 2375]
LABOR_OVERIG = [275, 425, 425, 425, 350, 350, 250, 250, 250, 504, 707, 650]

FIXED_OVERIGE = [28350, 31911, 40562, 32357, 28088, 38947, 35588, 32280, 26269, 41972, 42125, 70790]
FIXED_AFSCHRIJVING = [6297, 6305, 6444, 6619, 6953, 7285, 7403, 7552, 8125, 9838, 9927, 9949]
FIXED_FINANCIEEL = [193, 164, 154, 118, 106, 88, 105, 72, 61, 54, 44, 7910]
# Income — signed negative so Fixed = sum(children)
FIXED_OPBRENGST = [-588, -584, -600, -600, -600, -600, -600, -600, -600, -600, -600, -4991]

EXPECT = {
    "revenue": [160849, 161893, 204626, 191324, 203608, 206429, 229985, 204518, 153622, 155381, 179895, 232050],
    "cogs": [50522, 54694, 70810, 56600, 64474, 68111, 69903, 64960, 48015, 55797, 52900, 20581],
    "labor": [70520, 75876, 77258, 74659, 81300, 73395, 84358, 79429, 77395, 86487, 97842, 74569],
    "result": [5555, -6473, 9998, 21571, 23287, 19203, 33228, 20825, -5643, -38167, -22343, 53242],
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


def build_vkb(i: int) -> dict:
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
    with urllib.request.urlopen(f"{BASE}/api/daily-ops/finance/pnl?year=2024&month={month}", timeout=60) as r:
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
        vkb = build_vkb(i)
        for key in ("revenue", "cogs", "labor", "result"):
            got = vkb[key]
            exp = EXPECT[key][i]
            if got != exp:
                print(f"FAIL m{month} {key}: got {got} expect {exp} Δ{got - exp}")
                ok = False
        print(
            f"m{month} rev={vkb['revenue']} cogs={vkb['cogs']} labor={vkb['labor']} "
            f"fixed={vkb['fixed']} result={vkb['result']} "
            f"overigLonen={vkb['laborLonenLines']['overigLonen']} "
            f"laagOverig={vkb['revenueBevLines']['laagOverig']} "
            f"barOverige={vkb['cogsBevLines']['barOverige']}"
        )
        data = get_month(month)
        venues = {l["key"]: l["row"] for l in data["lines"] if l["key"] != "combined"}
        venues["vkb"] = {**venues.get("vkb", {}), **vkb}
        periods.append(
            {
                "year": 2024,
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
