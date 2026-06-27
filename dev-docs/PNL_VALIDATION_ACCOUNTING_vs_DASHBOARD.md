# P&L validation — real accounting vs Daily Ops dashboard

**Date:** 2026-06-21  
**Sources:** accounting P&L exports (2024, 2025 full year; 2026 Jan–May monthly + YTD) + Daily Ops dashboard (last month ~May 2026)

**App P&L defaults** (all comparisons): food COGS **30%** · bev COGS **30%** · fixed overhead **25%** · labor from **Eitje gewerkte loaded cost**

---

## Real P&L totals at a glance

Compact view per venue. **Fixed** = *Overige bedrijfskosten* (2024/2025 full accounting) or *Overige Vaste Lasten* (2026 YTD simplified export). Excludes afschrijving & financial.

### 2024 (full year)

| | Revenue | Labor | COGS | Fixed | Result |
|---|---------|-------|------|-------|--------|
| **Van Kinsbergen** | €2.28M | €953k (42%) | €677k (30%) | €429k (19%) | **+€134k** |
| **Bar Bea** | €1.53M | €543k (35%) | €427k (28%) | €303k (20%) | **+€129k** |
| **l'Amour** | €1.82M | €748k (41%) | €620k (34%) | €314k (17%) | **−€92k** |
| **Combined** | **€5.64M** | **€2.24M (40%)** | **€1.72M (31%)** | **€1.05M (19%)** | **+€171k (+3%)** |

### 2025 (full year)

| | Revenue | Labor | COGS | Fixed | Result |
|---|---------|-------|------|-------|--------|
| **Van Kinsbergen** | €1.98M | €902k (46%) | €605k (31%) | €214k (11%) | **+€127k** |
| **Bar Bea** | €1.50M | €550k (37%) | €345k (23%) | €319k (21%) | **+€169k** |
| **l'Amour** | €1.34M | €591k (44%) | €410k (31%) | €275k (21%) | **−€78k** |
| **Combined** | **€4.82M** | **€2.04M (42%)** | **€1.36M (28%)** | **€808k (17%)** | **+€218k (+5%)** |

### 2026 YTD (Jan–May)

| | Revenue | Labor | COGS | Fixed | Result |
|---|---------|-------|------|-------|--------|
| **Van Kinsbergen** | €730k | €323k (44%) | €250k (34%) | €228k (31%) | **−€71k** |
| **Bar Bea** | €627k | €205k (33%) | €209k (33%) | €209k (33%) | **+€4k** |
| **l'Amour** | €418k | €249k (60%) | €152k (36%) | €235k (56%) | **−€217k** |
| **Combined** | **€1.78M** | **€777k (44%)** | **€611k (34%)** | **€672k (38%)** | **−€284k (−16%)** |

---

## Summary across years (combined 3 venues)

| Year | Revenue | Labor | Labor % | COGS | COGS % | Overige bedrijfskosten | Opex % | Result | Result % |
|------|--------:|------:|--------:|-----:|-------:|-----------------------:|-------:|-------:|---------:|
| **2024** | €5,636,099 | €2,243,300 | **39.8%** | €1,723,822 | **30.6%** | €1,046,526 | **18.6%** | **+€171,237** | **+3.0%** |
| **2025** | €4,818,214 | €2,042,312 | **42.4%** | €1,359,345 | **28.2%** | €808,247 | **16.8%** | **+€217,644** | **+4.5%** |
| **2026 YTD (Jan–May)** | €1,776,060 | €776,640 | **43.7%** | €610,796 | **34.4%** | €672,203 | **37.8%** | **−€283,579** | **−16.0%** |

> **Note:** 2026 “Overige bedrijfskosten” uses the simplified YTD export line (*Overige Vaste Lasten*). 2024/2025 use full-year *Overige bedrijfskosten* from accounting (excl. afschrijving & financial). See per-year sections for depreciation/financial detail.

### Settings vs real — by year (blended, 3 venues)

| Metric | App default | 2024 real | 2025 real | 2026 YTD real |
|--------|------------:|----------:|----------:|--------------:|
| COGS | 30% | **30.6%** | **28.2%** | **34.4%** |
| Fixed / opex | 25% | **18.6%**¹ | **16.8%**¹ | **37.8%**² |
| Labor | ~32%³ | **39.8%** | **42.4%** | **43.7%** |

¹ Excludes afschrijving (~€97–122k/yr/venue) and financial charges — add ~5–7 pp to approximate full fixed burden.  
² 2026 YTD simplified export; not directly comparable to full accounting structure.  
³ Dashboard last-month calculated labor (May 2026); Eitje loaded, not accounting.

