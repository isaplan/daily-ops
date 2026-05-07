# Day Breakdown vs CSV Validation (Last 7 Days)

- Source CSV: `dev-docs/validation-data-eitje-bork/bork-validation/omzet-per-dag-per-locatie-2025-2026.csv`
- API: `GET /api/bork/v2/day-breakdown?date=YYYY-MM-DD&location=all`
- Revenue compared: API hourly `total_revenue` vs CSV **incl. btw** totals
- **§5–§8 (V2):** same CSV window vs sums on `bork_sales_by_hour` + V2 suffix — see markers `V2_VS_CSV_TABLES_*` (regenerate with `pnpm bork:validate:v2-vs-csv`)

## 1) Totals per day

| Date       | API Revenue | CSV excl. btw | CSV incl. btw | Abs Diff (API - CSV incl) | Diff % vs CSV incl |
|:-----------|------------:|--------------:|--------------:|--------------------------:|-------------------:|
| 2026-04-23 | € 14.466,20 | € 10.534,00   | € 12.005,00   | € 2.461,20                | +20,50%            |
| 2026-04-24 | € 25.166,95 | € 21.035,00   | € 24.186,00   | € 980,95                  | +4,06%             |
| 2026-04-25 | € 27.547,71 | € 24.368,00   | € 27.879,00   | € -331,29                 | -1,19%             |
| 2026-04-26 | € 28.145,40 | € 28.400,00   | € 32.935,00   | € -4.789,60               | -14,54%            |
| 2026-04-27 | € 34.619,05 | € 29.424,00   | € 33.957,00   | € 662,05                  | +1,95%             |
| 2026-04-28 | € 8.938,40  | € 5.602,00    | € 6.360,00    | € 2.578,40                | +40,54%            |
| 2026-04-29 | € 9.760,00  | € 8.965,00    | € 10.256,00   | € -496,00                 | -4,84%             |

## 2) Per-location tables (API vs CSV incl. btw)

### Bar Bea

| Date       | API Revenue | CSV incl. btw | Abs Diff | Diff % |
|:-----------|------------:|--------------:|---------:|-------:|
| 2026-04-23 | € 5.055,10  | € 3.507,00    | € 1.548,10  | +44,14% |
| 2026-04-24 | € 11.170,15 | € 10.585,00   | € 585,15    | +5,53%  |
| 2026-04-25 | € 11.867,10 | € 12.354,00   | € -486,90   | -3,94%  |
| 2026-04-26 | € 14.208,30 | € 19.500,00   | € -5.291,70 | -27,14% |
| 2026-04-27 | € 7.490,35  | € 7.305,00    | € 185,35    | +2,54%  |
| 2026-04-28 | € 2.839,40  | € 2.344,00    | € 495,40    | +21,13% |
| 2026-04-29 | € 3.218,50  | € 3.650,00    | € -431,50   | -11,82% |

### Van Kinsbergen

| Date       | API Revenue | CSV incl. btw | Abs Diff | Diff % |
|:-----------|------------:|--------------:|---------:|-------:|
| 2026-04-23 | € 5.138,70  | € 4.811,00    | € 327,70 | +6,81% |
| 2026-04-24 | € 7.821,50  | € 7.681,00    | € 140,50 | +1,83% |
| 2026-04-25 | € 8.050,10  | € 7.904,00    | € 146,10 | +1,85% |
| 2026-04-26 | € 7.475,10  | € 7.031,00    | € 444,10 | +6,32% |
| 2026-04-27 | € 17.855,50 | € 17.591,00   | € 264,50 | +1,50% |
| 2026-04-28 | € 4.126,70  | € 4.016,00    | € 110,70 | +2,76% |
| 2026-04-29 | € 4.562,50  | € 4.552,00    | € 10,50  | +0,23% |

### l'Amour Toujours

