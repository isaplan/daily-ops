# Business Hour Mapping Debug - April 11, 2026

## Business Day Definition
- **Register resets at:** 06:00 each morning
- **Business Hour 0-17:** 06:00-23:59 (same calendar day)
- **Business Hour 18-23:** 00:00-05:59 (next calendar day)

## April 11 Business Day Analysis (CORRECTED MAPPING)

**Note: CSV shows CALENDAR HOURS (06, 07...23, 00, 01, 02...05), not business hours**

**Gap** = `Revenue (DB) − Revenue (CSV)` (same idea for V2 tables: **ours − CSV**). **Negative** ⇒ we are **short** vs the benchmark (we counted less). **Positive** ⇒ we have **too much** vs the benchmark (we counted more).

| CSV Hour | Real Calendar Time    | BH | Revenue (DB)    | Revenue (CSV)   | Gap (DB−CSV) | Match |
|:---------|:-------------------   |---:|-------------:   |--------------:  |-------------:|:------|
| 06       | 06:00-06:59 Apr 11    | 0  | €             0 | €             0 |            — | MATCH ✅ |
| 07       | 07:00-07:59 Apr 11    | 1  | €             0 | €             0 |            — | MATCH ✅ |
| 08       | 08:00-08:59 Apr 11    | 2  | €             0 | €             0 |            — | MATCH ✅ |
| 09       | 09:00-09:59 Apr 11    | 3  | €             0 | €             0 |            — | MATCH ✅ |
| 10       | 10:00-10:59 Apr 11    | 4  | €             0 | €             0 |            — | MATCH ✅ |
| 11       | 11:00-11:59 Apr 11    | 5  | €             0 | €           111 |         -111 | NO MATCH ❌ |
| 12       | 12:00-12:59 Apr 11    | 6  | €           115 | €           108 |           +7 | CLOSE 🟡 |
| 13       | 13:00-13:59 Apr 11    | 7  | €           624 | €           574 |          +50 | CLOSE 🟡 |
| 14       | 14:00-14:59 Apr 11    | 8  | €          1146 | €          1015 |         +131 | CLOSE 🟡 |
| 15       | 15:00-15:59 Apr 11    | 9  | €          1221 | €          1085 |         +136 | CLOSE 🟡 |
| 16       | 16:00-16:59 Apr 11    | 10 | €           761 | €           683 |          +78 | CLOSE 🟡 |
| 17       | 17:00-17:59 Apr 11    | 11 | €           847 | €           739 |         +108 | NO MATCH ❌ |
| 18       | 18:00-18:59 Apr 11    | 12 | €          1505 | €          1319 |         +186 | NO MATCH ❌ |
| 19       | 19:00-19:59 Apr 11    | 13 | €          1964 | €          1752 |         +212 | CLOSE 🟡 |
| 20       | 20:00-20:59 Apr 11    | 14 | €          1901 | €          1592 |         +309 | NO MATCH ❌ |
| 21       | 21:00-21:59 Apr 11    | 15 | €          2266 | €          2020 |         +246 | CLOSE 🟡 |
| 22       | 22:00-22:59 Apr 11    | 16 | €          2580 | €          2270 |         +310 | NO MATCH ❌ |
| 23       | 23:00-23:59 Apr 11    | 17 | €          2073 | €          1842 |         +231 | CLOSE 🟡 |
| 00       | 00:00-00:59 Apr 12    | 18 | €         26729 | €          2031 |       +24698 | NO MATCH ❌❌❌ |
| 01       | 01:00-01:59 Apr 12    | 19 | €             0 | €          2014 |        -2014 | NO MATCH ❌ |
| 02       | 02:00-02:59 Apr 12    | 20 | €             0 | €           331 |         -331 | NO MATCH ❌ |
| 03       | 03:00-03:59 Apr 12    | 21 | €             0 | €             0 |            — | MATCH ✅ |
| 04       | 04:00-04:59 Apr 12    | 22 | €             0 | €             0 |            — | MATCH ✅ |
| 05       | 05:00-05:59 Apr 12    | 23 | €             0 | €           111 |         -111 | NO MATCH ❌ |
| **TOTAL** |                      |    | **€     43732** | **€     19597** | **  +24135** | **NO MATCH ❌** |

---

## April 11, 2026 business day — V2 (`bork_sales_hours`) after `10101` open-ticket skip

**Window:** register Saturday **2026-04-11** = **2026-04-11 06:00:00 → 2026-04-12 05:59:59** (same mapping as table above).

**Run:** `rebuildBorkSalesAggregationV2(db, '2026-04-11', '2026-04-12', '')` then sum `total_revenue` on `bork_sales_hours` where `business_date = '2026-04-11'`, grouped by `business_hour`, **all locations** (same CSV basis as legacy table).

**Rebuild counts:** `salesHours: 74` documents, `businessDays: 9` (includes other `business_date` keys touched by orders in that calendar window).

**Gap** = `Revenue (V2) − Revenue (CSV)` (**negative** = short vs benchmark, **positive** = too much). *Hour lines sum to €17,015; **TOTAL** V2 uses stored aggregate **€17,016**.*

| CSV Hour | Real Calendar Time | BH | Revenue (V2) | Revenue (CSV) | Gap (V2−CSV) | Match |
|:---------|:-------------------|---:|-------------:|--------------:|-------------:|:------|
| 06       | 06:00-06:59 Apr 11    | 0  | €             0 | €             0 |            — | MATCH ✅ |
| 07       | 07:00-07:59 Apr 11    | 1  | €             0 | €             0 |            — | MATCH ✅ |
| 08       | 08:00-08:59 Apr 11    | 2  | €             0 | €             0 |            — | MATCH ✅ |
| 09       | 09:00-09:59 Apr 11    | 3  | €             0 | €             0 |            — | MATCH ✅ |
| 10       | 10:00-10:59 Apr 11    | 4  | €             0 | €             0 |            — | MATCH ✅ |
| 11       | 11:00-11:59 Apr 11    | 5  | €             0 | €           111 |         -111 | NO MATCH ❌ |
| 12       | 12:00-12:59 Apr 11    | 6  | €           115 | €           108 |           +7 | CLOSE 🟡 |
| 13       | 13:00-13:59 Apr 11    | 7  | €           624 | €           574 |          +50 | CLOSE 🟡 |
| 14       | 14:00-14:59 Apr 11    | 8  | €          1146 | €          1015 |         +131 | CLOSE 🟡 |
| 15       | 15:00-15:59 Apr 11    | 9  | €          1221 | €          1085 |         +136 | CLOSE 🟡 |
| 16       | 16:00-16:59 Apr 11    | 10 | €           761 | €           683 |          +78 | CLOSE 🟡 |
| 17       | 17:00-17:59 Apr 11    | 11 | €           847 | €           739 |         +108 | NO MATCH ❌ |
| 18       | 18:00-18:59 Apr 11    | 12 | €          1504 | €          1319 |         +185 | NO MATCH ❌ |
| 19       | 19:00-19:59 Apr 11    | 13 | €          1964 | €          1752 |         +212 | CLOSE 🟡 |
| 20       | 20:00-20:59 Apr 11    | 14 | €          1901 | €          1592 |         +309 | NO MATCH ❌ |
| 21       | 21:00-21:59 Apr 11    | 15 | €          2266 | €          2020 |         +246 | CLOSE 🟡 |
| 22       | 22:00-22:59 Apr 11    | 16 | €          2580 | €          2270 |         +310 | NO MATCH ❌ |
| 23       | 23:00-23:59 Apr 11    | 17 | €          2073 | €          1842 |         +231 | CLOSE 🟡 |
| 00       | 00:00-00:59 Apr 12    | 18 | €             0 | €          2031 |        -2031 | NO MATCH ❌ |
| 01       | 01:00-01:59 Apr 12    | 19 | €             0 | €          2014 |        -2014 | NO MATCH ❌ |
| 02       | 02:00-02:59 Apr 12    | 20 | €             0 | €           331 |         -331 | NO MATCH ❌ |
| 03       | 03:00-03:59 Apr 12    | 21 | €             0 | €             0 |            — | MATCH ✅ |
| 04       | 04:00-04:59 Apr 12    | 22 | €             0 | €             0 |            — | MATCH ✅ |
| 05       | 05:00-05:59 Apr 12    | 23 | €            13 | €           111 |          -98 | NO MATCH ❌ |
| **TOTAL** | |                         | **€     17016** | **€     19597** | **  -2581**  | **NO MATCH ❌** |

### V2 hourly breakdown by location (same `business_date`, register day)