**Labor gap pattern is consistent:** real personnel cost runs **~40–44%** of revenue; app defaults/calcs sit **~8–12 pp lower**.

---

## 2024 — full year (accounting)

Source: *Analyse* P&L, year **2024**, month filter december (= full year).

### Totals per venue

| Venue | Revenue | Labor | Labor % | COGS | COGS % | Overige bedrijfskosten | Opex % | Afschrijving | Financieel | **Result** |
|-------|--------:|------:|--------:|-----:|-------:|-----------------------:|-------:|-------------:|-----------:|-----------:|
| Bar Bea | €1,529,479 | €542,708 | 35.5% | €426,901 | 27.9% | €303,131 | 19.8% | €102,296 | −€25,824 | **+€128,619 (+8.4%)** |
| Van Kinsbergen | €2,284,180 | €953,088 | 41.7% | €677,367 | 29.7% | €429,239 | 18.8% | €92,697 | −€9,069 | **+€134,283 (+5.9%)** |
| l'Amour Toujours | €1,822,440 | €747,504 | 41.0% | €619,554 | 34.0% | €314,156 | 17.2% | €192,095 | −€40,796 | **−€91,665 (−5.0%)** |
| **Combined** | **€5,636,099** | **€2,243,300** | **39.8%** | **€1,723,822** | **30.6%** | **€1,046,526** | **18.6%** | €387,088 | −€75,689 | **+€171,237 (+3.0%)** |

### Labor breakdown (Lasten personeelsbeloningen)

| Venue | Lonen | Sociale lasten | Pensioen | Overig | **Total** | Employer load on top of lonen |
|-------|------:|---------------:|---------:|-------:|----------:|------------------------------:|
| Bar Bea | €475,477 | €52,891 | €14,340 | — | €542,708 | **+14.1%** |
| Van Kinsbergen | €822,178 | €99,550 | €26,499 | €4,861 | €953,088 | **+15.9%** |
| l'Amour Toujours | €644,888 | €81,948 | €20,668 | — | €747,504 | **+15.9%** |

### Monthly average (÷12)

| Venue | Rev/mo | Labor/mo | Labor % |
|-------|-------:|---------:|--------:|
| Bar Bea | €127,457 | €45,226 | 35.5% |
| Van Kinsbergen | €190,348 | €79,424 | 41.7% |
| l'Amour Toujours | €151,870 | €62,292 | 41.0% |
| **Combined** | **€469,675** | **€186,942** | **39.8%** |

### 2024 vs app settings

| Metric | App | 2024 real | Gap |
|--------|----:|----------:|----:|
| COGS | 30% | 30.6% | −0.6 pp (close) |
| Fixed opex | 25% | 18.6% (+ ~6.9% afschrijving) | mixed — app may overstate if only opex, understate if incl. depreciation |
| Labor | — | 39.8% | Eitje loaded typically tracks **lonen**, missing **~14–16%** employer load |

l'Amour was **loss-making in 2024 (−5%)** despite group profit +3%.

---

## 2025 — full year (accounting)

Source: *Analyse* P&L, year **2025**, month filter december (= full year).

### Totals per venue

| Venue | Revenue | Labor | Labor % | COGS | COGS % | Overige bedrijfskosten | Opex % | Afschrijving | Financieel | **Result** |
|-------|--------:|------:|--------:|-----:|-------:|-----------------------:|-------:|-------------:|-----------:|-----------:|
| Bar Bea | €1,501,482 | €549,600 | 36.6% | €345,077 | 23.0% | €319,408 | 21.3% | €94,795 | −€23,601 | **+€169,001 (+11.3%)** |
| Van Kinsbergen | €1,976,772 | €901,601 | 45.6% | €604,609 | 30.6% | €214,233 | 10.8% | €121,652 | — | **+€126,921 (+6.4%)** |
| l'Amour Toujours | €1,339,960 | €591,111 | 44.1% | €409,659 | 30.6% | €274,606 | 20.5% | €96,020 | −€46,842 | **−€78,278 (−5.8%)** |
| **Combined** | **€4,818,214** | **€2,042,312** | **42.4%** | **€1,359,345** | **28.2%** | **€808,247** | **16.8%** | €312,467 | −€70,443 | **+€217,644 (+4.5%)** |

### Labor breakdown

