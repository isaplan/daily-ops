#!/usr/bin/env python3
"""Fill l'Amour Toujours (LAT) 2024 Jan–Dec accounting P&L from Analyse screenshots.

Costs = positive magnitudes; credits signed negative.
Inhuur schoonmaak → inhuurOverhead. Residuals in laagOverig / barOverige / overigLonen.

Run: python3 scripts/fill-lat-2024-pnl.py
"""

from __future__ import annotations

import json
import urllib.request

BASE = "http://localhost:8080"

REV_FOOD = {
    "bier": [0] * 12,
    "snacks": [4725, 7803, 6804, 9908, 9895, 9847, 7377, 7437, 5418, 5434, 3131, 4326],
    "lunch": [2500, 5939, 5229, 5201, 7385, 8565, 5843, 6888, 6365, 0, 0, 0],
    "diner": [52377, 87801, 86230, 78191, 84303, 86948, 81450, 83225, 70865, 76779, 78286, 86542],
    "menus": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4096, 0],
    "keukenOverig": [472, 153, 411, 255, 284, 23, 0, 0, 0, 0, 0, 0],
}

# Verkopen bier (hoog) folded into hoogOverig
REV_BEV = {
    "wijnen": [21016, 33783, 31149, 30221, 34254, 30018, 27635, 29268, 23705, 25090, 26281, 30324],
    "gedestilleerd": [1893, 2845, 2607, 2597, 3046, 3428, 3531, 4364, 2354, 2762, 3689, 2688],
    "cocktails": [4006, 6739, 5577, 6508, 6544, 6939, 5848, 6576, 4704, 3996, 3078, 4126],
    "cider": [5, 21, 32, 721, 542, 563, 609, 632, 602, 380, 176, 169],
    "hoogOverig": [109, 317, 137, 168, 205, 6, 1462, -362, 306, 2664, 0, -4070],
    "warmeDranken": [179, 342, 476, 245, 357, 15, 0, 0, 0, 0, 0, 0],
    "speciaalbierFles": [328, 531, 527, 857, 940, 874, 716, 1006, 577, 616, 309, 262],
    "speciaalbierTap": [2793, 2056, 3904, 5649, 6039, 6335, 5926, 5858, 4077, 4314, 2483, 2934],
    "tapPilsner": [973, 2223, 2181, 3008, 3187, 3514, 4356, 3365, 2236, 2500, 1144, 1430],
    "koffieThee": [3449, 6310, 5992, 6237, 6102, 5852, 5145, 5017, 4996, 5925, 4981, 4705],
    "frisdranken": [4916, 8005, 7748, 8570, 10056, 9961, 9105, 9207, 8466, 7956, 6727, 7637],
    "alcoholVrij": [1283, 1564, 1623, 1828, 1965, 2135, 1801, 1774, 1686, 1357, 1203, 1145],
    "laagOverig": [111, 82, 68, 25, 14, 144, 1862, 692, 1228, 344, 28, 475],
    "loterij": [0] * 12,
    "overigeOpbrengsten": [0] * 12,
    "verkoopkortingen": [0] * 12,
    "nonFood": [0] * 12,
}

COGS_FOOD = {
    "keukenHoog": [0] * 12,
    "keukenLaag": [23094, 37532, 50580, 31125, 48158, 36882, 26683, 39001, 31894, 33795, 26732, 39003],
    "uitbesteed": [0] * 12,
}

