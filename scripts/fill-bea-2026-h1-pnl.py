#!/usr/bin/env python3
"""Fill Bar Bea (BEA) 2026 Jan–Jun accounting P&L from Analyse screenshots."""

from __future__ import annotations

import json
import urllib.request

BASE = "http://localhost:8080"

# Costs positive; credits / kortingen signed negative where they reduce the parent.

REV_FOOD = {
    "bier": [0, 0, 0, 0, 0, 0],
    "snacks": [7126, 8517, 14430, 17470, 6263, 2345],
    "lunch": [1361, 1731, 2550, 2212, 1314, 125],
    "diner": [16326, 14516, 20865, 6924, 28950, 19763],
    "menus": [2356, 833, 1232, 2754, 1332, 0],
    "keukenOverig": [342, 388, 55, 774, 871, 2024],
}

REV_BEV = {
    "wijnen": [13505, 12369, 17449, 20514, 7296, 12004],
    "gedestilleerd": [6437, 7937, 7318, 12344, 7027, 15718],
    "cocktails": [9023, 9012, 14895, 22082, 7132, 11890],
    "cider": [540, 501, 1063, 1367, 3295, 1054],
    "hoogOverig": [0, 0, 0, 0, 0, 0],
    "warmeDranken": [0, 0, 0, 0, 0, 0],
    "speciaalbierFles": [1130, 1354, 2080, 2470, 28959, 1424],
    "speciaalbierTap": [11197, 12910, 20015, 25474, 8250, 18059],
    "tapPilsner": [10592, 11030, 12174, 19385, 26753, 13253],
    "koffieThee": [2715, 3097, 3571, 3198, 2737, 3732],
    "frisdranken": [6080, 6658, 8723, 10483, 8303, 13541],
    "alcoholVrij": [2726, 2406, 3621, 4234, 3358, 3260],
    "laagOverig": [787, 613, 264, 15105, 2570, 3840],
    "loterij": [0, 0, 0, 0, 0, 0],
    "overigeOpbrengsten": [0, 0, 0, 0, 0, 0],
    "verkoopkortingen": [0, -15, -249, 0, 0, 0],
    "nonFood": [0, 0, 0, 0, 0, 0],
}

# Uitbesteed = Analyse "Kosten uitbesteed werk / Inhuur overhead" under COGS (not labor).
COGS_FOOD = {
    "keukenHoog": [375, 417, 356, 450, 301, 319],
    "keukenLaag": [10017, 9818, 13927, 13481, 12448, 10721],
    "uitbesteed": [1178, 1163, 2368, 98, 1215, 1350],
}

COGS_BEV = {
    "bierenFles": [458, 676, 861, 1030, 1001, 610],
    "bierenLaag": [59, 7, -49, 148, -276, -123],
    "wijnen": [3575, 4656, 4797, 7763, 2264, 5375],
    "sterke": [2738, 2448, 3048, 5454, 5241, 4810],
    "speciaalFles": [130, 4, 15, 221, 131, 12],
    "speciaalTap": [4325, 5622, 8113, 7947, 11952, 9159],
    "pils": [4502, 7176, 5920, 12101, 5544, 7270],
    "koffie": [553, 1078, 617, 1114, 71, 358],
    "fris": [1772, 2068, 2348, 3249, 2871, 2131],
    "alcoholvrij": [484, 733, 895, 941, 1448, 844],
    "barOverigHoog": [0, 631, 0, 0, 0, 0],
    "barOverige": [521, 634, 793, 836, 847, 626],
    "inkoopkortingen": [0, 0, -94, 0, -110, 0],
    "statiegeld": [0, 0, 0, 0, 0, 0],
}

LABOR_LONEN = {
    "salarisBediening": [11294, 11212, 11018, 11035, 11096, 8957],
    "salarisKeuken": [6076, 6076, 5918, 5787, 6652, 11380],
    "salarisOverhead": [0, 0, 0, 0, 0, 0],
    "inhuurFb": [8129, 7104, 10122, 16148, 15170, 17689],
    "inhuurAfwas": [0, 0, 0, 0, 0, 0],
    "inhuurStewarding": [1575, 1519, 2051, 2014, 2183, 1648],
    "inhuurKeuken": [4789, 5180, 6435, 6643, 8410, 6569],
    "inhuurOverhead": [0, 0, 0, 0, 0, 0],
    # Residual → Lonen total (doorberekende / vakantie / onkosten / ziekengeld / subsidies)
    "overigLonen": [-180, 536, -3394, -2218, 669, -4967],
}

LABOR_SOCIALE = [3533, 3521, 3298, 3288, 3852, 6410]
LABOR_PENSIOEN = [875, 868, 836, 826, 1061, 2202]
LABOR_OVERIG = [0, 0, 0, 0, 0, 0]

FIXED_OVERIGE = [25296, 26865, 32320, 29334, 37331, 28645]
FIXED_AFSCHRIJVING = [8877, 8916, 8916, 8916, 8916, 8916]
FIXED_FINANCIEEL = [2729, 2866, 3014, 3551, 3169, 3405]
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


def build_bea(i: int) -> dict:
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
        bea = build_bea(i)
        # Merge onto existing row so unknown nested defaults from server normalize stay intact on PUT seal
        venues["bea"] = {**venues.get("bea", {}), **bea}
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
            f"m{month} rev={bea['revenue']} cogs={bea['cogs']} labor={bea['labor']} "
            f"fixed={bea['fixed']} result={bea['result']}"
        )

    print("PUT", put(periods))


if __name__ == "__main__":
    main()