| Venue | Lonen | Sociale lasten | Pensioen | Overig | **Total** | Employer load on top of lonen |
|-------|------:|---------------:|---------:|-------:|----------:|------------------------------:|
| Bar Bea | €479,971 | €54,739 | €14,890 | — | €549,600 | **+14.5%** |
| Van Kinsbergen | €772,041 | €95,388 | €26,622 | €7,550 | €901,601 | **+16.8%** |
| l'Amour Toujours | €509,019 | €63,255 | €18,837 | — | €591,111 | **+16.1%** |

### Monthly average (÷12)

| Venue | Rev/mo | Labor/mo | Labor % |
|-------|-------:|---------:|--------:|
| Bar Bea | €125,124 | €45,800 | 36.6% |
| Van Kinsbergen | €164,731 | €75,133 | 45.6% |
| l'Amour Toujours | €111,663 | €49,259 | 44.1% |
| **Combined** | **€401,518** | **€170,193** | **42.4%** |

### 2025 vs app settings

| Metric | App | 2025 real | Gap |
|--------|----:|----------:|----:|
| COGS | 30% | 28.2% | +1.8 pp (app slightly high) |
| Fixed opex | 25% | 16.8% (+ ~6.5% afschrijving) | app overhead depends what you include |
| Labor | — | 42.4% | **+3.8 pp vs 2024** — labor share rising |

**2025 trends:** revenue **−14.5%** vs 2024 (€5.64M → €4.82M); labor **−9.0%** in € but **+2.6 pp** as share of revenue. l'Amour loss again (−5.8%). Van Kinsbergen labor jumped to **45.6%** of revenue.

> **Caution:** VKB Dec 2025 result (+€275k) and BEA Dec 2025 (+€117k) show year-end COGS/opex adjustments — treat December and annual totals with care.

---

## 2026 YTD — Jan–May (accounting vs dashboard)

### Period caveat

| Source | Window |
|--------|--------|
| Accounting P&L | **Jan–May 2026** (5 months, cumulative) |
| Dashboard | **Last month only** (~May 2026) |

### Real P&L totals (Jan–May 2026)

| Venue | Revenue | Labor | Labor % | COGS | COGS % | Fixed costs | Fixed % | Result |
|-------|--------:|------:|--------:|-----:|-------:|------------:|--------:|-------:|
| Van Kinsbergen | €730,466 | €323,466 | 44.3% | €250,006 | 34.2% | €227,700 | 31.2% | **−€70,706 (−9.7%)** |
| Bar Bea | €627,356 | €204,527 | 32.6% | €209,225 | 33.4% | €209,234 | 33.4% | **+€4,370 (+0.7%)** |
| l'Amour Toujours | €418,238 | €248,647 | 59.5% | €151,565 | 36.2% | €235,269 | 56.3% | **−€217,243 (−51.9%)** |
| **Combined** | **€1,776,060** | **€776,640** | **43.7%** | **€610,796** | **34.4%** | **€672,203** | **37.8%** | **−€283,579 (−16.0%)** |

### Real labor breakdown (Jan–May 2026)

| Venue | Lonen | Sociale lasten | Pensioen | Overig | Total |
|-------|------:|---------------:|---------:|-------:|------:|
| Van Kinsbergen | €280,114 | €31,494 | €8,908 | €2,950 | €323,466 |
| Bar Bea | €182,569 | €17,492 | €4,466 | — | €204,527 |
| l'Amour Toujours | €216,289 | €25,622 | €6,736 | — | €248,647 |

### Dashboard last month (~May 2026)

| Venue | Revenue | Labor (Eitje) | Labor % | Profit (est.) |
|-------|--------:|--------------:|--------:|--------------:|
| Van Kinsbergen | €157,845 | €61,797 | 39% | +€13,480 (+9%) |
| Bar Bea | €145,069 | €46,359 | 32% | +€22,981 (+16%) |
| l'Amour Toujours | €78,719 | €39,339 | 50% | −€1,783 (−2%) |
| **All locations** | **€381,633** | **€122,951** | **32%** | **+€34,697 (+9%)** |

### Revenue — real monthly avg vs dashboard last month

| Venue | Real avg/mo (÷5) | Dashboard last month | Δ |
|-------|-----------------:|---------------------:|--:|
| Van Kinsbergen | €146,093 | €157,845 | +8% |
| Bar Bea | €125,471 | €145,069 | +16% |
| l'Amour Toujours | €83,648 | €78,719 | −6% |
| **Combined** | **€355,212** | **€381,633** | **+7%** |

### Labor gap — Eitje calculated vs accounting (May-scale)