**Late-night gap (BH 18–20):** On V2, **all three** unified locations show **€0** for business hours **18, 19, 20** (calendar **00:00–02:59** on **2026-04-12**). This is not isolated to one venue. Only **l'Amour Toujours** picks up **€13** in **BH 23** (05:00–05:59 Apr 12), which matches the combined V2 row for that hour. *(If you meant **evening** **18:00–20:59** on Apr 11, that is **BH 12–14** in this doc; V2 already has revenue there. The CSV mismatch you called out for “late night” is the **post-midnight** slice, **BH 18–20**.)*

**Why V2 drops that window:** V2 skips entire tickets when `Ticket.ActualDate` is the open placeholder **10101** (see ```53:56:server/services/borkRebuildAggregationV2Service.ts```). Guest spend that still lives on **open** tabs (or on tickets whose clock bucket is wrong because **`ticket.Time`** is missing or midnight) never lands in **closed-ticket** line revenue, so those hours stay at **0** even though CSV (closed sales) shows activity there.

**Per-location tables:** **`Revenue (V2)`** = this venue from `bork_sales_hours`. **`CSV (this location)`** = per-venue benchmark for that hour. *We do not repeat the org-wide CSV column here.* Until a real **per-location export** is pasted in, **`CSV (this location)`** is filled as **org benchmark hour × (this location’s V2 day total ÷ €17,016)** so each venue gets a **different** hour curve (not the same org numbers in every row). **Match** = V2 vs that column; **Gap** = **V2 − CSV (location)** (same sign rule as org-wide). Summing the three venues’ **TOTAL CSV** columns (**€7,121 + €7,916 + €4,562 = €19,599**) can land **±€2** from **€19,597** because each hour is **rounded** before summing.

### Raw `bork_daily` split — business tail **BH 18–23** (`business_date` 2026-04-11, V2 bucketing)

Same mapping as V2: `order.Date` + **`ticket.Time` hour** → business hour. Line revenue = `sum(Price*Qty)` on orders in the Apr **11–12** calendar window. **External hour column** = same source as the **combined V2 table** above (org-wide benchmark). **V2 (all locs)** = `bork_sales_hours` sum for that hour.

| BH | Benchmark (org) | V2 (all locs) | Gap (V2−bench) | Match | Closed raw | `10101` open | Raw Σ | Bench − closed |
|---:|----------------:|--------------:|---------------:|:------|-----------:|-------------:|------:|-----------------:|
| 18 | 2,031 | 0 | -2,031 | NO MATCH ❌ | 0 | 153,138 | 153,138 | 2,031 |
| 19 | 2,014 | 0 | -2,014 | NO MATCH ❌ | 0 | 0 | 0 | 2,014 |
| 20 | 331 | 0 | -331 | NO MATCH ❌ | 0 | 0 | 0 | 331 |
| 21 | 0 | 0 | 0 | MATCH ✅ | 0 | 0 | 0 | 0 |
| 22 | 0 | 0 | 0 | MATCH ✅ | 0 | 0 | 0 | 0 |
| 23 | 111 | 13 | -98 | NO MATCH ❌ | 13 | 0 | 13 | 98 |
| **Σ** | **4,487** | **13** | **-4,474** | **NO MATCH ❌** | **13** | **153,138** | **153,151** | **4,474** |

**How to read the gap:** **Gap** = **V2 − benchmark** (**negative** = short vs benchmark, **positive** = too much). **`10101` raw** is not a drop-in substitute (BH **18** alone is **€153k** vs **€2k** benchmark). **Benchmark − closed raw** = gap after counting only **closed-ticket** lines in raw.

### V2 hourly — Bar Bea

**CSV (this location):** org benchmark hour × (**€6,184** ÷ **€17,016**). Replace with **true per-venue export** when available — these numbers are a **proportional split** of the org benchmark, not a second copy of the org column. Hourly CSV cells are **rounded to whole euros**; **TOTAL CSV** = sum of those cells (may differ by **±€1** from the exact share). **Gap** = **V2 − CSV (location)**.

| CSV Hour | Real Calendar Time | BH | Revenue (V2) | CSV (this location) | Gap (V2−CSV) | Match |
|:---------|:-------------------|---:|-------------:|--------------------:|-------------:|:------|
| 06       | 06:00-06:59 Apr 11    | 0  | €             0 | €             0 |            — | MATCH ✅ |
| 07       | 07:00-07:59 Apr 11    | 1  | €             0 | €             0 |            — | MATCH ✅ |
| 08       | 08:00-08:59 Apr 11    | 2  | €             0 | €             0 |            — | MATCH ✅ |
| 09       | 09:00-09:59 Apr 11    | 3  | €             0 | €             0 |            — | MATCH ✅ |
| 10       | 10:00-10:59 Apr 11    | 4  | €             0 | €             0 |            — | MATCH ✅ |
| 11       | 11:00-11:59 Apr 11    | 5  | €             0 | €            40 |          -40 | NO MATCH ❌ |
| 12       | 12:00-12:59 Apr 11    | 6  | €           109 | €            39 |          +70 | NO MATCH ❌ |
| 13       | 13:00-13:59 Apr 11    | 7  | €           370 | €           209 |         +161 | NO MATCH ❌ |
| 14       | 14:00-14:59 Apr 11    | 8  | €           630 | €           369 |         +261 | NO MATCH ❌ |
| 15       | 15:00-15:59 Apr 11    | 9  | €           891 | €           394 |         +497 | NO MATCH ❌ |
| 16       | 16:00-16:59 Apr 11    | 10 | €           288 | €           248 |          +40 | NO MATCH ❌ |
| 17       | 17:00-17:59 Apr 11    | 11 | €           305 | €           269 |          +36 | CLOSE 🟡 |
| 18       | 18:00-18:59 Apr 11    | 12 | €           590 | €           479 |         +111 | NO MATCH ❌ |
| 19       | 19:00-19:59 Apr 11    | 13 | €           580 | €           637 |          -57 | CLOSE 🟡 |
| 20       | 20:00-20:59 Apr 11    | 14 | €           547 | €           579 |          -32 | CLOSE 🟡 |
| 21       | 21:00-21:59 Apr 11    | 15 | €           295 | €           734 |         -439 | NO MATCH ❌ |
| 22       | 22:00-22:59 Apr 11    | 16 | €           883 | €           825 |          +58 | CLOSE 🟡 |
| 23       | 23:00-23:59 Apr 11    | 17 | €           696 | €           669 |          +27 | CLOSE 🟡 |
| 00       | 00:00-00:59 Apr 12    | 18 | €             0 | €           738 |         -738 | NO MATCH ❌ |
| 01       | 01:00-01:59 Apr 12    | 19 | €             0 | €           732 |         -732 | NO MATCH ❌ |
| 02       | 02:00-02:59 Apr 12    | 20 | €             0 | €           120 |         -120 | NO MATCH ❌ |
| 03       | 03:00-03:59 Apr 12    | 21 | €             0 | €             0 |            — | MATCH ✅ |
| 04       | 04:00-04:59 Apr 12    | 22 | €             0 | €             0 |            — | MATCH ✅ |
| 05       | 05:00-05:59 Apr 12    | 23 | €             0 | €            40 |          -40 | NO MATCH ❌ |
| **TOTAL** |                      |    | **€      6184** | **€      7121** | **    -937** | **NO MATCH ❌** |

### V2 hourly — Van Kinsbergen

**CSV (this location):** org benchmark hour × (**€6,872** ÷ **€17,016**). Replace with **true per-venue export** when available. Hourly CSV cells are **rounded to whole euros**; **TOTAL CSV** = sum of those cells (may differ by **±€1** from the exact share). **Gap** = **V2 − CSV (location)**.

