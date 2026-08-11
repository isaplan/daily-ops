#!/usr/bin/env python3
"""Fill Bar Bea (BEA) 2024 Jan–Dec accounting P&L from Analyse screenshots.

Costs = positive magnitudes; credits signed negative. Line residuals land in
laagOverig / barOverige so sealed parents match Analyse. Preserves VKB/LAT.

Run: python3 scripts/fill-bea-2024-pnl.py
"""

from __future__ import annotations

import json
import urllib.request

BASE = "http://localhost:8080"

REV_FOOD = {
    "bier": [0] * 12,
    "snacks": [8047, 8350, 13662, 15292, 16580, 14719, 14501, 16348, 11891, 12119, 9637, 7566],
    "lunch": [4460, 3927, 10628, 8256, 11285, 503, 0, 0, 0, 0, -234, 207],
    "diner": [23632, 25274, 34415, 29578, 26588, 33888, 32482, 36319, 27172, 26955, 30156, 22459],
    "menus": [0, 0, 1545, 0, 0, 0, 0, 0, 0, 0, 1860, 3488],
    "keukenOverig": [703, 167, 481, 1234, 812, 6, 0, 0, 0, 0, 0, 0],
}

# Omzet hoog alcoholische folded into hoogOverig
REV_BEV = {
    "wijnen": [13452, 14165, 17449, 19065, 21341, 17181, 16682, 18576, 15385, 15953, 16903, 11221],
    "gedestilleerd": [4817, 5529, 6112, 7584, 7014, 7465, 5399, 7729, 7259, 6317, 8830, 8407],
    "cocktails": [7289, 8226, 11852, 13836, 16030, 15696, 15994, 18840, 11566, 10468, 9536, 6703],
    "cider": [290, 506, 711, 1088, 1131, 994, 851, 1050, 642, 671, 479, 379],
    "hoogOverig": [2518, 394, 953, 1029, 1703, 15, 0, 0, 0, 0, 0, 0],
    "warmeDranken": [0] * 12,
    "speciaalbierFles": [1614, 1718, 3143, 2994, 3367, 2840, 2572, 3542, 2055, 2880, 2502, 1463],
    "speciaalbierTap": [9451, 12092, 17354, 18159, 17398, 15940, 15114, 19029, 14198, 16041, 15844, 11058],
    "tapPilsner": [7140, 9454, 11160, 13820, 14413, 17564, 18896, 15354, 10925, 11171, 12205, 7928],
    "koffieThee": [3991, 3729, 6683, 5554, 4949, 4291, 3528, 3806, 3557, 4158, 4140, 2864],
    "frisdranken": [4269, 4067, 7013, 6612, 6306, 8869, 8587, 9542, 7824, 6509, 7349, 5693],
    "alcoholVrij": [2415, 2421, 3011, 3238, 2687, 2585, 2654, 3307, 2175, 2015, 2628, 1537],
    "laagOverig": [2116, 1463, 623, 362, 1143, 1393, 181, 0, 563, 20, 1183, 5238],
    "loterij": [0] * 12,
    "overigeOpbrengsten": [0] * 12,
    "verkoopkortingen": [0] * 12,
    "nonFood": [0] * 12,
}

COGS_FOOD = {
    "keukenHoog": [243, 275, 193, 101, 77, 81, 40, 54, 7, 210, 0, 0],
    "keukenLaag": [16140, 15985, 18789, 21660, 20368, 18958, 17402, 20033, 14425, 15049, 16883, 13396],
    "uitbesteed": [0] * 12,
}

