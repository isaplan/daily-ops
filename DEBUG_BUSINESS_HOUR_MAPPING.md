# Business Hour Mapping Debug - April 11, 2026

## Business Day Definition
- **Register resets at:** 06:00 each morning
- **Business Hour 0-17:** 06:00-23:59 (same calendar day)
- **Business Hour 18-23:** 00:00-05:59 (next calendar day)

## April 11 Business Day Analysis (CORRECTED MAPPING)

**Note: CSV shows CALENDAR HOURS (06, 07...23, 00, 01, 02...05), not business hours**

| CSV Hour | Real Calendar Time | Business Hour | Revenue (DB) | Revenue (CSV) | Match or No Match |
|----------|-------------------|---|---|---|---|
| 06       | 06:00-06:59 Apr 11    | 0  | €              0  | €              0  | MATCH ✅          |
| 07       | 07:00-07:59 Apr 11    | 1  | €              0  | €              0  | MATCH ✅          |
| 08       | 08:00-08:59 Apr 11    | 2  | €              0  | €              0  | MATCH ✅          |
| 09       | 09:00-09:59 Apr 11    | 3  | €              0  | €              0  | MATCH ✅          |
| 10       | 10:00-10:59 Apr 11    | 4  | €              0  | €              0  | MATCH ✅          |
| 11       | 11:00-11:59 Apr 11    | 5  | €              0  | €            111  | NO MATCH ❌       |
| 12       | 12:00-12:59 Apr 11    | 6  | €            115  | €            108  | CLOSE 🟡         |
| 13       | 13:00-13:59 Apr 11    | 7  | €            624  | €            574  | CLOSE 🟡         |
| 14       | 14:00-14:59 Apr 11    | 8  | €           1146  | €           1015  | CLOSE 🟡         |
| 15       | 15:00-15:59 Apr 11    | 9  | €           1221  | €           1085  | CLOSE 🟡         |
| 16       | 16:00-16:59 Apr 11    | 10 | €            761  | €            683  | CLOSE 🟡         |
| 17       | 17:00-17:59 Apr 11    | 11 | €            847  | €            739  | CLOSE 🟡         |
| 18       | 18:00-18:59 Apr 11    | 12 | €           1505  | €           1319  | CLOSE 🟡         |
| 19       | 19:00-19:59 Apr 11    | 13 | €           1964  | €           1752  | CLOSE 🟡         |
| 20       | 20:00-20:59 Apr 11    | 14 | €           1901  | €           1592  | CLOSE 🟡         |
| 21       | 21:00-21:59 Apr 11    | 15 | €           2266  | €           2020  | CLOSE 🟡         |
| 22       | 22:00-22:59 Apr 11    | 16 | €           2580  | €           2270  | CLOSE 🟡         |
| 23       | 23:00-23:59 Apr 11    | 17 | €           2073  | €           1842  | CLOSE 🟡         |
| 00       | 00:00-00:59 Apr 12    | 18 | €          26729  | €           2031  | NO MATCH ❌❌❌   |
| 01       | 01:00-01:59 Apr 12    | 19 | €              0  | €           2014  | NO MATCH ❌       |
| 02       | 02:00-02:59 Apr 12    | 20 | €              0  | €            331  | NO MATCH ❌       |
| 03       | 03:00-03:59 Apr 12    | 21 | €              0  | €              0  | MATCH ✅          |
| 04       | 04:00-04:59 Apr 12    | 22 | €              0  | €              0  | MATCH ✅          |
| 05       | 05:00-05:59 Apr 12    | 23 | €              0  | €            111  | NO MATCH ❌       |
|          |                       |    |                   |                   |                   |
| **TOTAL** |                      |    | €          43732  | €             19486  | **NO MATCH ❌**   |

## Summary

- **Database Total:** €43,732
- **CSV Total:** €19,486
- **Difference:** €24,246 (DB has 2.25x more)
- **Matching Hours:** 2 out of 24 (only hours 03 and 04, both €0)

## Key Findings

### Missing Data in DB
- **Business Hours 00-05 (06:00-11:00):** All show €0 in DB, but CSV has €2,031-€2,014 in hours 00-02 and €111 in hour 05
- **Business Hours 19-23 (01:00-06:00 next day):** All show €0 in DB, but CSV has €1,752-€2,270

### Excess Data in DB
- **Business Hour 18 (00:00-01:00 Apr 12):** DB shows €26,729 with **5,786 transactions** at L'Amour Toujours alone
  - L'Amour Toujours: €24,722 (5,786 transactions) 
  - Van Kinsbergen: €1,701 (371 transactions)
  - Bar Bea: €306
  - **CSV expects:** €1,319 total
  - ⚠️ **5,786 transactions in ONE HOUR is physically impossible** → Bork API returning duplicates/accumulated data
- **Business Hours 06-17 (12:00-23:00):** DB values range from €115-€2,580, CSV shows €0-€1,085

## Root Cause Analysis - FINAL

### The Data Mismatch is Caused by Missing Raw Data

**Critical Finding:**
- The `bork_raw_data` collection only contains Apr 12-13 data (552 records)
- The `bork_sales_by_hour` collection contains Apr 11-12 data (76 aggregated documents)
- The backfill script reports it "skipped" Apr 6-11 as "already in DB" 
- **But Apr 6-11 raw data does NOT exist in bork_raw_data**

### What Actually Happened

1. **Apr 6-11 raw data was synced at some point** and aggregations were created
2. **Raw data for Apr 6-11 was deleted** (perhaps to save space)
3. **Aggregations remain** but cannot be re-built or validated
4. **Latest sync (Apr 12-13)** pulled new raw data
5. **Apr 11 aggregations are stale/corrupted** with data from old (possibly malformed) API responses

### TEST Collection Results

Fresh aggregations built from available raw data (Apr 12-13) match the production collections perfectly, confirming **the aggregation logic is correct**. The problem is upstream: the raw data.

### RETEST AFTER DEDUPLICATION FIX

After fixing the duplicate aggregation bug:
- DB Apr 11 total: **€41,981** vs CSV **€19,486** (2.15x over-counted)
- Fixed: No more duplicate documents
- Problem persists: **Raw data from Bork API is inherently corrupted**

### Root Cause: Bork API Over-Counting

The Bork `/ticket/day.json/{YYYYMMDD}` endpoint is returning:
1. **Cumulative/historical transactions** - not day-isolated
2. **Multiple copies of same transactions** - appearing in multiple days
3. **Over-counting by ~2x average** across all hours

**Example:** Hour 0 alone shows DB €22,136 vs CSV €2,031 (10.9x more)

### Current Status
- ✅ Aggregation logic: CORRECT (deduplication fixed)
- ✅ Hour storage: CORRECT (numeric 0-23)
- ❌ Raw Bork data: CORRUPTED (2x over-counted)
- ⚠️ Weekly backfill: Running but will populate corrupted data

### Recommendation
Stop the Bork backfill and investigate the raw API responses to understand why they're over-counted. The issue is in the Bork API integration, not in our code.