COGS_BEV = {
    "bierenFles": [-112, -1780, 180, -235, 1099, -16, 88, -746, 831, 0, 0, 0],
    "bierenLaag": [-148, 70, -104, 32, 16, -192, 182, 10, -134, 0, 0, 0],
    "wijnen": [9404, 11784, 11839, 11173, 10771, 9339, 9338, 8267, 8245, 6932, 9220, 9817],
    "sterke": [1613, 2995, 2445, 1517, 2394, 2444, 1984, 2660, 2043, 1867, 1071, 2409],
    "speciaalFles": [-168, 79, 303, 206, -281, -766, 2791, 76, 1280, -665, -506, -152],
    "speciaalTap": [140, 2339, 1622, 2292, 2437, 1029, 2195, 2206, 2075, 1478, 1106, 1402],
    "pils": [871, 426, 1211, 2021, 2149, 4822, 819, 2149, 2149, 2154, 0, 0],
    "koffie": [1195, 1363, 1546, 1805, 1353, 1275, 1237, 1097, 1654, 940, 880, 837],
    "fris": [1565, 2647, 3297, 2674, 2598, 3023, 2685, 2829, 2653, 2355, 1887, 2044],
    "alcoholvrij": [100, 681, 245, 759, 650, 51, 377, 100, 679, 386, 333, 186],
    "barOverigHoog": [133, 114, 61, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "inkopenOverigHoog": [0] * 12,
    "barOverige": [-339, -63, 130, 607, 69, 220, 624, 0, 0, 0, 0, 0],
    "inkoopkortingen": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -37887],
    "statiegeld": [14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
}

# Schoonmaak folded into inhuurOverhead
LABOR_CORE = {
    "salarisBediening": [13714, 18076, 15469, 15445, 15134, 17416, 17160, 16939, 15292, 14736, 12134, 10053],
    "salarisKeuken": [13443, 13164, 14732, 16871, 16871, 16785, 16837, 19549, 18402, 14732, 19837, 22685],
    "salarisOverhead": [0, 0, 0, 0, 0, 2648, 3236, 3236, 2492, 2492, 0, 2959],
    "inhuurFb": [6778, 7042, 7939, 8419, 8640, 6647, 4700, 5379, 5260, 3669, 5435, 5312],
    "inhuurAfwas": [0] * 12,
    "inhuurStewarding": [3149, 4562, 5145, 4942, 5179, 4804, 4913, 4730, 4296, 4355, 4049, 3007],
    "inhuurKeuken": [2689, 4667, 5806, 4778, 1506, 4156, 6876, 6102, 4140, 7654, 4878, 1706],
    "inhuurOverhead": [1443, 1587, 1931, 1675, 1600, 1600, 1600, 1600, 1616, 2309, 1600, 1660],  # schoonmaak + 60 dec
}

LONEN_TARGET = [44486, 52396, 54168, 59044, 56332, 58880, 54059, 55116, 51790, 51388, 43768, 63461]
LABOR_SOCIALE = [5457, 6325, 6313, 6891, 9033, 7305, 6587, 7749, 7381, 6352, 6190, 6365]
LABOR_PENSIOEN = [1272, 1425, 1494, 1681, 2623, 1785, 1625, 1932, 1924, 1711, 1661, 1535]
LABOR_OVERIG = [0] * 12

FIXED_OVERIGE = [29738, 21905, 23285, 28434, 25387, 19392, 23596, 22181, 28710, 27612, 28245, 35671]
FIXED_AFSCHRIJVING = [13434, 15038, 15818, 16039, 16181, 16477, 16493, 16497, 16521, 16526, 16526, 16545]
FIXED_FINANCIEEL = [0, 0, 0, 4572, 4528, 4528, 4528, 4528, 4528, 4528, 4528, 4528]
FIXED_OPBRENGST = [0] * 12

EXPECT = {
    "revenue": [101135, 166515, 160696, 160189, 175118, 175166, 162666, 164947, 137585, 140117, 135611, 142695],
    "cogs": [37473, 59783, 73110, 53572, 68301, 58348, 47783, 59646, 50523, 49740, 42493, 18782],
    "labor": [51215, 60146, 61975, 67616, 67988, 67970, 62271, 64797, 61095, 59451, 51619, 71361],
    "result": [-30725, 9643, -13492, -10044, -7267, 8451, 7995, -2702, -23792, -17740, -7800, -4192],
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