# cider inkopen + OCR gaps → corrected via barOverige residual against Analyse Kostprijs
COGS_BEV = {
    "bierenFles": [0, 58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "bierenLaag": [-145, 296, -110, -130, -15, 87, -17, 102, 5, 101, -437, 0],
    "wijnen": [3543, 3977, 3976, 6302, 4831, 5701, 3638, 6117, 4695, 4235, 4684, 3658],
    "sterke": [2954, 3126, 4608, 3517, 4331, 4585, 3383, 3040, 4988, 3683, 3819, 3528],
    "speciaalFles": [799, 402, 1103, 1301, 1584, 1168, 1226, 1326, 600, 985, 1455, 404],
    "speciaalTap": [4933, 4442, 6430, 6283, 6062, 11523, 8747, 6385, 4701, 3400, 6955, 4902],
    "pils": [3426, 3968, 6920, 6049, 6297, 3189, 2419, 5690, 3040, 5829, 2633, 2717],
    "koffie": [1185, 474, 1074, 869, 1722, 559, 757, 1067, 506, 1189, 877, 832],
    "fris": [1674, 2012, 2724, 2354, 3880, 2240, 3458, 2949, 2600, 1797, 2208, 1383],
    "alcoholvrij": [628, 549, 484, 675, 713, 844, 538, 686, 430, 495, 426, 304],
    "barOverigHoog": [8, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "inkopenOverigHoog": [0] * 12,
    "barOverige": [-43, 118, 383, 361, 106, 90, 549, 429, 488, 143, 227, 0],
    "inkoopkortingen": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -73814],
    "statiegeld": [11, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, -214],
}

LABOR_CORE = {
    "salarisBediening": [8858, 7869, 6748, 7164, 7794, 9578, 9498, 9691, 9699, 9808, 9824, 11720],
    "salarisKeuken": [12310, 12310, 13168, 14876, 16238, 16600, 12597, 12444, 12597, 12289, 12442, 12185],
    "salarisOverhead": [0] * 12,
    "inhuurFb": [5113, 6355, 7766, 13209, 11324, 8512, 8266, 9818, 7491, 6405, 6414, 6261],
    "inhuurAfwas": [0] * 12,
    "inhuurStewarding": [1311, 1432, 1486, 2400, 4237, 3993, 2847, 2848, 2687, 1965, 2612, 2187],
    "inhuurKeuken": [1931, 2693, 2911, 1385, 306, 1132, 669, 2280, 3416, 3368, 3427, 480],
    "inhuurOverhead": [408, 408, 408, 408, 408, 408, 492, 0, 0, 0, 0, 0],
}

LONEN_TARGET = [33951, 32757, 37277, 42457, 44364, 43795, 39569, 40624, 39237, 36043, 38122, 47281]
LABOR_SOCIALE = [4287, 4035, 4027, 4087, 6291, 4962, 4093, 4105, 4129, 4105, 4016, 4754]
LABOR_PENSIOEN = [1052, 1156, 1119, 1072, 2054, 1246, 1076, 1080, 1093, 1077, 1091, 1224]
LABOR_OVERIG = [0] * 12

FIXED_OVERIGE = [20812, 24745, 24228, 25976, 22989, 26860, 24242, 27187, 26140, 24227, 28358, 27367]
FIXED_AFSCHRIJVING = [8197, 8249, 8325, 8372, 8403, 8449, 8682, 8721, 8721, 8721, 8723, 8733]
FIXED_FINANCIEEL = [1630, 584, 1582, 1563, 1543, 1523, 1502, 1482, 1462, 1441, 1421, 10091]
FIXED_OPBRENGST = [0] * 12

EXPECT = {
    "revenue": [96203, 101481, 146796, 147703, 152746, 143950, 137439, 153441, 115213, 115277, 123018, 96212],
    "cogs": [35534, 35338, 47147, 49377, 49838, 48752, 41826, 47875, 36575, 37174, 40182, -42717],
    "labor": [39290, 37948, 42423, 47616, 52709, 50003, 44738, 45809, 44459, 41225, 43229, 53259],
    "result": [-9260, -5383, 23091, 14799, 17264, 8363, 16449, 22367, -2144, 2489, 1105, 39479],
}


def pick(m: dict, i: int) -> dict:
    return {k: list(v)[i] if False else v[i] for k, v in m.items()}


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

    # Pin sealed parents to Analyse (OCR €1 noise + cider/sparse rows → residual lines)
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