| | Real monthly avg | Dashboard last month | Shortfall |
|--|-----------------:|---------------------:|----------:|
| **Combined** | **€155,328** | **€122,951** | **−€32,377 (−21%)** |

| Venue | Real avg/mo | Dashboard | Shortfall |
|-------|------------:|----------:|----------:|
| Van Kinsbergen | €64,693 | €61,797 | −€2,896 (−4%) |
| Bar Bea | €40,905 | €46,359 | +€5,454 (+13%) |
| l'Amour Toujours | €49,729 | €39,339 | **−€10,390 (−21%)** |

### Profit gap (2026 YTD)

| | Accounting Jan–May | Dashboard last month |
|--|-------------------:|---------------------:|
| Combined | **−€283,579 (−16%)** | **+€34,697 (+9%)** |

---

## Cross-year labor analysis

### Labor as % of revenue (accounting)

| Venue | 2024 | 2025 | 2026 YTD (5 mo) |
|-------|-----:|-----:|----------------:|
| Bar Bea | 35.5% | 36.6% | 32.6% |
| Van Kinsbergen | 41.7% | 45.6% | 44.3% |
| l'Amour Toujours | 41.0% | 44.1% | **59.5%** |
| **Combined** | **39.8%** | **42.4%** | **43.7%** |

Labor share is **creeping up** (+3.9 pp combined 2024→2026 YTD). l'Amour 2026 YTD is an outlier at **59.5%**.

### Employer load not in Eitje loaded cost

Sociale lasten + pensioen (+ overig) add **~14–17%** on top of lonen every year:

| Year | Combined lonen | Combined employer extras | Extras as % of lonen |
|------|---------------:|-------------------------:|---------------------:|
| 2024 | €1,942,543 | €300,757 | **15.5%** |
| 2025 | €1,761,031 | €281,281 | **16.0%** |
| 2026 YTD | €678,972 | €97,668 | **14.4%** |

If Daily Ops loaded cost ≈ lonen only, expect **~15% labor understatement** from missing employer charges alone — before gewerkte vs all-hours differences.

### l'Amour — persistent problem venue

| Year | Revenue | Labor % | Result |
|------|--------:|--------:|-------:|
| 2024 | €1,822,440 | 41.0% | **−€92k (−5%)** |
| 2025 | €1,339,960 | 44.1% | **−€78k (−6%)** |
| 2026 YTD | €418,238 | **59.5%** | **−€217k (−52%)** |

Revenue down, labor share up, losses accelerating in 2026 YTD.

---

## Key takeaways (all years)

1. **Real labor runs 40–44% of revenue** (2024–2026); app/dashboard shows **~32%** — systematic **~8–12 pp understatement**.
2. **Eitje loaded ≠ accounting Lasten Personeel** — missing **~15% employer load** (sociale + pensioen) at minimum.
3. **COGS setting (30%)** is reasonable for 2024–2025 blended (~28–31%) but **too low for 2026 YTD (34%)**.
4. **Fixed overhead (25%)** varies by export structure — 2024/2025 opex alone is **~17–19%**; 2026 simplified export shows **~38%**; app default sits in the middle and may miss afschrijving.
5. **l'Amour needs venue-specific assumptions** — loss-making 3 of 3 periods; 2026 YTD labor at **59.5%** breaks any generic model.
6. **Van Kinsbergen labor rising** — 41.7% (2024) → 45.6% (2025) → 44.3% (2026 YTD).
7. **Dashboard positive profit vs accounting loss (2026)** is largely an **assumptions + labor-definition artifact**.
8. **Compare like periods** — full-year accounting ≠ last-month dashboard ≠ 5-month YTD.
9. **December year-end adjustments** in 2024/2025 (esp. VKB, BEA) distort annual totals — use monthly averages for operational benchmarking.
10. **Recommended next step:** per-venue P&L assumption overrides (COGS, overhead, labor uplift factor) calibrated from these accounting benchmarks.

---

## References

- App defaults: `utils/dailyOpsPnlAssumptionsDefaults.ts`
- Profit-by-interval labor: `server/utils/dailyOpsSnapshot/buildProfitByIntervalFromSnapshot.ts`
- Profit hour math: `server/utils/dailyOpsMetrics/profitHour.ts`
- Venue strip / KPI labor: `GET /api/daily-ops/metrics/venue-strip` (gewerkte loaded)
- Accounting screenshots: 2024/2025 *Analyse* exports (Bar BEA, Van Kinsbergen, L'amour Toujours); 2026 YTD simplified P&L