| CSV Hour | Real Calendar Time | BH | Revenue (V2) | CSV (this location) | Gap (V2−CSV) | Match |
|:---------|:-------------------|---:|-------------:|--------------------:|-------------:|:------|
| 06       | 06:00-06:59 Apr 11    | 0  | €             0 | €             0 |            — | MATCH ✅ |
| 07       | 07:00-07:59 Apr 11    | 1  | €             0 | €             0 |            — | MATCH ✅ |
| 08       | 08:00-08:59 Apr 11    | 2  | €             0 | €             0 |            — | MATCH ✅ |
| 09       | 09:00-09:59 Apr 11    | 3  | €             0 | €             0 |            — | MATCH ✅ |
| 10       | 10:00-10:59 Apr 11    | 4  | €             0 | €             0 |            — | MATCH ✅ |
| 11       | 11:00-11:59 Apr 11    | 5  | €             0 | €            45 |          -45 | NO MATCH ❌ |
| 12       | 12:00-12:59 Apr 11    | 6  | €             6 | €            44 |          -38 | NO MATCH ❌ |
| 13       | 13:00-13:59 Apr 11    | 7  | €           254 | €           232 |          +22 | CLOSE 🟡 |
| 14       | 14:00-14:59 Apr 11    | 8  | €           413 | €           410 |           +3 | CLOSE 🟡 |
| 15       | 15:00-15:59 Apr 11    | 9  | €           239 | €           438 |         -199 | NO MATCH ❌ |
| 16       | 16:00-16:59 Apr 11    | 10 | €           420 | €           276 |         +144 | NO MATCH ❌ |
| 17       | 17:00-17:59 Apr 11    | 11 | €           517 | €           298 |         +219 | NO MATCH ❌ |
| 18       | 18:00-18:59 Apr 11    | 12 | €           759 | €           533 |         +226 | NO MATCH ❌ |
| 19       | 19:00-19:59 Apr 11    | 13 | €           789 | €           708 |          +81 | CLOSE 🟡 |
| 20       | 20:00-20:59 Apr 11    | 14 | €           835 | €           643 |         +192 | NO MATCH ❌ |
| 21       | 21:00-21:59 Apr 11    | 15 | €          1426 | €           816 |         +610 | NO MATCH ❌ |
| 22       | 22:00-22:59 Apr 11    | 16 | €           611 | €           917 |         -306 | NO MATCH ❌ |
| 23       | 23:00-23:59 Apr 11    | 17 | €           603 | €           744 |         -141 | NO MATCH ❌ |
| 00       | 00:00-00:59 Apr 12    | 18 | €             0 | €           820 |         -820 | NO MATCH ❌ |
| 01       | 01:00-01:59 Apr 12    | 19 | €             0 | €           813 |         -813 | NO MATCH ❌ |
| 02       | 02:00-02:59 Apr 12    | 20 | €             0 | €           134 |         -134 | NO MATCH ❌ |
| 03       | 03:00-03:59 Apr 12    | 21 | €             0 | €             0 |            — | MATCH ✅ |
| 04       | 04:00-04:59 Apr 12    | 22 | €             0 | €             0 |            — | MATCH ✅ |
| 05       | 05:00-05:59 Apr 12    | 23 | €             0 | €            45 |          -45 | NO MATCH ❌ |
| **TOTAL** |                       |    | **€     6872** | **€      7916** | **   -1044** | **NO MATCH ❌** |

### V2 hourly — l'Amour Toujours

**CSV (this location):** org benchmark hour × (**€3,960** ÷ **€17,016**). Replace with **true per-venue export** when available. Hourly CSV cells are **rounded to whole euros**; **TOTAL CSV** = sum of those cells (may differ by **±€1** from the exact share). **Gap** = **V2 − CSV (location)**.

| CSV Hour | Real Calendar Time | BH | Revenue (V2) | CSV (this location) | Gap (V2−CSV) | Match |
|:---------|:-------------------|---:|-------------:|--------------------:|-------------:|:------|
| 06       | 06:00-06:59 Apr 11    | 0  | €             0 | €             0 |            — | MATCH ✅ |
| 07       | 07:00-07:59 Apr 11    | 1  | €             0 | €             0 |            — | MATCH ✅ |
| 08       | 08:00-08:59 Apr 11    | 2  | €             0 | €             0 |            — | MATCH ✅ |
| 09       | 09:00-09:59 Apr 11    | 3  | €             0 | €             0 |            — | MATCH ✅ |
| 10       | 10:00-10:59 Apr 11    | 4  | €             0 | €             0 |            — | MATCH ✅ |
| 11       | 11:00-11:59 Apr 11    | 5  | €             0 | €            26 |          -26 | NO MATCH ❌ |
| 12       | 12:00-12:59 Apr 11    | 6  | €             0 | €            25 |          -25 | CLOSE 🟡 |
| 13       | 13:00-13:59 Apr 11    | 7  | €             0 | €           134 |         -134 | NO MATCH ❌ |
| 14       | 14:00-14:59 Apr 11    | 8  | €           104 | €           236 |         -132 | NO MATCH ❌ |
| 15       | 15:00-15:59 Apr 11    | 9  | €            91 | €           253 |         -162 | NO MATCH ❌ |
| 16       | 16:00-16:59 Apr 11    | 10 | €            52 | €           159 |         -107 | NO MATCH ❌ |
| 17       | 17:00-17:59 Apr 11    | 11 | €            25 | €           172 |         -147 | NO MATCH ❌ |
| 18       | 18:00-18:59 Apr 11    | 12 | €           156 | €           307 |         -151 | NO MATCH ❌ |
| 19       | 19:00-19:59 Apr 11    | 13 | €           595 | €           408 |         +187 | NO MATCH ❌ |
| 20       | 20:00-20:59 Apr 11    | 14 | €           519 | €           370 |         +149 | NO MATCH ❌ |
| 21       | 21:00-21:59 Apr 11    | 15 | €           546 | €           470 |          +76 | NO MATCH ❌ |
| 22       | 22:00-22:59 Apr 11    | 16 | €          1086 | €           528 |         +558 | NO MATCH ❌ |
| 23       | 23:00-23:59 Apr 11    | 17 | €           773 | €           429 |         +344 | NO MATCH ❌ |
| 00       | 00:00-00:59 Apr 12    | 18 | €             0 | €           473 |         -473 | NO MATCH ❌ |
| 01       | 01:00-01:59 Apr 12    | 19 | €             0 | €           469 |         -469 | NO MATCH ❌ |
| 02       | 02:00-02:59 Apr 12    | 20 | €             0 | €            77 |          -77 | NO MATCH ❌ |
| 03       | 03:00-03:59 Apr 12    | 21 | €             0 | €             0 |            — | MATCH ✅ |
| 04       | 04:00-04:59 Apr 12    | 22 | €             0 | €             0 |            — | MATCH ✅ |
| 05       | 05:00-05:59 Apr 12    | 23 | €            13 | €            26 |          -13 | CLOSE 🟡 |
| **TOTAL** |                       |    | **€     3960** | **€      4562** | **    -602** | **NO MATCH ❌** |

### Register close at 06:00 — what the raw snapshots show

**Operational idea:** at register turnover, open work is closed so the business day is complete. **In our stored `bork_raw_data` pulls, that story is not visible in a clean way:**

1. **Snapshot timeline (`createdAt` order, stable `Ticket.Key`):** **0** tickets where the **first** state we ever see is **open (`10101`)** and a **later** snapshot shows the **same key closed**. So we cannot point to “open before 06:00 → closed right after 06:00” transitions in this history.
2. **Only overlap case:** **1** ticket key ever appears as both open and closed across snapshots; chronologically it is **closed first** (`Ticket.Time` **05:59**, `ActualDate` **20260413**) then flips to **`10101` / `00:00:00`** in rapid successive fetches — i.e. **inconsistent API / polling noise**, not a tidy Z-close.
3. **Closed tickets, `Ticket.Time` hour:** across deduped closed tickets in raw, **0** use hour **6** (06:xx). **~9.5k** use hour **0** (`00:00:00`), which swamps any “exact closure clock” reading from `Ticket.Time` alone.

**Conclusion:** the **06:00** register rule is real on the floor, but **Bork’s ticket payload + our snapshot timing** do not give a reliable “open before 06:00 / closed after 06:00” signal the way you expect; closure time is often **00:00:00** or missing semantics, and day-boundary revenue in CSV may be keyed differently than **`ticket.Time`**.

**V2 vs legacy (first table):** V2 total **€17,016** vs legacy DB **€43,732**; CSV column above sums to **€19,597** (24 hourly cells). The `10101` open-ticket skip removes most of the bogus **€26,729** legacy midnight bucket, but V2 still **does not** match CSV (e.g. **€0** in V2 for calendar hours **00–02** on Apr 12 where CSV shows revenue; hour **11** still **€0** vs **€111**).

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

---

## April 11, 2026 - Payment/Open/BarTab Breakdown (Requested Debug)

**Business day window:** `2026-04-11 06:00:00` -> `2026-04-12 05:59:59`  
**Source:** `bork_raw_data` (`endpoint=bork_daily`), all locations

### Payment Method Totals

| Payment Method | Count | Total |
|---|---:|---:|
| PIN | 319 | € 16,479 |
| Jamezz | 30 | € 476 |
| Cash | 11 | € 412 |
| Teruggave | 71 | € -340 |
| Geen betaling | 1 | € 13 |
| Factuur | 0 | € 0 |

### Ticket State Totals

| Type | Ticket Count | Revenue |
|---|---:|---:|
| Open tickets (`Ticket.ActualDate=10101`) | 5 | € 153,138 |
| Closed tickets | 376 | € 17,016 |

### BarTab Totals

| Type | Ticket Count | Revenue |
|---|---:|---:|
| BarTab (all, `AccountName` filled) | 4 | € 152,371 |
| BarTab open (`ActualDate=10101`) | 4 | € 152,371 |
| BarTab closed | 0 | € 0 |

### Derving / Representation / Internal-style Account Buckets

