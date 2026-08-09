# Period Cache ADR — Authority for Daily Ops unified cache

**Status:** Accepted (2026-08-09)  
**Scope:** `daily_ops_period_cache` + `daily_ops_ratio_snapshots` + all Daily Ops GET cutovers that read them.

This file is the **sole authority** for the period-cache migration.  
[DECISIONS.md](./DECISIONS.md) is legacy (pre period-cache) and is **not authoritative** here.

**Related:** [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Layer ladder (mandatory)

| Layer | Owns | Hard rule |
|-------|------|-----------|
| **L1** | Business calendar | Register business day only — never raw ISO calendar “today” |
| **L2** | Data model & sealing | One node shape; day→week→month→year on write; GET reads nodes only |
| **L3** | SSOT precedence | Which source wins per field / seal state — no silent guessing |
| **L4** | Formulas | Pure math only; **never** defines a GET/read path — only which L2 field it fills |

If L4 conflicts with a clever GET shortcut, **L2 + L3 win**.

---

## L1 — Business calendar

**Status:** Accepted

**Context:** Daily Ops “today” is the open register day (08:00 Amsterdam → 07:59 next calendar day), not the ISO calendar date. Mixing the two breaks period keys and rollups.

**Decision:**

1. Single utility: [`utils/dailyOpsBusinessDate.ts`](./utils/dailyOpsBusinessDate.ts) (`amsterdamOpenRegisterBusinessDateYmd`, `isOpenRegisterBusinessDate`, etc.).
2. Every `periodKey`, `businessDateStart`, `businessDateEnd` on a period-cache node derives from register business dates only.
3. Week = ISO Mon–Sun of business_dates. Month/year keys = calendar `YYYY-MM` / `YYYY` of those business_dates.

**Apply map:**

| Surface | File |
|--------|------|
| Date utils | `utils/dailyOpsBusinessDate.ts` |
| Seal status | `server/utils/dailyOpsPeriodCache/sealDayNode.ts` |
| Cascade keys | `server/utils/dailyOpsPeriodCache/cascadePeriod.ts` |

**Consequences:** Violations are architecture bugs. Open register day → node `status: open`; closed days use seal rules in L2/L3.

---

## L2 — Data model & sealing

**Status:** Accepted

**Context:** Multiple cache “profiles” produced inconsistent totals. One hierarchical document shape is required.

**Decision:**

1. **Collection** `daily_ops_period_cache`, unique key `{ locationId, level, periodKey }` where `level` ∈ `day|week|month|year`.
2. **Shape** `DailyOpsPeriodNode` in [`types/daily-ops-period-cache.ts`](./types/daily-ops-period-cache.ts) — revenue, labor, staff, cogs, ratios together. Hourly/product detail lives on **day** only; rollups are totals + `childKeys`.
3. **Cascade (write):** day → week (7 days) → month (days) → year (months). Incomplete week (&lt;7 days) is not written as sealed week.
4. **Status machine:**
   - `open` — open register day (live Bork/Eitje).
   - `ops_sealed` — closed day after inbox/Bork headline reconciliation.
   - `finance_sealed` — calendar month after accountant P&L lands (hard override of ratios).
   - `partial` — incomplete rollup (e.g. year before all months present).
5. **Ratios collection** `daily_ops_ratio_snapshots` keyed by `{ monthKey, locationId }`. Nodes store `ratios.ratioAsOf` — never recompute ratios on GET.
6. **Read path:** `resolvePeriodRange` greedy cover (year → month → week → day). No raw Bork/Eitje/inbox/Finance assembly on page load.

**Apply map:**

| Surface | File |
|--------|------|
| Types | `types/daily-ops-period-cache.ts` |
| Store | `server/utils/dailyOpsPeriodCache/store.ts` |
| Build / seal / cascade | `buildDayNode.ts`, `sealDayNode.ts`, `cascadePeriod.ts` |
| Ratios | `ratioSnapshot.ts` |
| Resolve | `resolvePeriodRange.ts` |
| Snapshot hook | `server/services/dailyOpsSnapshotService.ts` |
| CLI | `scripts/backfill-period-cache.ts`, `scripts/validate-period-cache.ts` |

**Consequences:** Snapshot build must refresh period-cache (auto-hook). Manual backfill remains for history only.

---

## L3 — SSOT precedence

**Status:** Accepted

**Context:** Food/beverage and headline revenue drifted because each page guessed differently.

**Decision:**

1. **Food / beverage (no silent guessing):**
   1. Inbox / snapshot category groupings when present.
   2. Else Bork `product_catalog.category` (`food` \| `beverage`).
   3. Else regex name-match — **data gap only**: record product id in `provenance.regexFallbackProductIds` and raise ops alert. Never treat regex as quiet truth.
2. **Revenue headline:** open day → live Bork (order-time). Closed day → inbox digest wins when present; else Bork paid headline.
3. **Ratios / BE / Est. net for a sealed Finance month:** Finance P&L is hard override for that month. Open spans use rolling ratio snapshot. Multi-month = sum of month slices (never one monthly BE vs full-year revenue).
4. **UI is never SSOT.** Wrong number ⇒ fix write path or data.

**Apply map:**

| Surface | File |
|--------|------|
| Classify | `server/utils/dailyOpsPeriodCache/classifyFoodBeverage.ts` |
| Day build | `server/utils/dailyOpsPeriodCache/buildDayNode.ts` |
| Ops gaps | `server/utils/opsNotifications/detectors/periodCacheFoodBevGaps.ts` |

**Consequences:** All UI food/bev/BE reads must come from period-cache nodes or `resolvePeriodRange`, not per-page rollups.

---

## L4 — Formulas

**Status:** Accepted

**Context:** Formula ADRs historically invented GET paths (“transitional live resolve”), causing year/week composition bugs.

**Decision:**

1. Break-even, net profit, labor load, COGS amount are **pure functions** that write into L2 node fields (`ratios.*`, `cogs.*`, `labor.loadedCost`).
2. **Hard rule:** An L4 entry **must not** specify a GET handler, API route, or live Mongo assemble-on-request path. It only names: inputs, formula, and target L2 fields.
3. Delivery: write on seal / Finance refresh / cascade; GET = `findOne` / `resolvePeriodRange` only.
4. Est. net for sealed months = Finance `result`. Open spans = CM estimate on ops revenue using ratio snapshot.

**Apply map:**

| Surface | File |
|--------|------|
| Ratio persist | `server/utils/dailyOpsPeriodCache/ratioSnapshot.ts` |
| BE from cache | `server/utils/dailyOpsPeriodCache/resolveBreakEvenFromPeriodCache.ts` |
| Math helpers (pure) | `utils/accountingPnlBreakEvenMath.ts`, `server/utils/dailyOpsInsights/pnlFromRevenueLabor.ts` |

**Consequences:** `resolveBreakEven` live path is retired. Any new formula lands in L2 fields first, then UI.

---

## Migration phases (reference)

| Phase | Deliverable |
|-------|-------------|
| 1 | Collection + builders + backfill/validate (done) |
| 2 | This file; legacy DECISIONS.md banner |
| 3 | Auto-write on snapshot build |
| 4 | BE / Est.net GET → period-cache |
| 5 | Food/bev builders → period-cache |
| 6 | Staff workers on day nodes |
| 7 | Retire unused `daily_ops_read_cache` profiles |
| 8 | Ops alerts for regex food/bev gaps |

### Phase 7 status

Retired (no new writes): `revenue-categories`, `revenue-products`, `revenue-summary`, `revenue-timeseries`, `revenue-rolling-medians`, `staff-timeseries`, `staff-plusmin` — see `server/utils/dailyOpsReadCache/retiredProfiles.ts`.

Legacy-active writers (UI still reads): `dashboard-bundle`, `weekly-digest`. BE / food-bev / ratios already ignore these.