| Date       | API Revenue | CSV incl. btw | Abs Diff | Diff % |
|:-----------|------------:|--------------:|---------:|-------:|
| 2026-04-23 | € 4.272,40  | € 3.687,00    | € 585,40  | +15,88%  |
| 2026-04-24 | € 6.175,30  | € 5.920,00    | € 255,30  | +4,31%   |
| 2026-04-25 | € 7.630,51  | € 7.621,00    | € 9,51    | +0,12%   |
| 2026-04-26 | € 6.462,00  | € 6.404,00    | € 58,00   | +0,91%   |
| 2026-04-27 | € 9.273,20  | € 9.061,00    | € 212,20  | +2,34%   |
| 2026-04-28 | € 1.972,30  | € 0,00        | € 1.972,30| +100,00% |
| 2026-04-29 | € 1.979,00  | € 2.054,00    | € -75,00  | -3,65%   |

## 3) 7-day totals per location

| Location         | API 7-day Total | CSV 7-day incl. btw | Abs Diff     | Diff %  |
|:-----------------|----------------:|--------------------:|-------------:|--------:|
| Bar Bea          | € 55.848,90     | € 59.245,00         | € -3.396,10  | -5,73%  |
| Van Kinsbergen   | € 55.030,10     | € 53.586,00         | € 1.444,10   | +2,69%  |
| l'Amour Toujours | € 37.764,71     | € 34.747,00         | € 3.017,71   | +8,68%  |

## 4) 7-day grand total

- API 7-day total: **€ 148.643,71**
- CSV 7-day incl. btw total: **€ 147.578,00**
- Abs diff: **€ 1.065,71** (+0,72%)

---

## Maintenance (08:00 register day + aggregates)

If `business_hour` / `business_date` in Mongo was built with an **older** boundary, totals will not match this CSV until you **rebuild** legacy aggregates.

```bash
# Default: last 14 calendar days (UTC) — covers next-day `date` spill for register nights
BORK_V1_REBUILD_CONFIRM=1 pnpm bork:rebuild:aggregates

# Or an explicit order-Date window (inclusive):
BORK_V1_REBUILD_CONFIRM=1 BORK_V1_START=2026-04-23 BORK_V1_END=2026-04-30 pnpm bork:rebuild:aggregates
```

Then re-run the comparison that produced this file.

**V2 hourly tables (sections 5–8):** `pnpm bork:validate:v2-vs-csv` — or with an explicit collection suffix if `.env` points at empty test rollups:  
`BORK_V2_CSV_TABLE_SUFFIX=_v2 pnpm bork:validate:v2-vs-csv`  
Populate `_v2` collections (**one pass** from a historical order-date floor through today — do not chain weekly newest-first rebuilds):

```bash
BORK_V2_REBUILD_CONFIRM=1 BORK_V2_BACKSTOP=2025-11-01 pnpm bork:rebuild:v2
# optional: BORK_V2_END=2026-04-30  (default is today UTC)
```

<!-- V2_VS_CSV_TABLES_START -->
## 5) V2 — totals per day

- **Source:** `bork_sales_by_hour_v2` — sum of `total_revenue` by `business_date` (all locations), same register-day slice as `GET /api/bork/v2/day-breakdown-v2` hourly data summed.
- **Suffix:** `_v2` — `BORK_V2_CSV_TABLE_SUFFIX` (overrides app env for this report).

| Date       | V2 API Revenue | CSV excl. btw | CSV incl. btw | Abs Diff (V2 − CSV incl) | Diff % vs CSV incl |
|:-----------|---------------:|--------------:|--------------:|-------------------------:|-------------------:|
| 2026-04-23 | € 12.365,30 | € 10.534,00 | € 12.005,00 | € 360,30 | +3,00% |
| 2026-04-24 | € 23.063,95 | € 21.035,00 | € 24.186,00 | € -1.122,05 | -4,64% |
| 2026-04-25 | € 27.547,81 | € 24.368,00 | € 27.879,00 | € -331,19 | -1,19% |
| 2026-04-26 | € 27.285,90 | € 28.400,00 | € 32.935,00 | € -5.649,10 | -17,15% |
| 2026-04-27 | € 34.447,15 | € 29.424,00 | € 33.957,00 | € 490,15 | +1,44% |
| 2026-04-28 | € 6.561,30 | € 5.602,00 | € 6.360,00 | € 201,30 | +3,17% |
| 2026-04-29 | € 11.732,30 | € 8.965,00 | € 10.256,00 | € 1.476,30 | +14,39% |