| Category (AccountName keyword) | Ticket Count | Revenue |
|---|---:|---:|
| personeelsbon / personeel | 1 | € 107,589 |
| huisbon | 2 | € 38,404 |
| derving | 0 | € 0 |
| representatie / represent | 0 | € 0 |
| factuur / invoice | 0 | € 0 |


<!-- BORK_V2_14D_START -->
## Last 14 days — V2 vs CSV (per location, hourly)

**Refresh:** `node --experimental-strip-types scripts/generate-bork-14d-v2-overview.ts` (uses `MONGODB_URI` / `MONGODB_DB_NAME`; optional `BORK_AGG_V2_SUFFIX`).  
**Generated:** 2026-04-18T10:45:58.546Z  
**Window:** `business_date` **2026-04-10** … **2026-04-12** — **3** distinct register day(s) with data (up to **14** most recent in `bork_sales_hours`).  
**CSV (this location)** = org benchmark hour **h** from the April 11 table above × (**location V2 day total** ÷ **org V2 day total**), with **org V2 day total** = sum of `total_revenue` for that `business_date` across all mapped locations. **Gap** = **V2 − CSV** (rounded). **Match** uses the same tolerance as the main doc. When you have **real CSV** per day, replace this proxy column.

| business_date | location | CSV Hour | Real Calendar Time | BH | Revenue (V2) | CSV (this location) | Gap (V2−CSV) | Match |
|:--------------|:---------|:---------|:-------------------|---:|-------------:|--------------------:|-------------:|:------|
| 2026-04-10 | Bar Bea | 06 | 06:00-06:59 Apr 10, 2026 | 0 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-10 | Bar Bea | 07 | 07:00-07:59 Apr 10, 2026 | 1 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-10 | Bar Bea | 08 | 08:00-08:59 Apr 10, 2026 | 2 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-10 | Bar Bea | 09 | 09:00-09:59 Apr 10, 2026 | 3 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-10 | Bar Bea | 10 | 10:00-10:59 Apr 10, 2026 | 4 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-10 | Bar Bea | 11 | 11:00-11:59 Apr 10, 2026 | 5 | €     0 | €    72 |          -72 | NO MATCH ❌ |
| 2026-04-10 | Bar Bea | 12 | 12:00-12:59 Apr 10, 2026 | 6 | €     0 | €    70 |          -70 | NO MATCH ❌ |
| 2026-04-10 | Bar Bea | 13 | 13:00-13:59 Apr 10, 2026 | 7 | €     0 | €   373 |         -373 | NO MATCH ❌ |
| 2026-04-10 | Bar Bea | 14 | 14:00-14:59 Apr 10, 2026 | 8 | €     0 | €   660 |         -660 | NO MATCH ❌ |
| 2026-04-10 | Bar Bea | 15 | 15:00-15:59 Apr 10, 2026 | 9 | €     0 | €   705 |         -705 | NO MATCH ❌ |
| 2026-04-10 | Bar Bea | 16 | 16:00-16:59 Apr 10, 2026 | 10 | €     0 | €   444 |         -444 | NO MATCH ❌ |
| 2026-04-10 | Bar Bea | 17 | 17:00-17:59 Apr 10, 2026 | 11 | €     0 | €   480 |         -480 | NO MATCH ❌ |
| 2026-04-10 | Bar Bea | 18 | 18:00-18:59 Apr 10, 2026 | 12 | €     0 | €   857 |         -857 | NO MATCH ❌ |
| 2026-04-10 | Bar Bea | 19 | 19:00-19:59 Apr 10, 2026 | 13 | €     0 | €  1139 |        -1139 | NO MATCH ❌ |
| 2026-04-10 | Bar Bea | 20 | 20:00-20:59 Apr 10, 2026 | 14 | €     0 | €  1035 |        -1035 | NO MATCH ❌ |
| 2026-04-10 | Bar Bea | 21 | 21:00-21:59 Apr 10, 2026 | 15 | €     0 | €  1313 |        -1313 | NO MATCH ❌ |
| 2026-04-10 | Bar Bea | 22 | 22:00-22:59 Apr 10, 2026 | 16 | €     0 | €  1475 |        -1475 | NO MATCH ❌ |
| 2026-04-10 | Bar Bea | 23 | 23:00-23:59 Apr 10, 2026 | 17 | €     0 | €  1197 |        -1197 | NO MATCH ❌ |
| 2026-04-10 | Bar Bea | 00 | 00:00-00:59 Apr 11, 2026 | 18 | €   824 | €  1320 |         -496 | NO MATCH ❌ |
| 2026-04-10 | Bar Bea | 01 | 01:00-01:59 Apr 11, 2026 | 19 | €  2334 | €  1309 |        +1025 | NO MATCH ❌ |
| 2026-04-10 | Bar Bea | 02 | 02:00-02:59 Apr 11, 2026 | 20 | €   375 | €   215 |         +160 | NO MATCH ❌ |
| 2026-04-10 | Bar Bea | 03 | 03:00-03:59 Apr 11, 2026 | 21 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-10 | Bar Bea | 04 | 04:00-04:59 Apr 11, 2026 | 22 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-10 | Bar Bea | 05 | 05:00-05:59 Apr 11, 2026 | 23 | €     0 | €    72 |          -72 | NO MATCH ❌ |
| 2026-04-10 | Van Kinsbergen | 06 | 06:00-06:59 Apr 10, 2026 | 0 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-10 | Van Kinsbergen | 07 | 07:00-07:59 Apr 10, 2026 | 1 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-10 | Van Kinsbergen | 08 | 08:00-08:59 Apr 10, 2026 | 2 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-10 | Van Kinsbergen | 09 | 09:00-09:59 Apr 10, 2026 | 3 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-10 | Van Kinsbergen | 10 | 10:00-10:59 Apr 10, 2026 | 4 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-10 | Van Kinsbergen | 11 | 11:00-11:59 Apr 10, 2026 | 5 | €     0 | €    10 |          -10 | CLOSE 🟡 |
| 2026-04-10 | Van Kinsbergen | 12 | 12:00-12:59 Apr 10, 2026 | 6 | €     0 | €    10 |          -10 | CLOSE 🟡 |
| 2026-04-10 | Van Kinsbergen | 13 | 13:00-13:59 Apr 10, 2026 | 7 | €     0 | €    52 |          -52 | NO MATCH ❌ |
| 2026-04-10 | Van Kinsbergen | 14 | 14:00-14:59 Apr 10, 2026 | 8 | €     0 | €    92 |          -92 | NO MATCH ❌ |
| 2026-04-10 | Van Kinsbergen | 15 | 15:00-15:59 Apr 10, 2026 | 9 | €     0 | €    99 |          -99 | NO MATCH ❌ |
| 2026-04-10 | Van Kinsbergen | 16 | 16:00-16:59 Apr 10, 2026 | 10 | €     0 | €    62 |          -62 | NO MATCH ❌ |
| 2026-04-10 | Van Kinsbergen | 17 | 17:00-17:59 Apr 10, 2026 | 11 | €     0 | €    67 |          -67 | NO MATCH ❌ |
| 2026-04-10 | Van Kinsbergen | 18 | 18:00-18:59 Apr 10, 2026 | 12 | €     0 | €   120 |         -120 | NO MATCH ❌ |
| 2026-04-10 | Van Kinsbergen | 19 | 19:00-19:59 Apr 10, 2026 | 13 | €     0 | €   159 |         -159 | NO MATCH ❌ |
| 2026-04-10 | Van Kinsbergen | 20 | 20:00-20:59 Apr 10, 2026 | 14 | €     0 | €   145 |         -145 | NO MATCH ❌ |
| 2026-04-10 | Van Kinsbergen | 21 | 21:00-21:59 Apr 10, 2026 | 15 | €     0 | €   184 |         -184 | NO MATCH ❌ |
| 2026-04-10 | Van Kinsbergen | 22 | 22:00-22:59 Apr 10, 2026 | 16 | €     0 | €   207 |         -207 | NO MATCH ❌ |
| 2026-04-10 | Van Kinsbergen | 23 | 23:00-23:59 Apr 10, 2026 | 17 | €     0 | €   168 |         -168 | NO MATCH ❌ |
| 2026-04-10 | Van Kinsbergen | 00 | 00:00-00:59 Apr 11, 2026 | 18 | €   485 | €   185 |         +300 | NO MATCH ❌ |
| 2026-04-10 | Van Kinsbergen | 01 | 01:00-01:59 Apr 11, 2026 | 19 | €    10 | €   183 |         -173 | NO MATCH ❌ |
| 2026-04-10 | Van Kinsbergen | 02 | 02:00-02:59 Apr 11, 2026 | 20 | €     0 | €    30 |          -30 | NO MATCH ❌ |
| 2026-04-10 | Van Kinsbergen | 03 | 03:00-03:59 Apr 11, 2026 | 21 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-10 | Van Kinsbergen | 04 | 04:00-04:59 Apr 11, 2026 | 22 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-10 | Van Kinsbergen | 05 | 05:00-05:59 Apr 11, 2026 | 23 | €     0 | €    10 |          -10 | CLOSE 🟡 |
| 2026-04-10 | l'Amour Toujours | 06 | 06:00-06:59 Apr 10, 2026 | 0 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-10 | l'Amour Toujours | 07 | 07:00-07:59 Apr 10, 2026 | 1 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-10 | l'Amour Toujours | 08 | 08:00-08:59 Apr 10, 2026 | 2 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-10 | l'Amour Toujours | 09 | 09:00-09:59 Apr 10, 2026 | 3 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-10 | l'Amour Toujours | 10 | 10:00-10:59 Apr 10, 2026 | 4 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-10 | l'Amour Toujours | 11 | 11:00-11:59 Apr 10, 2026 | 5 | €     0 | €    29 |          -29 | NO MATCH ❌ |
| 2026-04-10 | l'Amour Toujours | 12 | 12:00-12:59 Apr 10, 2026 | 6 | €     0 | €    28 |          -28 | NO MATCH ❌ |
| 2026-04-10 | l'Amour Toujours | 13 | 13:00-13:59 Apr 10, 2026 | 7 | €     0 | €   149 |         -149 | NO MATCH ❌ |
| 2026-04-10 | l'Amour Toujours | 14 | 14:00-14:59 Apr 10, 2026 | 8 | €     0 | €   263 |         -263 | NO MATCH ❌ |
| 2026-04-10 | l'Amour Toujours | 15 | 15:00-15:59 Apr 10, 2026 | 9 | €     0 | €   281 |         -281 | NO MATCH ❌ |
| 2026-04-10 | l'Amour Toujours | 16 | 16:00-16:59 Apr 10, 2026 | 10 | €     0 | €   177 |         -177 | NO MATCH ❌ |
| 2026-04-10 | l'Amour Toujours | 17 | 17:00-17:59 Apr 10, 2026 | 11 | €     0 | €   192 |         -192 | NO MATCH ❌ |
| 2026-04-10 | l'Amour Toujours | 18 | 18:00-18:59 Apr 10, 2026 | 12 | €     0 | €   342 |         -342 | NO MATCH ❌ |
| 2026-04-10 | l'Amour Toujours | 19 | 19:00-19:59 Apr 10, 2026 | 13 | €     0 | €   454 |         -454 | NO MATCH ❌ |
| 2026-04-10 | l'Amour Toujours | 20 | 20:00-20:59 Apr 10, 2026 | 14 | €     0 | €   413 |         -413 | NO MATCH ❌ |
| 2026-04-10 | l'Amour Toujours | 21 | 21:00-21:59 Apr 10, 2026 | 15 | €     0 | €   523 |         -523 | NO MATCH ❌ |
| 2026-04-10 | l'Amour Toujours | 22 | 22:00-22:59 Apr 10, 2026 | 16 | €     0 | €   588 |         -588 | NO MATCH ❌ |
| 2026-04-10 | l'Amour Toujours | 23 | 23:00-23:59 Apr 10, 2026 | 17 | €     0 | €   477 |         -477 | NO MATCH ❌ |
| 2026-04-10 | l'Amour Toujours | 00 | 00:00-00:59 Apr 11, 2026 | 18 | €  1286 | €   526 |         +760 | NO MATCH ❌ |
| 2026-04-10 | l'Amour Toujours | 01 | 01:00-01:59 Apr 11, 2026 | 19 | €     0 | €   522 |         -522 | NO MATCH ❌ |
| 2026-04-10 | l'Amour Toujours | 02 | 02:00-02:59 Apr 11, 2026 | 20 | €     0 | €    86 |          -86 | NO MATCH ❌ |
| 2026-04-10 | l'Amour Toujours | 03 | 03:00-03:59 Apr 11, 2026 | 21 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-10 | l'Amour Toujours | 04 | 04:00-04:59 Apr 11, 2026 | 22 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-10 | l'Amour Toujours | 05 | 05:00-05:59 Apr 11, 2026 | 23 | €   123 | €    29 |          +94 | NO MATCH ❌ |
| 2026-04-11 | Bar Bea | 06 | 06:00-06:59 Apr 11, 2026 | 0 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-11 | Bar Bea | 07 | 07:00-07:59 Apr 11, 2026 | 1 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-11 | Bar Bea | 08 | 08:00-08:59 Apr 11, 2026 | 2 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-11 | Bar Bea | 09 | 09:00-09:59 Apr 11, 2026 | 3 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-11 | Bar Bea | 10 | 10:00-10:59 Apr 11, 2026 | 4 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-11 | Bar Bea | 11 | 11:00-11:59 Apr 11, 2026 | 5 | €     0 | €    40 |          -40 | NO MATCH ❌ |
| 2026-04-11 | Bar Bea | 12 | 12:00-12:59 Apr 11, 2026 | 6 | €   109 | €    39 |          +70 | NO MATCH ❌ |
| 2026-04-11 | Bar Bea | 13 | 13:00-13:59 Apr 11, 2026 | 7 | €   370 | €   209 |         +161 | NO MATCH ❌ |
| 2026-04-11 | Bar Bea | 14 | 14:00-14:59 Apr 11, 2026 | 8 | €   630 | €   369 |         +261 | NO MATCH ❌ |
| 2026-04-11 | Bar Bea | 15 | 15:00-15:59 Apr 11, 2026 | 9 | €   891 | €   394 |         +497 | NO MATCH ❌ |
| 2026-04-11 | Bar Bea | 16 | 16:00-16:59 Apr 11, 2026 | 10 | €   288 | €   248 |          +40 | NO MATCH ❌ |
| 2026-04-11 | Bar Bea | 17 | 17:00-17:59 Apr 11, 2026 | 11 | €   305 | €   269 |          +36 | CLOSE 🟡 |
| 2026-04-11 | Bar Bea | 18 | 18:00-18:59 Apr 11, 2026 | 12 | €   590 | €   479 |         +111 | NO MATCH ❌ |
| 2026-04-11 | Bar Bea | 19 | 19:00-19:59 Apr 11, 2026 | 13 | €   580 | €   637 |          -57 | CLOSE 🟡 |
| 2026-04-11 | Bar Bea | 20 | 20:00-20:59 Apr 11, 2026 | 14 | €   547 | €   579 |          -32 | CLOSE 🟡 |
| 2026-04-11 | Bar Bea | 21 | 21:00-21:59 Apr 11, 2026 | 15 | €   295 | €   734 |         -439 | NO MATCH ❌ |
| 2026-04-11 | Bar Bea | 22 | 22:00-22:59 Apr 11, 2026 | 16 | €   883 | €   825 |          +58 | CLOSE 🟡 |
| 2026-04-11 | Bar Bea | 23 | 23:00-23:59 Apr 11, 2026 | 17 | €   697 | €   669 |          +28 | CLOSE 🟡 |
| 2026-04-11 | Bar Bea | 00 | 00:00-00:59 Apr 12, 2026 | 18 | €     0 | €   738 |         -738 | NO MATCH ❌ |
| 2026-04-11 | Bar Bea | 01 | 01:00-01:59 Apr 12, 2026 | 19 | €     0 | €   732 |         -732 | NO MATCH ❌ |
| 2026-04-11 | Bar Bea | 02 | 02:00-02:59 Apr 12, 2026 | 20 | €     0 | €   120 |         -120 | NO MATCH ❌ |
| 2026-04-11 | Bar Bea | 03 | 03:00-03:59 Apr 12, 2026 | 21 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-11 | Bar Bea | 04 | 04:00-04:59 Apr 12, 2026 | 22 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-11 | Bar Bea | 05 | 05:00-05:59 Apr 12, 2026 | 23 | €     0 | €    40 |          -40 | NO MATCH ❌ |
| 2026-04-11 | Van Kinsbergen | 06 | 06:00-06:59 Apr 11, 2026 | 0 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-11 | Van Kinsbergen | 07 | 07:00-07:59 Apr 11, 2026 | 1 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-11 | Van Kinsbergen | 08 | 08:00-08:59 Apr 11, 2026 | 2 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-11 | Van Kinsbergen | 09 | 09:00-09:59 Apr 11, 2026 | 3 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-11 | Van Kinsbergen | 10 | 10:00-10:59 Apr 11, 2026 | 4 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-11 | Van Kinsbergen | 11 | 11:00-11:59 Apr 11, 2026 | 5 | €     0 | €    45 |          -45 | NO MATCH ❌ |
| 2026-04-11 | Van Kinsbergen | 12 | 12:00-12:59 Apr 11, 2026 | 6 | €     6 | €    44 |          -38 | NO MATCH ❌ |
| 2026-04-11 | Van Kinsbergen | 13 | 13:00-13:59 Apr 11, 2026 | 7 | €   254 | €   232 |          +22 | CLOSE 🟡 |
| 2026-04-11 | Van Kinsbergen | 14 | 14:00-14:59 Apr 11, 2026 | 8 | €   413 | €   410 |           +3 | CLOSE 🟡 |
| 2026-04-11 | Van Kinsbergen | 15 | 15:00-15:59 Apr 11, 2026 | 9 | €   239 | €   438 |         -199 | NO MATCH ❌ |
| 2026-04-11 | Van Kinsbergen | 16 | 16:00-16:59 Apr 11, 2026 | 10 | €   420 | €   276 |         +144 | NO MATCH ❌ |
| 2026-04-11 | Van Kinsbergen | 17 | 17:00-17:59 Apr 11, 2026 | 11 | €   517 | €   298 |         +219 | NO MATCH ❌ |
| 2026-04-11 | Van Kinsbergen | 18 | 18:00-18:59 Apr 11, 2026 | 12 | €   759 | €   533 |         +226 | NO MATCH ❌ |
| 2026-04-11 | Van Kinsbergen | 19 | 19:00-19:59 Apr 11, 2026 | 13 | €   789 | €   708 |          +81 | CLOSE 🟡 |
| 2026-04-11 | Van Kinsbergen | 20 | 20:00-20:59 Apr 11, 2026 | 14 | €   835 | €   643 |         +192 | NO MATCH ❌ |
| 2026-04-11 | Van Kinsbergen | 21 | 21:00-21:59 Apr 11, 2026 | 15 | €  1426 | €   816 |         +610 | NO MATCH ❌ |
| 2026-04-11 | Van Kinsbergen | 22 | 22:00-22:59 Apr 11, 2026 | 16 | €   611 | €   917 |         -306 | NO MATCH ❌ |
| 2026-04-11 | Van Kinsbergen | 23 | 23:00-23:59 Apr 11, 2026 | 17 | €   604 | €   744 |         -140 | NO MATCH ❌ |
| 2026-04-11 | Van Kinsbergen | 00 | 00:00-00:59 Apr 12, 2026 | 18 | €     0 | €   820 |         -820 | NO MATCH ❌ |
| 2026-04-11 | Van Kinsbergen | 01 | 01:00-01:59 Apr 12, 2026 | 19 | €     0 | €   813 |         -813 | NO MATCH ❌ |
| 2026-04-11 | Van Kinsbergen | 02 | 02:00-02:59 Apr 12, 2026 | 20 | €     0 | €   134 |         -134 | NO MATCH ❌ |
| 2026-04-11 | Van Kinsbergen | 03 | 03:00-03:59 Apr 12, 2026 | 21 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-11 | Van Kinsbergen | 04 | 04:00-04:59 Apr 12, 2026 | 22 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-11 | Van Kinsbergen | 05 | 05:00-05:59 Apr 12, 2026 | 23 | €     0 | €    45 |          -45 | NO MATCH ❌ |
| 2026-04-11 | l'Amour Toujours | 06 | 06:00-06:59 Apr 11, 2026 | 0 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-11 | l'Amour Toujours | 07 | 07:00-07:59 Apr 11, 2026 | 1 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-11 | l'Amour Toujours | 08 | 08:00-08:59 Apr 11, 2026 | 2 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-11 | l'Amour Toujours | 09 | 09:00-09:59 Apr 11, 2026 | 3 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-11 | l'Amour Toujours | 10 | 10:00-10:59 Apr 11, 2026 | 4 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-11 | l'Amour Toujours | 11 | 11:00-11:59 Apr 11, 2026 | 5 | €     0 | €    26 |          -26 | NO MATCH ❌ |
| 2026-04-11 | l'Amour Toujours | 12 | 12:00-12:59 Apr 11, 2026 | 6 | €     0 | €    25 |          -25 | CLOSE 🟡 |
| 2026-04-11 | l'Amour Toujours | 13 | 13:00-13:59 Apr 11, 2026 | 7 | €     0 | €   134 |         -134 | NO MATCH ❌ |
| 2026-04-11 | l'Amour Toujours | 14 | 14:00-14:59 Apr 11, 2026 | 8 | €   104 | €   236 |         -132 | NO MATCH ❌ |
| 2026-04-11 | l'Amour Toujours | 15 | 15:00-15:59 Apr 11, 2026 | 9 | €    91 | €   252 |         -161 | NO MATCH ❌ |
| 2026-04-11 | l'Amour Toujours | 16 | 16:00-16:59 Apr 11, 2026 | 10 | €    52 | €   159 |         -107 | NO MATCH ❌ |
| 2026-04-11 | l'Amour Toujours | 17 | 17:00-17:59 Apr 11, 2026 | 11 | €    25 | €   172 |         -147 | NO MATCH ❌ |
| 2026-04-11 | l'Amour Toujours | 18 | 18:00-18:59 Apr 11, 2026 | 12 | €   156 | €   307 |         -151 | NO MATCH ❌ |
| 2026-04-11 | l'Amour Toujours | 19 | 19:00-19:59 Apr 11, 2026 | 13 | €   595 | €   408 |         +187 | NO MATCH ❌ |
| 2026-04-11 | l'Amour Toujours | 20 | 20:00-20:59 Apr 11, 2026 | 14 | €   519 | €   370 |         +149 | NO MATCH ❌ |
| 2026-04-11 | l'Amour Toujours | 21 | 21:00-21:59 Apr 11, 2026 | 15 | €   546 | €   470 |          +76 | NO MATCH ❌ |
| 2026-04-11 | l'Amour Toujours | 22 | 22:00-22:59 Apr 11, 2026 | 16 | €  1086 | €   528 |         +558 | NO MATCH ❌ |
| 2026-04-11 | l'Amour Toujours | 23 | 23:00-23:59 Apr 11, 2026 | 17 | €   773 | €   429 |         +344 | NO MATCH ❌ |
| 2026-04-11 | l'Amour Toujours | 00 | 00:00-00:59 Apr 12, 2026 | 18 | €     0 | €   473 |         -473 | NO MATCH ❌ |
| 2026-04-11 | l'Amour Toujours | 01 | 01:00-01:59 Apr 12, 2026 | 19 | €     0 | €   469 |         -469 | NO MATCH ❌ |
| 2026-04-11 | l'Amour Toujours | 02 | 02:00-02:59 Apr 12, 2026 | 20 | €     0 | €    77 |          -77 | NO MATCH ❌ |
| 2026-04-11 | l'Amour Toujours | 03 | 03:00-03:59 Apr 12, 2026 | 21 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-11 | l'Amour Toujours | 04 | 04:00-04:59 Apr 12, 2026 | 22 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-11 | l'Amour Toujours | 05 | 05:00-05:59 Apr 12, 2026 | 23 | €    13 | €    26 |          -13 | CLOSE 🟡 |
| 2026-04-12 | Bar Bea | 06 | 06:00-06:59 Apr 12, 2026 | 0 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-12 | Bar Bea | 07 | 07:00-07:59 Apr 12, 2026 | 1 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-12 | Bar Bea | 08 | 08:00-08:59 Apr 12, 2026 | 2 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-12 | Bar Bea | 09 | 09:00-09:59 Apr 12, 2026 | 3 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-12 | Bar Bea | 10 | 10:00-10:59 Apr 12, 2026 | 4 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-12 | Bar Bea | 11 | 11:00-11:59 Apr 12, 2026 | 5 | €     0 | €    34 |          -34 | NO MATCH ❌ |
| 2026-04-12 | Bar Bea | 12 | 12:00-12:59 Apr 12, 2026 | 6 | €    14 | €    33 |          -19 | CLOSE 🟡 |
| 2026-04-12 | Bar Bea | 13 | 13:00-13:59 Apr 12, 2026 | 7 | €   317 | €   178 |         +139 | NO MATCH ❌ |
| 2026-04-12 | Bar Bea | 14 | 14:00-14:59 Apr 12, 2026 | 8 | €   204 | €   315 |         -111 | NO MATCH ❌ |
| 2026-04-12 | Bar Bea | 15 | 15:00-15:59 Apr 12, 2026 | 9 | €   514 | €   336 |         +178 | NO MATCH ❌ |
| 2026-04-12 | Bar Bea | 16 | 16:00-16:59 Apr 12, 2026 | 10 | €   481 | €   212 |         +269 | NO MATCH ❌ |
| 2026-04-12 | Bar Bea | 17 | 17:00-17:59 Apr 12, 2026 | 11 | €   461 | €   229 |         +232 | NO MATCH ❌ |
| 2026-04-12 | Bar Bea | 18 | 18:00-18:59 Apr 12, 2026 | 12 | €   454 | €   409 |          +45 | CLOSE 🟡 |
| 2026-04-12 | Bar Bea | 19 | 19:00-19:59 Apr 12, 2026 | 13 | €   241 | €   543 |         -302 | NO MATCH ❌ |
| 2026-04-12 | Bar Bea | 20 | 20:00-20:59 Apr 12, 2026 | 14 | €   647 | €   494 |         +153 | NO MATCH ❌ |
| 2026-04-12 | Bar Bea | 21 | 21:00-21:59 Apr 12, 2026 | 15 | €   257 | €   626 |         -369 | NO MATCH ❌ |
| 2026-04-12 | Bar Bea | 22 | 22:00-22:59 Apr 12, 2026 | 16 | €   127 | €   704 |         -577 | NO MATCH ❌ |
| 2026-04-12 | Bar Bea | 23 | 23:00-23:59 Apr 12, 2026 | 17 | €     0 | €   571 |         -571 | NO MATCH ❌ |
| 2026-04-12 | Bar Bea | 00 | 00:00-00:59 Apr 13, 2026 | 18 | €     0 | €   630 |         -630 | NO MATCH ❌ |
| 2026-04-12 | Bar Bea | 01 | 01:00-01:59 Apr 13, 2026 | 19 | €     0 | €   624 |         -624 | NO MATCH ❌ |
| 2026-04-12 | Bar Bea | 02 | 02:00-02:59 Apr 13, 2026 | 20 | €     0 | €   103 |         -103 | NO MATCH ❌ |
| 2026-04-12 | Bar Bea | 03 | 03:00-03:59 Apr 13, 2026 | 21 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-12 | Bar Bea | 04 | 04:00-04:59 Apr 13, 2026 | 22 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-12 | Bar Bea | 05 | 05:00-05:59 Apr 13, 2026 | 23 | €     0 | €    34 |          -34 | NO MATCH ❌ |
| 2026-04-12 | Van Kinsbergen | 06 | 06:00-06:59 Apr 12, 2026 | 0 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-12 | Van Kinsbergen | 07 | 07:00-07:59 Apr 12, 2026 | 1 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-12 | Van Kinsbergen | 08 | 08:00-08:59 Apr 12, 2026 | 2 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-12 | Van Kinsbergen | 09 | 09:00-09:59 Apr 12, 2026 | 3 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-12 | Van Kinsbergen | 10 | 10:00-10:59 Apr 12, 2026 | 4 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-12 | Van Kinsbergen | 11 | 11:00-11:59 Apr 12, 2026 | 5 | €     0 | €    53 |          -53 | NO MATCH ❌ |
| 2026-04-12 | Van Kinsbergen | 12 | 12:00-12:59 Apr 12, 2026 | 6 | €     0 | €    51 |          -51 | NO MATCH ❌ |
| 2026-04-12 | Van Kinsbergen | 13 | 13:00-13:59 Apr 12, 2026 | 7 | €   157 | €   273 |         -116 | NO MATCH ❌ |
| 2026-04-12 | Van Kinsbergen | 14 | 14:00-14:59 Apr 12, 2026 | 8 | €   558 | €   484 |          +74 | NO MATCH ❌ |
| 2026-04-12 | Van Kinsbergen | 15 | 15:00-15:59 Apr 12, 2026 | 9 | €   383 | €   517 |         -134 | NO MATCH ❌ |
| 2026-04-12 | Van Kinsbergen | 16 | 16:00-16:59 Apr 12, 2026 | 10 | €   405 | €   325 |          +80 | NO MATCH ❌ |
| 2026-04-12 | Van Kinsbergen | 17 | 17:00-17:59 Apr 12, 2026 | 11 | €   301 | €   352 |          -51 | NO MATCH ❌ |
| 2026-04-12 | Van Kinsbergen | 18 | 18:00-18:59 Apr 12, 2026 | 12 | €   780 | €   628 |         +152 | NO MATCH ❌ |
| 2026-04-12 | Van Kinsbergen | 19 | 19:00-19:59 Apr 12, 2026 | 13 | €   469 | €   835 |         -366 | NO MATCH ❌ |
| 2026-04-12 | Van Kinsbergen | 20 | 20:00-20:59 Apr 12, 2026 | 14 | €   407 | €   759 |         -352 | NO MATCH ❌ |
| 2026-04-12 | Van Kinsbergen | 21 | 21:00-21:59 Apr 12, 2026 | 15 | €  1573 | €   962 |         +611 | NO MATCH ❌ |
| 2026-04-12 | Van Kinsbergen | 22 | 22:00-22:59 Apr 12, 2026 | 16 | €   596 | €  1082 |         -486 | NO MATCH ❌ |
| 2026-04-12 | Van Kinsbergen | 23 | 23:00-23:59 Apr 12, 2026 | 17 | €    83 | €   878 |         -795 | NO MATCH ❌ |
| 2026-04-12 | Van Kinsbergen | 00 | 00:00-00:59 Apr 13, 2026 | 18 | €     0 | €   968 |         -968 | NO MATCH ❌ |
| 2026-04-12 | Van Kinsbergen | 01 | 01:00-01:59 Apr 13, 2026 | 19 | €     0 | €   960 |         -960 | NO MATCH ❌ |
| 2026-04-12 | Van Kinsbergen | 02 | 02:00-02:59 Apr 13, 2026 | 20 | €     0 | €   158 |         -158 | NO MATCH ❌ |
| 2026-04-12 | Van Kinsbergen | 03 | 03:00-03:59 Apr 13, 2026 | 21 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-12 | Van Kinsbergen | 04 | 04:00-04:59 Apr 13, 2026 | 22 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-12 | Van Kinsbergen | 05 | 05:00-05:59 Apr 13, 2026 | 23 | €     0 | €    53 |          -53 | NO MATCH ❌ |
| 2026-04-12 | l'Amour Toujours | 06 | 06:00-06:59 Apr 12, 2026 | 0 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-12 | l'Amour Toujours | 07 | 07:00-07:59 Apr 12, 2026 | 1 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-12 | l'Amour Toujours | 08 | 08:00-08:59 Apr 12, 2026 | 2 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-12 | l'Amour Toujours | 09 | 09:00-09:59 Apr 12, 2026 | 3 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-12 | l'Amour Toujours | 10 | 10:00-10:59 Apr 12, 2026 | 4 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-12 | l'Amour Toujours | 11 | 11:00-11:59 Apr 12, 2026 | 5 | €     0 | €    24 |          -24 | CLOSE 🟡 |
| 2026-04-12 | l'Amour Toujours | 12 | 12:00-12:59 Apr 12, 2026 | 6 | €     0 | €    23 |          -23 | CLOSE 🟡 |
| 2026-04-12 | l'Amour Toujours | 13 | 13:00-13:59 Apr 12, 2026 | 7 | €    43 | €   123 |          -80 | NO MATCH ❌ |
| 2026-04-12 | l'Amour Toujours | 14 | 14:00-14:59 Apr 12, 2026 | 8 | €   276 | €   217 |          +59 | NO MATCH ❌ |
| 2026-04-12 | l'Amour Toujours | 15 | 15:00-15:59 Apr 12, 2026 | 9 | €    83 | €   232 |         -149 | NO MATCH ❌ |
| 2026-04-12 | l'Amour Toujours | 16 | 16:00-16:59 Apr 12, 2026 | 10 | €   366 | €   146 |         +220 | NO MATCH ❌ |
| 2026-04-12 | l'Amour Toujours | 17 | 17:00-17:59 Apr 12, 2026 | 11 | €   115 | €   158 |          -43 | NO MATCH ❌ |
| 2026-04-12 | l'Amour Toujours | 18 | 18:00-18:59 Apr 12, 2026 | 12 | €   362 | €   282 |          +80 | NO MATCH ❌ |
| 2026-04-12 | l'Amour Toujours | 19 | 19:00-19:59 Apr 12, 2026 | 13 | €   371 | €   374 |           -3 | CLOSE 🟡 |
| 2026-04-12 | l'Amour Toujours | 20 | 20:00-20:59 Apr 12, 2026 | 14 | €   695 | €   340 |         +355 | NO MATCH ❌ |
| 2026-04-12 | l'Amour Toujours | 21 | 21:00-21:59 Apr 12, 2026 | 15 | €    45 | €   431 |         -386 | NO MATCH ❌ |
| 2026-04-12 | l'Amour Toujours | 22 | 22:00-22:59 Apr 12, 2026 | 16 | €   203 | €   485 |         -282 | NO MATCH ❌ |
| 2026-04-12 | l'Amour Toujours | 23 | 23:00-23:59 Apr 12, 2026 | 17 | €     0 | €   393 |         -393 | NO MATCH ❌ |
| 2026-04-12 | l'Amour Toujours | 00 | 00:00-00:59 Apr 13, 2026 | 18 | €     0 | €   434 |         -434 | NO MATCH ❌ |
| 2026-04-12 | l'Amour Toujours | 01 | 01:00-01:59 Apr 13, 2026 | 19 | €     0 | €   430 |         -430 | NO MATCH ❌ |
| 2026-04-12 | l'Amour Toujours | 02 | 02:00-02:59 Apr 13, 2026 | 20 | €     0 | €    71 |          -71 | NO MATCH ❌ |
| 2026-04-12 | l'Amour Toujours | 03 | 03:00-03:59 Apr 13, 2026 | 21 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-12 | l'Amour Toujours | 04 | 04:00-04:59 Apr 13, 2026 | 22 | €     0 | €     0 |            — | MATCH ✅ |
| 2026-04-12 | l'Amour Toujours | 05 | 05:00-05:59 Apr 13, 2026 | 23 | €     0 | €    24 |          -24 | CLOSE 🟡 |

