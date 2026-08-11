#!/usr/bin/env python3
"""Fill Van Kinsbergen (VKB) 2025 Jan–Dec accounting P&L from Analyse screenshots.

Costs = positive magnitudes; credits / opbrengst signed negative.
Residuals in laagOverig / barOverige / overigLonen. Preserves BEA/LAT.

Run: python3 scripts/fill-vkb-2025-pnl.py
"""

from __future__ import annotations

import json
import urllib.request

BASE = "http://localhost:8080"

REV_FOOD = {
    "bier": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3107],
    "snacks": [10158, 8921, 15405, 17586, 15112, 14255, 13463, 13635, 9826, 10052, 8157, 10322],
    "lunch": [14790, 14286, 18856, 17570, 18557, 19020, 17744, 16895, 11027, 13697, 15093, 16478],
    "diner": [46806, 40176, 51280, 57284, 63387, 57885, 62567, 61270, 48922, 57052, 54175, 45300],
    "menus": [3039, 5220, 80, 153, 1682, 94, 236, 78, 164, 240, 207, 756],
    "keukenOverig": [39, 67, 3394, 2253, 8, 0, 0, 0, 0, 0, 0, 0],
}

REV_BEV = {
    "wijnen": [14521, 11786, 16239, 15830, 15173, 13460, 15009, 13576, 11086, 13465, 15839, 16661],
    "gedestilleerd": [3994, 3461, 5155, 3200, 2993, 2221, 4534, 2471, 4813, 4783, 4632, 8145],
    "cocktails": [5403, 5440, 10484, 12279, 9385, 9982, 11253, 10474, 6379, 7325, 6464, 8019],
    "cider": [139, 124, 223, 307, 228, 486, 386, 293, 173, 242, 123, 115],
    "hoogOverig": [0, 0, 0, 0, 0, 0, 0, 0, 1446, 0, 0, 0],
    "warmeDranken": [0] * 12,
    "speciaalbierFles": [1518, 1895, 2715, 3048, 3024, 2896, 2551, 2809, 1974, 1821, 1979, 1918],
    "speciaalbierTap": [12770, 12888, 18784, 19606, 22090, 19998, 20565, 19450, 15094, 16793, 16569, 15997],
    "tapPilsner": [4771, 4198, 6523, 8895, 6749, 6523, 11708, 5540, 5103, 5498, 5885, 7110],
    "koffieThee": [9560, 8059, 8736, 8087, 8213, 7391, 8224, 8218, 6448, 7095, 8976, 11088],
    "frisdranken": [8402, 7374, 11315, 12976, 12704, 13355, 13806, 12571, 8581, 9232, 9079, 13991],
    "alcoholVrij": [3302, 2385, 3429, 4284, 4137, 4274, 3999, 3716, 2954, 2566, 2653, 2551],
    "laagOverig": [2270, 1484, 173, 353, 1652, 1294, 2303, 272, 4051, 4980, 3866, 21109],
    "loterij": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2895],
    "overigeOpbrengsten": [0] * 12,
    "verkoopkortingen": [0] * 12,
    "nonFood": [0, 0, -180, 0, 0, 0, 0, 0, 0, 0, 314, 909],
}

COGS_FOOD = {
    "keukenHoog": [192, 304, 347, 243, 427, 533, 344, 427, 414, 1095, 807, 891],
    "keukenLaag": [25076, 28798, 41481, 36513, 34034, 36626, 36560, 31801, 26009, 25359, 29664, 25287],
    "uitbesteed": [0] * 12,
}