## 6) V2 — per location (vs CSV incl. btw)

### Bar Bea

| Date       | V2 API Revenue | CSV incl. btw | Abs Diff | Diff % |
|:-----------|---------------:|--------------:|---------:|-------:|
| 2026-04-23 | € 3.691,50 | € 3.507,00 | € 184,50 | +5,26% |
| 2026-04-24 | € 9.456,75 | € 10.585,00 | € -1.128,25 | -10,66% |
| 2026-04-25 | € 11.764,10 | € 12.354,00 | € -589,90 | -4,77% |
| 2026-04-26 | € 13.926,30 | € 19.500,00 | € -5.573,70 | -28,58% |
| 2026-04-27 | € 7.486,85 | € 7.305,00 | € 181,85 | +2,49% |
| 2026-04-28 | € 2.447,60 | € 2.344,00 | € 103,60 | +4,42% |
| 2026-04-29 | € 3.218,50 | € 3.650,00 | € -431,50 | -11,82% |

### Van Kinsbergen

| Date       | V2 API Revenue | CSV incl. btw | Abs Diff | Diff % |
|:-----------|---------------:|--------------:|---------:|-------:|
| 2026-04-23 | € 4.791,70 | € 4.811,00 | € -19,30 | -0,40% |
| 2026-04-24 | € 7.534,60 | € 7.681,00 | € -146,40 | -1,91% |
| 2026-04-25 | € 7.903,90 | € 7.904,00 | € -0,10 | -0,00% |
| 2026-04-26 | € 6.959,40 | € 7.031,00 | € -71,60 | -1,02% |
| 2026-04-27 | € 17.621,60 | € 17.591,00 | € 30,60 | +0,17% |
| 2026-04-28 | € 4.113,70 | € 4.016,00 | € 97,70 | +2,43% |
| 2026-04-29 | € 4.562,50 | € 4.552,00 | € 10,50 | +0,23% |

### l'Amour Toujours

| Date       | V2 API Revenue | CSV incl. btw | Abs Diff | Diff % |
|:-----------|---------------:|--------------:|---------:|-------:|
| 2026-04-23 | € 3.882,10 | € 3.687,00 | € 195,10 | +5,29% |
| 2026-04-24 | € 6.072,60 | € 5.920,00 | € 152,60 | +2,58% |
| 2026-04-25 | € 7.879,81 | € 7.621,00 | € 258,81 | +3,40% |
| 2026-04-26 | € 6.400,20 | € 6.404,00 | € -3,80 | -0,06% |
| 2026-04-27 | € 9.338,70 | € 9.061,00 | € 277,70 | +3,06% |
| 2026-04-28 | € 0,00 | € 0,00 | € 0,00 | 0,00% |
| 2026-04-29 | € 3.951,30 | € 2.054,00 | € 1.897,30 | +92,37% |

## 7) V2 — 7-day totals per location

| Location         | V2 API Total | CSV incl. btw | Abs Diff     | Diff %  |
|:-----------------|-------------:|--------------:|-------------:|--------:|
| Bar Bea | € 51.991,60 | € 59.245,00 | € -7.253,40 | -12,24% |
| Van Kinsbergen | € 53.487,40 | € 53.586,00 | € -98,60 | -0,18% |
| l'Amour Toujours | € 37.524,71 | € 34.747,00 | € 2.777,71 | +7,99% |

## 8) V2 — 7-day grand total

- V2 API total: **€ 143.003,71**
- CSV incl. btw total: **€ 147.578,00**
- Abs diff: **€ -4.574,29** (-3,10%)

**Regenerate:** `BORK_V2_CSV_TABLE_SUFFIX=_v2 node --experimental-strip-types scripts/generate-day-breakdown-v2-vs-csv-tables.ts --write` (optional suffix override)  
**Generated (UTC):** 2026-04-30T23:09:18.000Z

<!-- V2_VS_CSV_TABLES_END -->