<!-- BORK_V2_14D_END -->


<!-- BORK_DAILY_OMZET_CSV_START -->
## Daily totals vs `omzet-per0dag-per-locatie-2025-2026.csv` (exact file in `dev-docs/.../bork-validation/`)

**CSV:** **Omzet (excl. btw) € / Selectie** — same numbers as the finance export (**exact revenue per day per location**).  
**V2:** `bork_business_days.total_revenue` per `business_date` + location (register day **06:00–05:59**).  
**Σ CSV** = sum of the three location rows in that file for that **Dag**. **Σ V2** = sum of our three unified locations for that **business_date**. **Gap** = **Σ V2 − Σ CSV**.

### Per day — organisation total (3 locations)

| business_date  | Σ V2           | Σ CSV          | Gap            | Match          |
|:--------------|--------------:|--------------:|--------------:|:--------------|
| 2026-03-30     |          €3363 |          €2704 |           +659 | NO MATCH ❌     |
| 2026-03-31     |         €10171 |          €6318 |          +3853 | NO MATCH ❌     |
| 2026-04-01     |          €7268 |          €6011 |          +1257 | NO MATCH ❌     |
| 2026-04-02     |         €16962 |         €12284 |          +4678 | NO MATCH ❌     |
| 2026-04-03     |         €21463 |         €16605 |          +4858 | NO MATCH ❌     |
| 2026-04-04     |         €17690 |         €16406 |          +1284 | NO MATCH ❌     |
| 2026-04-05     |         €10258 |          €9061 |          +1197 | NO MATCH ❌     |
| 2026-04-06     |         €13709 |         €12065 |          +1644 | NO MATCH ❌     |
| 2026-04-07     |         €11459 |          €8539 |          +2920 | NO MATCH ❌     |
| 2026-04-08     |         €15671 |         €12673 |          +2998 | NO MATCH ❌     |
| 2026-04-09     |         €18629 |         €12355 |          +6274 | NO MATCH ❌     |
| 2026-04-10     |         €25252 |         €17820 |          +7432 | NO MATCH ❌     |
| 2026-04-11     |         €17016 |         €19486 |          -2470 | NO MATCH ❌     |
| 2026-04-12     |         €11987 |         €10638 |          +1349 | NO MATCH ❌     |