COGS_BEV = {
    "bierenFles": [148, 250, 110, 157, 108, -17, 50, 109, 36, 14, 303, 574],
    "bierenLaag": [40, -64, 183, 122, -32, 556, -386, 144, 178, -849, 903, 197],
    "wijnen": [6737, 2019, 7407, 3254, 6159, 4287, 2752, 5445, 3481, 4903, 4108, 7153],
    "sterke": [3873, 1720, 4096, 3043, 2840, 3080, 2817, 2209, 2547, 2682, 3168, 4978],
    "speciaalFles": [696, 579, 1081, 543, 1065, 526, 771, 638, 459, 1176, 384, 944],
    "speciaalTap": [4033, 5476, 9713, 7266, 6810, 3286, 5227, 4314, 5777, 7417, 7456, 9459],
    "pils": [1170, 1366, 1754, 644, 4265, 6443, 8101, 5625, 2039, 682, 2490, 3916],
    "koffie": [1621, 1656, 1908, 1062, 1493, 1436, 1383, 361, 810, 2449, 1611, 2257],
    "fris": [2226, 2107, 3297, 3177, 2782, 3936, 2619, 2985, 2059, 2531, 2102, 3080],
    "alcoholvrij": [605, 397, 378, 544, 797, 486, 630, 670, 562, 600, 380, 935],
    "barOverigHoog": [0] * 12,
    "inkopenOverigHoog": [-36, -64, -71, -34, 0, 0, 0, 0, 0, 0, 0, 0],
    "barOverige": [269, 195, 590, 425, 2251, -478, 603, 1424, 1192, 1263, 1415, 1668],
    "inkoopkortingen": [-524, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -68144],
    "statiegeld": [121, 172, 213, 170, -301, 24, 14, 0, 7, -4, 0, 0],
}

LABOR_CORE = {
    "salarisBediening": [23613, 17933, 20115, 19011, 20700, 25987, 17869, 17394, 19254, 18841, 17544, 20993],
    "salarisKeuken": [12334, 12372, 14203, 15757, 17623, 20947, 20881, 20416, 20768, 21738, 23171, 17354],
    "salarisOverhead": [6074, 4100, 15366, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "inhuurFb": [12570, 7946, 10815, 13392, 17928, 16620, 16942, 15628, 12553, 10163, 12072, 9802],
    "inhuurAfwas": [4426, 3827, 5439, 5376, 5513, 5177, 5450, 5108, 4284, 4699, 4620, 4631],
    "inhuurStewarding": [0] * 12,
    "inhuurKeuken": [4722, 8220, 5953, 7860, 4005, 3112, 3758, 7851, 4665, 6184, 2243, 3920],
    "inhuurOverhead": [696, 1099, 1569, 1398, 1270, 1940, 1344, 908, 1538, 4523, 1185, 2715],
}

LONEN_TARGET = [70549, 46674, 60220, 58976, 66787, 75446, 68439, 71823, 60673, 64977, 64476, 63001]
LABOR_SOCIALE = [8330, 6525, 8481, 7091, 12638, 8954, 7155, 6927, 7463, 7113, 7196, 7515]
LABOR_PENSIOEN = [2264, 1731, 2664, 1998, 4120, 2180, 1800, 1775, 1984, 1901, 2062, 2143]
LABOR_OVERIG = [650, 500, 500, 650, 650, 800, 650, 650, 650, 550, 650, 650]

# Dec overige is a large credit in Analyse (positive in expense section)
FIXED_OVERIGE = [30856, 33507, 59209, 32160, 33948, 32479, 31831, 28151, 32759, 45098, 32405, -179085]
FIXED_AFSCHRIJVING = [9980, 10047, 10170, 10305, 10366, 10397, 10406, 10406, 10422, 9690, 9721, 9742]
FIXED_FINANCIEEL = [27, 16, 9, 0, 0, 0, 0, 0, 0, 0, 0, 18946]
FIXED_OPBRENGST = [-600, -600, -600, -600, -600, -600, -600, -600, -600, -600, -600, -3892]

# Analyse parents (Dec cogs credit; results from screenshot — feb/nov/dec differ from legacy seed)
EXPECT = {
    "revenue": [141481, 127765, 172610, 183713, 185092, 173132, 188347, 171269, 138042, 154841, 154010, 186470],
    "cogs": [46249, 44913, 72486, 57129, 62698, 60723, 61485, 56151, 45568, 49317, 54793, -6804],
    "labor": [81793, 55430, 71865, 68715, 84195, 87380, 78044, 81175, 70770, 74541, 74384, 73309],
    "result": [-26824, -15548, -40529, 16004, -5515, -17247, 7181, -4014, -20877, -23205, -16693, 274254],
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

    # Pin Dec (and any) fixedOverige so sealed result matches Analyse
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
            f"overige={vkb['fixedOverige']}"
        )
        data = get_month(month)
        venues = {l["key"]: l["row"] for l in data["lines"] if l["key"] != "combined"}
        venues["vkb"] = {**venues.get("vkb", {}), **vkb}
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