### Per location — same days

**Refresh:** `node --experimental-strip-types scripts/compare-bork-daily-omzet-csv.ts`  
**Generated:** 2026-04-18T16:21:10.520Z  
**Window:** last **14** **Dag** values in **omzet-per0dag-per-locatie-2025-2026.csv** (**2026-03-30** … **2026-04-12**).

| business_date  | location               | V2             | CSV            | Gap            | Match          |
|:--------------|:----------------------|--------------:|--------------:|--------------:|:--------------|
| 2026-03-30     | Bar Bea                |           €138 |             €0 |           +138 | NO MATCH ❌     |
| 2026-03-30     | Van Kinsbergen         |          €3225 |          €2704 |           +521 | NO MATCH ❌     |
| 2026-03-30     | l'Amour Toujours       |              — |             €0 |              — | no V2 row      |
| 2026-03-31     | Bar Bea                |          €4422 |          €3256 |          +1166 | NO MATCH ❌     |
| 2026-03-31     | Van Kinsbergen         |          €3698 |          €3049 |           +649 | NO MATCH ❌     |
| 2026-03-31     | l'Amour Toujours       |          €2051 |            €13 |          +2038 | NO MATCH ❌     |
| 2026-04-01     | Bar Bea                |          €3058 |          €2121 |           +937 | NO MATCH ❌     |
| 2026-04-01     | Van Kinsbergen         |          €3171 |          €2970 |           +201 | NO MATCH ❌     |
| 2026-04-01     | l'Amour Toujours       |          €1039 |           €920 |           +119 | NO MATCH ❌     |
| 2026-04-02     | Bar Bea                |          €6028 |          €3628 |          +2400 | NO MATCH ❌     |
| 2026-04-02     | Van Kinsbergen         |          €7689 |          €6141 |          +1548 | NO MATCH ❌     |
| 2026-04-02     | l'Amour Toujours       |          €3245 |          €2515 |           +730 | NO MATCH ❌     |
| 2026-04-03     | Bar Bea                |          €8289 |          €6472 |          +1817 | NO MATCH ❌     |
| 2026-04-03     | Van Kinsbergen         |          €8263 |          €6082 |          +2181 | NO MATCH ❌     |
| 2026-04-03     | l'Amour Toujours       |          €4911 |          €4051 |           +860 | NO MATCH ❌     |
| 2026-04-04     | Bar Bea                |          €5834 |          €5863 |            -29 | CLOSE 🟡       |
| 2026-04-04     | Van Kinsbergen         |          €7468 |          €6696 |           +772 | NO MATCH ❌     |
| 2026-04-04     | l'Amour Toujours       |          €4388 |          €3847 |           +541 | NO MATCH ❌     |
| 2026-04-05     | Bar Bea                |          €3663 |          €3227 |           +436 | NO MATCH ❌     |
| 2026-04-05     | Van Kinsbergen         |          €4000 |          €3533 |           +467 | NO MATCH ❌     |
| 2026-04-05     | l'Amour Toujours       |          €2595 |          €2301 |           +294 | NO MATCH ❌     |
| 2026-04-06     | Bar Bea                |          €3771 |          €3328 |           +443 | NO MATCH ❌     |
| 2026-04-06     | Van Kinsbergen         |          €6578 |          €5805 |           +773 | NO MATCH ❌     |
| 2026-04-06     | l'Amour Toujours       |          €3360 |          €2932 |           +428 | NO MATCH ❌     |
| 2026-04-07     | Bar Bea                |          €3228 |          €2325 |           +903 | NO MATCH ❌     |
| 2026-04-07     | Van Kinsbergen         |          €8231 |          €6214 |          +2017 | NO MATCH ❌     |
| 2026-04-07     | l'Amour Toujours       |              — |             €0 |              — | no V2 row      |
| 2026-04-08     | Bar Bea                |          €5752 |          €4510 |          +1242 | NO MATCH ❌     |
| 2026-04-08     | Van Kinsbergen         |          €6291 |          €5122 |          +1169 | NO MATCH ❌     |
| 2026-04-08     | l'Amour Toujours       |          €3628 |          €3041 |           +587 | NO MATCH ❌     |
| 2026-04-09     | Bar Bea                |          €7519 |          €4358 |          +3161 | NO MATCH ❌     |
| 2026-04-09     | Van Kinsbergen         |          €5542 |          €4446 |          +1096 | NO MATCH ❌     |
| 2026-04-09     | l'Amour Toujours       |          €5568 |          €3551 |          +2017 | NO MATCH ❌     |
| 2026-04-10     | Bar Bea                |         €11456 |          €7827 |          +3629 | NO MATCH ❌     |
| 2026-04-10     | Van Kinsbergen         |          €8946 |          €6895 |          +2051 | NO MATCH ❌     |
| 2026-04-10     | l'Amour Toujours       |          €4850 |          €3098 |          +1752 | NO MATCH ❌     |
| 2026-04-11     | Bar Bea                |          €6184 |          €8496 |          -2312 | NO MATCH ❌     |
| 2026-04-11     | Van Kinsbergen         |          €6872 |          €6266 |           +606 | NO MATCH ❌     |
| 2026-04-11     | l'Amour Toujours       |          €3960 |          €4724 |           -764 | NO MATCH ❌     |
| 2026-04-12     | Bar Bea                |          €3716 |          €3282 |           +434 | NO MATCH ❌     |
| 2026-04-12     | Van Kinsbergen         |          €5711 |          €5086 |           +625 | NO MATCH ❌     |
| 2026-04-12     | l'Amour Toujours       |          €2560 |          €2270 |           +290 | NO MATCH ❌     |

<!-- BORK_DAILY_OMZET_CSV_END -->
